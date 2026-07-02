import { Router } from "express";
import { validate, verifyJWT } from "../../shared/middleware";
import { signUpSchema, signInSchema } from "./auth-schema";
import * as authController from "./auth-controller";

const router = Router();

router.post("/signup", validate("body", signUpSchema), authController.signUp);
router.post("/signin", validate("body", signInSchema), authController.signIn);
router.post("/logout", authController.logout);
router.post("/logout-all", verifyJWT, authController.logoutAll);
router.post("/refresh", authController.refresh);
router.get("/me", verifyJWT, authController.me);
router.get("/sessions", verifyJWT, authController.getSessions);

router.get("/google", authController.initiateGoogleAuth);
router.get("/github", authController.initiateGithubAuth);
router.get("/google/callback", authController.googleAuthCallback);
router.get("/github/callback", authController.githubAuthCallback);

export default router;
