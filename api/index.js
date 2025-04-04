// Vercel API handler for Agent Smith
const app = require('../server');

// Export a handler function for Vercel
module.exports = (req, res) => {
  // Handle the request with our Express app
  return app(req, res);
};
