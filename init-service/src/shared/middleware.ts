import * as yup from "yup";
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import config from "../config";
import ApiError from "../utils/ApiError";
import asyncHandler from "../utils/asyncHandler";
import { db } from "../loaders/postgres";
import { users as usersTable, sessions as sessionsTable } from "db-schema";
import { eq } from "drizzle-orm";

// ─── Custom Signed Token Utilities (to match Python FastAPI) ──────────────────
export function sign(value: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("base64url");
}

export function encodeSignedPayload(payload: any, secret: string): string {
  const sortedPayload: any = {};
  Object.keys(payload)
    .sort()
    .forEach((key) => {
      sortedPayload[key] = payload[key];
    });
  const encoded = Buffer.from(JSON.stringify(sortedPayload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function decodeSignedPayload(token: string, expectedType: string, secret: string): any | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;

  const expectedSignature = sign(encodedPayload, secret);
  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const raw = Buffer.from(encodedPayload, "base64url").toString("utf-8");
    const payload = JSON.parse(raw);
    const exp = payload.exp;
    const tokenType = payload.typ;

    if (tokenType !== expectedType) return null;
    if (typeof exp !== "number" || exp <= Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

// ─── Yup Input Validation Middleware ──────────────────────────────────────────
export const validate = (location: "query" | "body" | "params", schema: yup.ObjectSchema<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = await schema.validate(req[location], { abortEarly: false });
      Object.assign(req[location], validatedData);
      next();
    } catch (error: unknown) {
      if (error instanceof yup.ValidationError) {
        return res.status(422).json({ error: error.errors.join(", ") });
      }
      return res.status(400).json({ error: error instanceof Error ? error.message : "Unknown validation error" });
    }
  };
};

// ─── JWT Authentication Middleware ────────────────────────────────────────────
export const verifyJWT = asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  const token = req.cookies?.[config.ACCESS_COOKIE_NAME];
  if (!token) {
    throw new ApiError("Authentication required.", 401);
  }

  const payload = decodeSignedPayload(token, "access", config.AUTH_SECRET_KEY);
  if (!payload) {
    throw new ApiError("Authentication required.", 401);
  }

  const userId = payload.sub;
  const sessionId = payload.sid;

  if (typeof userId !== "string" || typeof sessionId !== "string") {
    throw new ApiError("Authentication required.", 401);
  }

  const now = new Date();

  // Find Session
  const sessionRows = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId));

  const sessionRow = sessionRows[0];
  if (
    !sessionRow ||
    sessionRow.userId !== userId ||
    sessionRow.status !== "ACTIVE" ||
    sessionRow.expiresAt <= now
  ) {
    throw new ApiError("Authentication required.", 401);
  }

  // Find User
  const userRows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const user = userRows[0];
  if (!user) {
    throw new ApiError("Authentication required.", 401);
  }

  req.user = {
    id: user.id,
    email: user.email,
    name: user.name,
  };
  req.sessionId = sessionId;

  next();
});

// ─── Simple In-Memory Rate Limiter Middleware ──────────────────────────────────
const ipBucket = new Map<string, { count: number; resetTime: number }>();
export const rateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const limit = 100; // max 100 requests per minute
  const windowMs = 60 * 1000;

  const current = ipBucket.get(ip);
  if (!current || now > current.resetTime) {
    ipBucket.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  current.count++;
  if (current.count > limit) {
    return res.status(429).json({
      success: false,
      message: "Too many requests, please try again later.",
    });
  }

  next();
};
