// Sentry initialization for Node.js
const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

Sentry.init({
  dsn: "https://4fe1c5d44ea42012e0459f20f41949d7@o4509169229168640.ingest.us.sentry.io/4509169236770816",
  integrations: [
    nodeProfilingIntegration(),
  ],
  // Performance monitoring
  tracesSampleRate: 1.0, // Capture 100% of transactions
  profilesSampleRate: 1.0, // Profile 100% of sampled transactions
  // Enable capturing request data
  sendDefaultPii: true,
});

module.exports = Sentry;
