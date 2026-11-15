const { Router } = require('express')
const authController = require("../controllers/auth.controller")
const authMiddleware = require("../middlewares/auth.middleware")
const passport = require("../config/passport")

const authRouter = Router()

/**
 * Guard middleware to gracefully handle Google OAuth when credentials are not configured
 */
function googleAuthGuard(req, res, next) {
    if (!passport.isGoogleConfigured) {
        return res.status(503).json({
            message: "Google OAuth is not configured on this server. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        })
    }
    next()
}

/**
 * @route GET /api/auth/google
 * @description Redirect user to Google for OAuth authentication
 * @access Public
 */
authRouter.get(
    "/google",
    googleAuthGuard,
    passport.authenticate("google", { scope: ["profile", "email"], session: false })
)

/**
 * @route GET /api/auth/google/callback
 * @description Google OAuth callback
 * @access Public
 */
authRouter.get(
    "/google/callback",
    googleAuthGuard,
    passport.authenticate("google", { session: false, failureRedirect: "/login?error=google_failed" }),
    authController.googleAuthCallbackController
)

/**
 * @route POST /api/auth/register
 * @description Register a new user
 * @access Public
 */
authRouter.post("/register", authController.registerUserController)


/**
 * @route POST /api/auth/login
 * @description login user with email and password
 * @access Public
 */
authRouter.post("/login", authController.loginUserController)


/**
 * @route GET /api/auth/logout
 * @description clear token from user cookie and add the token in blacklist
 * @access public
 */
authRouter.get("/logout", authController.logoutUserController)


/**
 * @route GET /api/auth/get-me
 * @description get the current logged in user details
 * @access private
 */
authRouter.get("/get-me", authMiddleware.authUser, authController.getMeController)


module.exports = authRouter
