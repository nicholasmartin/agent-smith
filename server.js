/**
 * Agent Smith API Server
 * 
 * This is the main server file for the Agent Smith application.
 * It handles authentication, job processing, and API endpoints.
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const express_rate_limit = require('express-rate-limit');

// Import middleware
const { authMiddleware } = require('./src/middleware/auth');

// Import route modules
const authRoutes = require('./src/routes/auth');
const dashboardRoutes = require('./src/routes/dashboard');
const apiRoutes = require('./src/routes/api');
const createPasswordRoute = require('./src/routes/auth/create-password');
const loginRoute = require('./src/routes/auth/login');

// Initialize Express app
const app = express();

// Trust proxy - needed for express-rate-limit behind proxies like Vercel
app.set('trust proxy', 1);

// Middleware
app.use(express.json());

// Add Content-Security-Policy headers
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://*.fontawesome.com https://kit.fontawesome.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://randomuser.me; connect-src 'self' https://jnpdszffuosiirapfvwp.supabase.co https://*.supabase.co wss://*.supabase.co"
  );
  next();
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Password-based auth routes - no auth middleware needed for these
app.use('/api/auth/create-password', createPasswordRoute);
app.use('/api/auth/login', loginRoute);

// Create password page route
app.get('/create-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'create-password.html'));
});

// Apply route modules
// Public/Auth routes (login page, etc.) - No authMiddleware needed here
app.use('/', authRoutes); 

// Dashboard routes - Apply authMiddleware here
app.use('/dashboard', authMiddleware, dashboardRoutes);

// API routes - Apply authMiddleware here
app.use('/api', authMiddleware, apiRoutes);

// Serve the WEBSITE_FORM_SECRET as a JavaScript variable
app.get('/js/config.js', (req, res) => {
  // Set the content type to JavaScript
  res.setHeader('Content-Type', 'application/javascript');
  
  // Set cache control headers to prevent caching of this file
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Generate a random nonce for added security (prevents script injection)
  const nonce = crypto.randomBytes(16).toString('base64');
  
  // Create JavaScript that sets the WEBSITE_FORM_SECRET
  const js = `
    // Configuration for Agent Smith website
    // Generated at: ${new Date().toISOString()}
    window.AGENT_SMITH_CONFIG = {
      websiteFormSecret: "${process.env.WEBSITE_FORM_SECRET || ''}",
      csrfToken: "${nonce}" // Using the nonce as a CSRF token
    };
  `;
  
  res.send(js);
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Agent Smith API is running');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Agent Smith server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
