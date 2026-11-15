const passport = require('passport');
// No Google OAuth strategy is configured for this deployment.
passport.isGoogleConfigured = false;
module.exports = passport;
