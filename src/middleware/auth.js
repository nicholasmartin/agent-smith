/**
 * Authentication Middleware for Agent Smith
 * 
 * This middleware provides server-side authentication handling for the Agent Smith application
 * using the @supabase/ssr package for cookie-based authentication. It creates two Supabase clients:
 * 1. A regular client with user's auth context from cookies
 * 2. An admin client with service role for elevated operations
 */

const { createClient } = require('@supabase/supabase-js');
const { createServerClient } = require('@supabase/ssr');

/**
 * Main authentication middleware that initializes the Supabase client
 * and attaches it to the request object for use in route handlers
 */
function authMiddleware(req, res, next) {
  try {
    // Get the anon key from environment variables
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    // Validate environment variables
    if (!process.env.SUPABASE_URL || !anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[AUTH] Missing required Supabase environment variables');
      throw new Error('Missing required Supabase environment variables');
    }
    
    // Create a server-side Supabase client with cookie support using @supabase/ssr
    req.supabase = createServerClient(
      process.env.SUPABASE_URL,
      anonKey,
      {
        cookies: {
          get: (name) => req.cookies?.[name],
          set: (name, value, options) => {
            res.cookie(name, value, {
              ...options,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production'
            });
          },
          remove: (name, options) => res.clearCookie(name, options)
        }
      }
    );
    
    // Create an admin client for operations that need service role
    req.adminSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    next();
  } catch (error) {
    console.error('[AUTH] Auth middleware error:', error);
    res.redirect('/login.html');
  }
}

// Legacy token extraction function has been removed as it's no longer needed with @supabase/ssr

/**
 * Protected route middleware that checks if the user is authenticated
 * and redirects to login if not
 */
async function protectedRouteMiddleware(req, res, next) {
  try {
    // Get session from cookies (handled by @supabase/ssr)
    const { data: { session } } = await req.supabase.auth.getSession();
    
    if (!session) {
      console.log('[AUTH] No valid session found, redirecting to login');
      return res.redirect('/login.html');
    }
    
    // Get user from session
    const { data: { user }, error } = await req.supabase.auth.getUser();
    
    if (error || !user) {
      console.log('[AUTH] User not found in session');
      return res.redirect('/login.html');
    }
    
    // User is authenticated, attach to request and continue
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
    // Get session from cookies (handled by @supabase/ssr)
    const { data: { session } } = await req.supabase.auth.getSession();
    
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Get user from session
    const { data: { user }, error } = await req.supabase.auth.getUser();
    
    if (error || !user) {
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
