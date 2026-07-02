import { Request, Response } from "express";
import * as authService from "./auth-service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import config from "../../config";
import logger from "../../loaders/logger";

export const signUp = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  const user = await authService.createUser(email, password, name || null);
  await authService.createSession(res, user.id, req);
  res.status(201).json(new ApiResponse(201, "Sign up successful.", { user }));
});

export const signIn = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await authService.authenticateUser(email, password);
  await authService.createSession(res, user.id, req);
  res.status(200).json(new ApiResponse(200, "Sign in successful.", { user }));
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.destroySession(res, req);
  res.status(204).send();
});

export const logoutAll = asyncHandler(async (req: any, res: Response) => {
  await authService.destroyAllSessions(res, req.user.id);
  res.status(200).json(new ApiResponse(200, "Logged out from all devices.", { ok: true }));
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  await authService.refreshSession(res, req);
  res.status(200).json(new ApiResponse(200, "Token refreshed successfully.", { ok: true }));
});

export const me = asyncHandler(async (req: any, res: Response) => {
  res.status(200).json(new ApiResponse(200, "Current user retrieved.", { user: req.user }));
});

export const getSessions = asyncHandler(async (req: any, res: Response) => {
  const sessions = await authService.listSessions(req.user.id, req.sessionId);
  res.status(200).json(new ApiResponse(200, "Sessions listed.", sessions));
});

export const initiateGoogleAuth = asyncHandler(async (req: Request, res: Response) => {
  const origin = (req.query.origin as string) || config.defaultClientOrigin;
  const url = authService.buildGoogleAuthUrl(origin);
  res.redirect(302, url);
});

export const initiateGithubAuth = asyncHandler(async (req: Request, res: Response) => {
  const origin = (req.query.origin as string) || config.defaultClientOrigin;
  const url = authService.buildGithubAuthUrl(origin);
  res.redirect(302, url);
});

export const googleAuthCallback = asyncHandler(async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  let callbackOrigin = config.defaultClientOrigin.replace(/\/$/, "");

  if (state) {
    try {
      const verifiedState = authService.verifyOauthState(state);
      callbackOrigin = verifiedState.origin.replace(/\/$/, "");
    } catch {
      callbackOrigin = config.defaultClientOrigin.replace(/\/$/, "");
    }
  }

  if (!code || !state) {
    return res.redirect(302, `${callbackOrigin}/?authError=oauth_failed`);
  }

  try {
    const user = await authService.authenticateGoogleUser(code);
    // Create redirection target response
    // Set cookie headers manually in a dummy wrapper or we can use cookies setting directly on res and redirect.
    await authService.createSession(res, user.id, req);
    res.redirect(302, `${callbackOrigin}/oauth-success`);
  } catch (error: any) {
    logger.error("Google Auth Callback Handler failed:", error);
    let errorCode = "oauth_failed";
    if (error.message === "ACCOUNT_EXISTS_WITH_DIFFERENT_SIGNIN_METHOD") {
      errorCode = "account_exists_different_signin_method";
    }
    res.redirect(302, `${callbackOrigin}/?authError=${errorCode}`);
  }
});

export const githubAuthCallback = asyncHandler(async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  let callbackOrigin = config.defaultClientOrigin.replace(/\/$/, "");

  if (state) {
    try {
      const verifiedState = authService.verifyOauthState(state);
      callbackOrigin = verifiedState.origin.replace(/\/$/, "");
    } catch {
      callbackOrigin = config.defaultClientOrigin.replace(/\/$/, "");
    }
  }

  if (!code || !state) {
    return res.redirect(302, `${callbackOrigin}/?authError=oauth_failed`);
  }

  try {
    const user = await authService.authenticateGithubUser(code);
    await authService.createSession(res, user.id, req);
    res.redirect(302, `${callbackOrigin}/oauth-success`);
  } catch (error: any) {
    logger.error("GitHub Auth Callback Handler failed:", error);
    let errorCode = "oauth_failed";
    if (error.message === "ACCOUNT_EXISTS_WITH_DIFFERENT_SIGNIN_METHOD") {
      errorCode = "account_exists_different_signin_method";
    }
    res.redirect(302, `${callbackOrigin}/?authError=${errorCode}`);
  }
});
