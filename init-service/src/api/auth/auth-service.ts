import crypto from "crypto";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../loaders/postgres";
import { users as usersTable, authMethods as authMethodsTable, sessions as sessionsTable } from "db-schema";
import config from "../../config";
import ApiError from "../../utils/ApiError";
import { encodeSignedPayload, decodeSignedPayload } from "../../shared/middleware";
import logger from "../../loaders/logger";

const PASSWORD_PROVIDER = "password";
const GOOGLE_PROVIDER = "google";
const GITHUB_PROVIDER = "github";
const SESSION_ACTIVE = "ACTIVE";
const SESSION_REVOKED = "REVOKED";
const SESSION_EXPIRED = "EXPIRED";
const ACCESS_TOKEN_TYPE = "access";
const OAUTH_STATE_TYPE = "oauth_state";

const googleOAuth2Client = new OAuth2Client(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET, config.googleRedirectUri);

// ─── Password Utilities ───────────────────────────────────────────────────────
export function hashPassword(password: string): string {
  const iterations = 240000;
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.pbkdf2Sync(password, Buffer.from(salt, "hex"), iterations, 32, "sha256");
  return `pbkdf2_sha256$${iterations}$${salt}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  try {
    const parts = encoded.split("$");
    if (parts.length !== 4) return false;
    const [algorithm, iterationsStr, salt, digest] = parts;
    if (algorithm !== "pbkdf2_sha256") return false;
    const iterations = parseInt(iterationsStr, 10);
    const derived = crypto.pbkdf2Sync(password, Buffer.from(salt, "hex"), iterations, 32, "sha256");
    return crypto.timingSafeEqual(derived, Buffer.from(digest, "hex"));
  } catch {
    return false;
  }
}

// ─── Auth Cookie Helpers ──────────────────────────────────────────────────────
function setAuthCookie(res: any, key: string, value: string, expiresAt: Date): void {
  // SameSite "lax" blocks cookies on cross-origin POST requests (e.g., /auth/refresh from
  // localhost:5173 to localhost:3001). Use "none" to allow cross-origin fetch with credentials.
  // Note: SameSite=None requires Secure=true in production. In local dev, we use Secure=false.
  res.cookie(key, value, {
    httpOnly: true,
    secure: config.AUTH_COOKIE_SECURE,
    sameSite: config.AUTH_COOKIE_SECURE ? "none" : "lax",
    expires: expiresAt,
    path: "/",
  });
}

function clearAuthCookie(res: any, key: string): void {
  res.clearCookie(key, {
    httpOnly: true,
    secure: config.AUTH_COOKIE_SECURE,
    sameSite: config.AUTH_COOKIE_SECURE ? "none" : "lax",
    path: "/",
  });
}

export function clearAuthCookies(res: any): void {
  clearAuthCookie(res, config.ACCESS_COOKIE_NAME);
  clearAuthCookie(res, config.REFRESH_COOKIE_NAME);
}

function setAuthCookies(res: any, userId: string, sessionId: string, refreshToken: string, refreshExpiresAt: Date): void {
  // Generate signed access token
  const accessExpiresAt = new Date(Date.now() + config.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000);
  const accessToken = encodeSignedPayload(
    {
      sub: userId,
      sid: sessionId,
      typ: ACCESS_TOKEN_TYPE,
      exp: Math.floor(accessExpiresAt.getTime() / 1000),
    },
    config.AUTH_SECRET_KEY
  );

  setAuthCookie(res, config.ACCESS_COOKIE_NAME, accessToken, accessExpiresAt);
  setAuthCookie(res, config.REFRESH_COOKIE_NAME, refreshToken, refreshExpiresAt);
}

// ─── Session Helpers ──────────────────────────────────────────────────────────
function hashRefreshSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

function buildRefreshToken(sessionId: string, secret: string): string {
  return `${sessionId}.${secret}`;
}

function parseRefreshToken(token: string | undefined): [string, string] | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [parts[0], parts[1]];
}

function serializeUser(row: any): any {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
  };
}

function serializeSession(row: any, currentSessionId: string | null): any {
  return {
    id: row.id,
    userAgent: row.userAgent,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    status: row.status,
    isCurrent: row.id === currentSessionId,
  };
}

function generateUniqueNameSeed(email: string, name: string | null): string {
  const candidate = (name || email.split("@")[0]).trim().toLowerCase();
  const sanitized = candidate.replace(/[^a-z0-9]/g, "");
  return sanitized.substring(0, 16) || "user";
}

async function generateUniqueName(email: string, preferredName: string | null): Promise<string> {
  const seed = generateUniqueNameSeed(email, preferredName);
  const candidate = preferredName && preferredName.trim() ? preferredName.trim() : seed;
  let currentName = candidate;
  let counter = 0;

  while (true) {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.name, currentName));

    if (existing.length === 0) {
      return currentName;
    }
    counter++;
    currentName = `${candidate}-${counter}`;
  }
}

// ─── Core Exported Services ───────────────────────────────────────────────────

export async function createSessionRecord(
  userId: string,
  userAgent: string | undefined,
  ipAddress: string | null
): Promise<[string, string, Date]> {
  const now = new Date();
  const sessionId = crypto.randomUUID();
  const refreshSecret = crypto.randomBytes(24).toString("base64url");
  const refreshExpiresAt = new Date(now.getTime() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessionsTable).values({
    id: sessionId,
    userId,
    refreshTokenHash: hashRefreshSecret(refreshSecret),
    status: SESSION_ACTIVE,
    userAgent,
    ipAddress,
    expiresAt: refreshExpiresAt,
    lastUsedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return [sessionId, buildRefreshToken(sessionId, refreshSecret), refreshExpiresAt];
}

export async function createSession(res: any, userId: string, req: any): Promise<void> {
  const ipAddress = req.headers["x-forwarded-for"]
    ? req.headers["x-forwarded-for"].split(",")[0].trim()
    : req.ip || null;

  const [sessionId, refreshToken, refreshExpiresAt] = await createSessionRecord(
    userId,
    req.headers["user-agent"],
    ipAddress
  );

  setAuthCookies(res, userId, sessionId, refreshToken, refreshExpiresAt);
}

export async function authenticateUser(email: string, password: string): Promise<any> {
  const normalizedEmail = email.trim().toLowerCase();

  const auths = await db
    .select({
      id: authMethodsTable.id,
      userId: authMethodsTable.userId,
      passwordHash: authMethodsTable.passwordHash,
      user: {
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
      },
    })
    .from(authMethodsTable)
    .innerJoin(usersTable, eq(authMethodsTable.userId, usersTable.id))
    .where(
      and(
        eq(authMethodsTable.provider, PASSWORD_PROVIDER),
        eq(authMethodsTable.providerUserId, normalizedEmail)
      )
    );

  const authMethod = auths[0];
  if (!authMethod || !authMethod.passwordHash || !verifyPassword(password, authMethod.passwordHash)) {
    throw new ApiError("Invalid email or password.", 401);
  }

  return serializeUser(authMethod.user);
}

export async function createUser(email: string, password: string, name: string | null): Promise<any> {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = hashPassword(password);
  const now = new Date();
  const userId = crypto.randomUUID();
  const authMethodId = crypto.randomUUID();

  // Check if email exists
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail));

  if (existing.length > 0) {
    throw new ApiError("An account with this email already exists.", 409);
  }

  const resolvedName = await generateUniqueName(normalizedEmail, name);

  await db.transaction(async (tx) => {
    await tx.insert(usersTable).values({
      id: userId,
      email: normalizedEmail,
      name: resolvedName,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(authMethodsTable).values({
      id: authMethodId,
      userId,
      provider: PASSWORD_PROVIDER,
      providerUserId: normalizedEmail,
      passwordHash,
      createdAt: now,
    });
  });

  return { id: userId, email: normalizedEmail, name: resolvedName };
}

export async function destroySession(res: any, req: any): Promise<void> {
  const refreshCookie = req.cookies?.[config.REFRESH_COOKIE_NAME];
  const parsed = parseRefreshToken(refreshCookie);
  if (parsed) {
    const [sessionId] = parsed;
    await db
      .update(sessionsTable)
      .set({ status: SESSION_REVOKED, revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(sessionsTable.id, sessionId), eq(sessionsTable.status, SESSION_ACTIVE)));
  }
  clearAuthCookies(res);
}

export async function destroyAllSessions(res: any, userId: string): Promise<void> {
  await db
    .update(sessionsTable)
    .set({ status: SESSION_REVOKED, revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(sessionsTable.userId, userId), eq(sessionsTable.status, SESSION_ACTIVE)));

  clearAuthCookies(res);
}

export async function refreshSession(res: any, req: any): Promise<void> {
  const parsed = parseRefreshToken(req.cookies?.[config.REFRESH_COOKIE_NAME]);
  if (!parsed) {
    clearAuthCookies(res);
    throw new ApiError("Invalid session.", 401);
  }

  const [sessionId, refreshSecret] = parsed;
  const now = new Date();

  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId));

  const sessionRow = sessions[0];
  if (!sessionRow) {
    clearAuthCookies(res);
    throw new ApiError("Invalid session.", 401);
  }

  let errorDetail: string | null = null;

  if (sessionRow.status !== SESSION_ACTIVE || sessionRow.revokedAt !== null) {
    errorDetail = "Session has been revoked.";
  } else if (sessionRow.expiresAt <= now) {
    await db
      .update(sessionsTable)
      .set({ status: SESSION_EXPIRED, updatedAt: now })
      .where(eq(sessionsTable.id, sessionId));
    errorDetail = "Session expired.";
  }

  const providedHash = hashRefreshSecret(refreshSecret);
  // Using timingSafeEqual for hash match
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(providedHash, "hex"),
    Buffer.from(sessionRow.refreshTokenHash, "hex")
  );

  if (errorDetail === null && !isMatch) {
    await db
      .update(sessionsTable)
      .set({ status: SESSION_REVOKED, revokedAt: now, updatedAt: now })
      .where(eq(sessionsTable.id, sessionId));
    errorDetail = "Session has been revoked.";
  }

  if (errorDetail !== null) {
    clearAuthCookies(res);
    throw new ApiError(errorDetail, 401);
  }

  const nextRefreshSecret = crypto.randomBytes(24).toString("base64url");
  const nextRefreshExpiresAt = new Date(now.getTime() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db
    .update(sessionsTable)
    .set({
      refreshTokenHash: hashRefreshSecret(nextRefreshSecret),
      lastUsedAt: now,
      expiresAt: nextRefreshExpiresAt,
      updatedAt: now,
    })
    .where(eq(sessionsTable.id, sessionId));

  setAuthCookies(
    res,
    sessionRow.userId,
    sessionId,
    buildRefreshToken(sessionId, nextRefreshSecret),
    nextRefreshExpiresAt
  );
}

export async function listSessions(userId: string, currentSessionId: string | null): Promise<any> {
  const rows = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.userId, userId))
    .orderBy(desc(sessionsTable.lastUsedAt), desc(sessionsTable.createdAt));

  return {
    sessions: rows.map((row) => serializeSession(row, currentSessionId)),
  };
}

// ─── OAuth Helpers & Operations ───────────────────────────────────────────────
function ensureGoogleConfigured(): void {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
    throw new ApiError("Google OAuth is not configured.", 503);
  }
}

function ensureGithubConfigured(): void {
  if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET) {
    throw new ApiError("GitHub OAuth is not configured.", 503);
  }
}

function validateOrigin(origin: string): string {
  const normalized = origin.trim().replace(/\/$/, "");
  const allowed = config.allowedClientOrigins.map((o) => o.replace(/\/$/, ""));
  if (allowed.indexOf(normalized) === -1) {
    throw new ApiError("Origin is not allowed.", 400);
  }
  return normalized;
}

function generateStateToken(origin: string): string {
  const expiresAt = new Date(Date.now() + config.OAUTH_STATE_TTL_MINUTES * 60 * 1000);
  return encodeSignedPayload(
    {
      origin,
      nonce: crypto.randomBytes(16).toString("base64url"),
      typ: OAUTH_STATE_TYPE,
      exp: Math.floor(expiresAt.getTime() / 1000),
    },
    config.AUTH_SECRET_KEY
  );
}

export function buildGoogleAuthUrl(origin: string): string {
  ensureGoogleConfigured();
  const validatedOrigin = validateOrigin(origin);
  const state = generateStateToken(validatedOrigin);

  const query = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID,
    redirect_uri: config.googleRedirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
}

export function buildGithubAuthUrl(origin: string): string {
  ensureGithubConfigured();
  const validatedOrigin = validateOrigin(origin);
  const state = generateStateToken(validatedOrigin);

  const query = new URLSearchParams({
    client_id: config.GITHUB_CLIENT_ID,
    redirect_uri: config.githubRedirectUri,
    scope: "read:user user:email",
    state,
  });

  return `https://github.com/login/oauth/authorize?${query.toString()}`;
}

