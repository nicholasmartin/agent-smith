/**
 * Authentication Middleware for Agent Smith
 * 
 * This middleware provides server-side authentication handling for the Agent Smith application.
 * It creates a Supabase client with the request context and attaches it to the request object.
 * The protected route middleware checks if the user is authenticated and redirects to login if not.
 */

const { createServerSupabaseClient } = require('@supabase/auth-helpers-nextjs');

/**
 * Main authentication middleware that initializes the Supabase client
 * and attaches it to the request object for use in route handlers
 */
function authMiddleware(req, res, next) {
  // Create Supabase client with request context
  const supabase = createServerSupabaseClient({ req, res });
  
  // Attach to request for use in route handlers
  req.supabase = supabase;
  
  // Process continues - auth check happens in protected route middleware
  next();
}

/**
 * Protected route middleware that checks if the user is authenticated
 * and redirects to login if not
 */
function protectedRouteMiddleware(req, res, next) {
  // Check if user is authenticated
  req.supabase.auth.getUser()
    .then(({ data: { user }, error }) => {
      if (error || !user) {
        return res.redirect('/login');
      }
      // User is authenticated, continue
      req.user = user;
      next();
    })
    .catch(error => {
      console.error('Auth middleware error:', error);
      res.redirect('/login');
    });
}

module.exports = { authMiddleware, protectedRouteMiddleware };
