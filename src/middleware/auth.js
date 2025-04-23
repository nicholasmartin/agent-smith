/**
 * Authentication Middleware for Agent Smith
 * 
 * This middleware provides server-side authentication handling for the Agent Smith application.
 * It creates a Supabase client with the request context and attaches it to the request object.
 * The protected route middleware checks if the user is authenticated and redirects to login if not.
 */

const { createClient } = require('@supabase/supabase-js');
const { createPagesServerClient } = require('@supabase/auth-helpers-nextjs');

/**
 * Main authentication middleware that initializes the Supabase client
 * and attaches it to the request object for use in route handlers
 */
async function authMiddleware(req, res, next) {
  try {
    // Create Supabase client with request context
    const supabase = createPagesServerClient({ req, res });
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // Attach to request for use in route handlers
    req.supabase = supabase;
    
    // Process continues - auth check happens in protected route middleware
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.redirect('/login');
  }
}

/**
 * Protected route middleware that checks if the user is authenticated
 * and redirects to login if not
 */
function protectedRouteMiddleware(req, res, next) {
  console.log('[AUTH] Checking authentication for protected route');
  
  // First check for session cookies
  const accessToken = req.cookies['sb-access-token'];
  const refreshToken = req.cookies['sb-refresh-token'];
  
  // If we have cookies, try to use them
  if (accessToken && refreshToken && req.supabase) {
    console.log('[AUTH] Found session cookies, attempting to restore session');
    
    // Try to restore the session from cookies
    req.supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    })
    .then(() => {
      // Now check if the user is authenticated
      return req.supabase.auth.getUser();
    })
    .then(({ data: { user }, error }) => {
      if (error || !user) {
        console.log('[AUTH] Session restoration failed, redirecting to login');
        return res.redirect('/login');
      }
      // User is authenticated, continue
      console.log('[AUTH] Session restored successfully');
      req.user = user;
      next();
    })
    .catch(error => {
      console.error('[AUTH] Session restoration error:', error);
      res.redirect('/login');
    });
  } else {
    // No cookies, try normal authentication check
    console.log('[AUTH] No session cookies found, checking normal auth');
    
    req.supabase.auth.getUser()
      .then(({ data: { user }, error }) => {
        if (error || !user) {
          console.log('[AUTH] User not authenticated, redirecting to login');
          return res.redirect('/login');
        }
        // User is authenticated, continue
        console.log('[AUTH] User authenticated successfully');
        req.user = user;
        next();
      })
      .catch(error => {
        console.error('[AUTH] Auth middleware error:', error);
        res.redirect('/login');
      });
  }
}

module.exports = { authMiddleware, protectedRouteMiddleware };