export function verifyOauthState(state: string): { origin: string } {
  const payload = decodeSignedPayload(state, OAUTH_STATE_TYPE, config.AUTH_SECRET_KEY);
  if (!payload) {
    throw new ApiError("Invalid OAuth state.", 400);
  }
  const origin = payload.origin;
  if (typeof origin !== "string") {
    throw new ApiError("Invalid OAuth state.", 400);
  }
  return { origin: validateOrigin(origin) };
}

async function exchangeGoogleCode(code: string): Promise<string> {
  ensureGoogleConfigured();
  try {
    const res = await axios.post("https://oauth2.googleapis.com/token", {
      code,
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      redirect_uri: config.googleRedirectUri,
      grant_type: "authorization_code",
    });

    const idToken = res.data.id_token;
    if (!idToken) throw new Error();
    return idToken;
  } catch (error) {
    logger.error("Google OAuth token exchange failed:", error);
    throw new ApiError("Google OAuth failed.", 401);
  }
}

async function exchangeGithubCode(code: string): Promise<string> {
  ensureGithubConfigured();
  try {
    const res = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: config.GITHUB_CLIENT_ID,
        client_secret: config.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: config.githubRedirectUri,
      },
      {
        headers: { Accept: "application/json" },
      }
    );

    const accessToken = res.data.access_token;
    if (!accessToken) throw new Error();
    return accessToken;
  } catch (error) {
    logger.error("GitHub OAuth token exchange failed:", error);
    throw new ApiError("GitHub OAuth failed.", 401);
  }
}

