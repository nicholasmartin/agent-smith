/**
 * Supabase Client Initialization
 * This file initializes the Supabase client for use throughout the application
 */

// Initialize Supabase client
function initSupabase() {
  try {
    // First check for environment variables in meta tags
    let supabaseUrl = document.querySelector('meta[name="supabase-url"]')?.content;
    let supabaseAnonKey = document.querySelector('meta[name="supabase-anon-key"]')?.content;
    
    // If not found in meta tags, check for global variables (useful for development)
    if (!supabaseUrl || !supabaseAnonKey) {
      if (typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined') {
        supabaseUrl = SUPABASE_URL;
        supabaseAnonKey = SUPABASE_ANON_KEY;
      } else {
        console.error('Supabase configuration not found');
        return null;
      }
    }
    
    // Create and return the Supabase client
    const client = supabase.createClient(supabaseUrl, supabaseAnonKey);
    
    // Add helper methods to the client
    enhanceClient(client);
    
    return client;
  } catch (error) {
    console.error('Error initializing Supabase client:', error);
    return null;
  }
}

/**
 * Add helper methods to the Supabase client
 * @param {Object} client - The Supabase client instance
 */
function enhanceClient(client) {
  if (!client) return;
  
  // Check if user is authenticated
  client.isAuthenticated = async function() {
    try {
      const { data: { session }, error } = await this.auth.getSession();
      if (error) throw error;
      return !!session;
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  };
  
  // Get current user with error handling
  client.getCurrentUser = async function() {
    try {
      const { data: { user }, error } = await this.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  };
  
  // Get user profile with error handling
  client.getUserProfile = async function() {
    try {
      const user = await this.getCurrentUser();
      if (!user) return null;
      
      const { data, error } = await this
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  };
  
  // Redirect to login if not authenticated
  client.requireAuth = async function() {
    const isAuthenticated = await this.isAuthenticated();
    if (!isAuthenticated) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  };
}

// Make Supabase client available globally
window.supabase = initSupabase();

/**
 * Enhanced Supabase Session Handler
 * Works with server-side auth middleware and properly handles magic links
 */
async function handleSupabaseSession() {
  if (!window.supabase) {
    console.error('[SESSION] Supabase client not available');
    if (window.Sentry) {
      Sentry.captureMessage('Supabase client not available', {
        level: 'error',
        tags: { component: 'session_handler' }
      });
    }
    return;
  }
  
  try {
    // Log session handling start
    console.log('[SESSION] Checking authentication state...');
    if (window.Sentry) {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Starting session handling',
        data: {
          url: window.location.href,
          pathname: window.location.pathname,
          hasHash: !!window.location.hash
        },
        level: 'info'
      });
    }
    
    // Check for hash parameters (magic link authentication)
    if (window.location.hash) {
      console.log('[SESSION] URL hash detected:', window.location.hash);
      
      // Parse hash parameters
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hasAuthParams = hashParams.has('access_token') || hashParams.has('refresh_token') || hashParams.has('type');
      
      if (hasAuthParams) {
        console.log('[SESSION] Auth parameters detected in hash');
        if (window.Sentry) {
          Sentry.addBreadcrumb({
            category: 'auth',
            message: 'Auth parameters detected in hash',
            level: 'info'
          });
        }
        
        // If we're not already on the callback route, redirect to it
        if (window.location.pathname !== '/auth/callback') {
          console.log('[SESSION] Redirecting to callback handler with auth params');
          
          // Preserve the current path to redirect back after auth
          const currentPath = window.location.pathname;
          const redirectTo = currentPath !== '/login' ? currentPath : '/dashboard';
          
          // Build callback URL with auth parameters and redirect_to
          const callbackUrl = `/auth/callback?${window.location.hash.substring(1)}&redirect_to=${encodeURIComponent(redirectTo)}`;
          window.location.href = callbackUrl;
          return;
        }
      }
    }
    
    // Give Supabase time to establish the session
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check current session state
    console.log('[SESSION] Checking session state');
    const { data: { session }, error } = await window.supabase.auth.getSession();
    
    if (error) {
      console.error('[SESSION] Error getting session:', error);
      if (window.Sentry) {
        Sentry.captureException(error, {
          tags: { component: 'session_handler' }
        });
      }
      return;
    }
    
    console.log('[SESSION] Session state:', !!session);
    if (window.Sentry) {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Session state checked',
        data: { hasSession: !!session },
        level: 'info'
      });
    }
    
    // Clean up URL after authentication by removing hash fragments
    if (window.location.hash && session) {
      // Only clean up if we have both a hash and a session
      const cleanUrl = window.location.href.split('#')[0];
      window.history.replaceState({}, document.title, cleanUrl);
      console.log('[SESSION] Cleaned up URL after authentication');
    }
  } catch (err) {
    console.error('[SESSION] Error in session handler:', err);
    if (window.Sentry) {
      Sentry.captureException(err, {
        tags: { component: 'session_handler' }
      });
    }
  }
}

// Single event listener for handling authentication and session persistence
document.addEventListener('DOMContentLoaded', handleSupabaseSession);

// No need for session flags cleanup with server-side auth

// processAuthParameters function has been removed and its functionality consolidated into handleSupabaseSession

// Simplified protected route check function
// This becomes much simpler as server handles protection
async function checkProtectedRoute() {
  // No need to do anything - server middleware handles protection
  console.log('[PROTECT] Route protection handled by server middleware');
  
  if (window.Sentry) {
    Sentry.addBreadcrumb({
      category: 'route',
      message: 'Route protection handled by server middleware',
      data: { 
        path: window.location.pathname,
        url: window.location.href
      },
      level: 'info'
    });
  }
}
