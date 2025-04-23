/**
 * Authentication Middleware for Agent Smith
 * 
 * This middleware provides server-side authentication handling for the Agent Smith application.
 * It creates a Supabase client with the request context and attaches it to the request object.
 * The protected route middleware checks if the user is authenticated and redirects to login if not.
 */

const { createClient } = require('@supabase/supabase-js');

/**
 * Initialize Supabase client for server-side use
 * @returns {Object} Supabase client instance
 */
function initSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

/**
 * Main authentication middleware that initializes the Supabase client
 * and attaches it to the request object for use in route handlers
 */
async function authMiddleware(req, res, next) {
  try {
    // Create Supabase client
    const supabase = initSupabase();
    
    // Get JWT from Authorization header or cookies
    const jwt = extractJWT(req);
    
    // If we have a JWT, create a client with the session
    if (jwt) {
      // In newer Supabase versions, we don't use setAuth anymore
      // Instead, we create a new client with the session
      req.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            // Set the JWT as the session
            global: {
              headers: {
                Authorization: `Bearer ${jwt}`
              }
            }
          }
        }
      );
    } else {
      // No JWT, just use the default client
      req.supabase = supabase;
    }
    
    // Process continues - auth check happens in protected route middleware
    next();
  } catch (error) {
    console.error('[AUTH] Auth middleware error:', error);
    res.redirect('/login.html');
  }
}

/**
 * Extract JWT from request
 * @param {Object} req - Express request object
 * @returns {string|null} JWT token or null if not found
 */
function extractJWT(req) {
  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Then check cookies
  if (req.cookies && req.cookies['sb-access-token']) {
    return req.cookies['sb-access-token'];
  }
  
  return null;
}

/**
 * Protected route middleware that checks if the user is authenticated
 * and redirects to login if not
 */
async function protectedRouteMiddleware(req, res, next) {
  console.log('[AUTH] Checking authentication for protected route');
  
  try {
    // Get user from Supabase
    const { data: { user }, error } = await req.supabase.auth.getUser();
    
    if (error || !user) {
      console.log('[AUTH] User not authenticated, redirecting to login');
      return res.redirect('/login.html');
    }
    
    // User is authenticated, attach to request and continue
    console.log('[AUTH] User authenticated successfully:', user.email);
    req.user = user;
    next();
  } catch (error) {
    console.error('[AUTH] Protected route middleware error:', error);
    res.redirect('/login.html');
  }
}

/**
 * API authentication middleware that checks if the user is authenticated
 * and returns 401 if not
 */
async function apiAuthMiddleware(req, res, next) {
  try {
    // Get user from Supabase
    const { data: { user }, error } = await req.supabase.auth.getUser();
    
    if (error || !user) {
      console.log('[AUTH] API auth failed:', error?.message || 'No user found');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // User is authenticated, attach to request and continue
    req.user = user;
    next();
  } catch (error) {
    console.error('[AUTH] API auth middleware error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { 
  authMiddleware, 
  protectedRouteMiddleware,
  apiAuthMiddleware,
  initSupabase
};