async function verifyGoogleIdToken(idToken: string): Promise<any> {
  ensureGoogleConfigured();
  try {
    const ticket = await googleOAuth2Client.verifyIdToken({
      idToken,
      audience: config.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error();

    if (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com") {
      throw new Error();
    }
    if (payload.email_verified !== true) {
      throw new ApiError("Google account email is not verified.", 401);
    }
    return payload;
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    logger.error("Google ID token verification failed:", error);
    throw new ApiError("Google OAuth failed.", 401);
  }
}

async function fetchGithubUser(accessToken: string): Promise<any> {
  try {
    const res = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "YuvroAuth/1.0",
      },
    });
    return res.data;
  } catch (error) {
    logger.error("GitHub fetch user profile failed:", error);
    throw new ApiError("GitHub OAuth failed.", 401);
  }
}

async function fetchGithubPrimaryEmail(accessToken: string): Promise<string> {
  try {
    const res = await axios.get("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "YuvroAuth/1.0",
      },
    });
    const emails = res.data || [];
    const verifiedEmails: string[] = [];
    let primaryVerifiedEmail: string | null = null;

    for (const item of emails) {
      const email = item.email;
      if (typeof email !== "string" || !email.trim()) continue;
      if (item.verified === true) {
        verifiedEmails.push(email);
        if (item.primary === true) {
          primaryVerifiedEmail = email;
          break;
        }
      }
    }

    if (primaryVerifiedEmail) return primaryVerifiedEmail;
    if (verifiedEmails.length > 0) return verifiedEmails[0];

    throw new Error();
  } catch (error) {
    logger.error("GitHub fetch primary email failed:", error);
    throw new ApiError("GitHub account email is not available or not verified.", 401);
  }
}

