const serverless = require('serverless-http');
const app = require('../../server');

// Wrap the Express app with serverless
module.exports.handler = serverless(app);
