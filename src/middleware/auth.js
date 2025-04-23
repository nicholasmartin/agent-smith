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
  // Debug: Log all cookies
  console.log('[AUTH] Available cookies:', Object.keys(req.cookies || {}));
  
  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    console.log('[AUTH] Found JWT in Authorization header');
    return authHeader.substring(7);
  }
  
  // Check for Supabase cookies - multiple formats are possible
  if (req.cookies) {
    // Direct access token cookie
    if (req.cookies['sb-access-token']) {
      console.log('[AUTH] Found JWT in sb-access-token cookie');
      return req.cookies['sb-access-token'];
    }
    
    // Check for project-specific cookie format
    const projectRef = 'jnpdszffuosiirapfvwp'; // Your Supabase project reference
    const cookieName = `sb-${projectRef}-auth-token`;
    console.log('[AUTH] Checking for cookie:', cookieName);
    
    if (req.cookies[cookieName]) {
      console.log('[AUTH] Found project-specific cookie');
      try {
        // This cookie contains a JSON with session data
        const sessionData = JSON.parse(req.cookies[cookieName]);
        console.log('[AUTH] Cookie data keys:', Object.keys(sessionData || {}));
        if (sessionData && sessionData.access_token) {
          console.log('[AUTH] Successfully extracted access_token from cookie');
          return sessionData.access_token;
        }
      } catch (e) {
        console.error('[AUTH] Error parsing Supabase cookie:', e);
      }
    }
    
    // Last resort: check for any cookie that might contain auth data
    for (const key in req.cookies) {
      if (key.startsWith('sb-') && key.includes('auth')) {
        console.log('[AUTH] Found potential Supabase auth cookie:', key);
        try {
          const data = JSON.parse(req.cookies[key]);
          if (data && data.access_token) {
            console.log('[AUTH] Extracted access_token from alternative cookie');
            return data.access_token;
          }
        } catch (e) {}
      }
    }
  }
  
  console.log('[AUTH] No JWT found in request');
  return null;
}

/**
 * Protected route middleware that checks if the user is authenticated
 * and redirects to login if not
 */
async function protectedRouteMiddleware(req, res, next) {
  console.log('[AUTH] Checking authentication for protected route');
  
  try {
    // Get JWT from request
    const jwt = extractJWT(req);
    console.log('[AUTH] JWT found:', !!jwt);
    
    if (!jwt) {
      console.log('[AUTH] No JWT found, redirecting to login');
      return res.redirect('/login.html');
    }
    
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