async function authenticateOauthUser(provider: string, providerUserId: string, email: string, name: string | null): Promise<any> {
  const normalizedEmail = email.trim().toLowerCase();

  // Find existing oauth auth method
  const auths = await db
    .select({
      id: authMethodsTable.id,
      userId: authMethodsTable.userId,
      user: {
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
      },
    })
    .from(authMethodsTable)
    .innerJoin(usersTable, eq(authMethodsTable.userId, usersTable.id))
    .where(
      and(
        eq(authMethodsTable.provider, provider),
        eq(authMethodsTable.providerUserId, providerUserId)
      )
    );

  const existingAuth = auths[0];
  if (existingAuth) {
    const user = existingAuth.user;
    if (name && name.trim() && user.name !== name.trim()) {
      await db
        .update(usersTable)
        .set({ name: name.trim(), updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));
      user.name = name.trim();
    }
    return user;
  }

  // Check if a user with this email already exists
  const existingUser = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail));

  if (existingUser.length > 0) {
    throw new ApiError("ACCOUNT_EXISTS_WITH_DIFFERENT_SIGNIN_METHOD", 409);
  }

  const now = new Date();
  const userId = crypto.randomUUID();
  const authId = crypto.randomUUID();

  const resolvedName = name && name.trim() ? name.trim() : await generateUniqueName(normalizedEmail, null);

  await db.transaction(async (tx) => {
    await tx.insert(usersTable).values({
      id: userId,
      email: normalizedEmail,
      name: resolvedName,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(authMethodsTable).values({
      id: authId,
      userId,
      provider,
      providerUserId,
      createdAt: now,
    });
  });

  return { id: userId, email: normalizedEmail, name: resolvedName };
}

export async function authenticateGoogleUser(code: string): Promise<any> {
  const idToken = await exchangeGoogleCode(code);
  const verified = await verifyGoogleIdToken(idToken);

  const googleSub = verified.sub;
  const email = verified.email;
  const name = verified.name;

  if (!googleSub) {
    throw new ApiError("Google OAuth failed.", 401);
  }

  return authenticateOauthUser(GOOGLE_PROVIDER, googleSub, String(email), name ? String(name) : null);
}

export async function authenticateGithubUser(code: string): Promise<any> {
  const accessToken = await exchangeGithubCode(code);
  const githubUser = await fetchGithubUser(accessToken);

  const githubUserId = githubUser.id;
  const email = githubUser.email;
  const name = githubUser.name;
  const login = githubUser.login;

  if (githubUserId === undefined || githubUserId === null || githubUserId === "") {
    throw new ApiError("GitHub OAuth failed.", 401);
  }

  const resolvedEmail = email && email.trim() ? email : await fetchGithubPrimaryEmail(accessToken);
  const resolvedName = name && name.trim() ? name.trim() : (login && login.trim() ? login.trim() : null);

  return authenticateOauthUser(GITHUB_PROVIDER, String(githubUserId), resolvedEmail, resolvedName);
}
