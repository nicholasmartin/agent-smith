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

  let processedHash = false; // Flag to track if we handled hash parameters

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
        console.log('[SESSION] Auth parameters detected in hash. Supabase client will process them.');
        if (window.Sentry) {
          Sentry.addBreadcrumb({
            category: 'auth',
            message: 'Auth parameters detected in hash, letting Supabase client handle.',
            level: 'info'
          });
        }
        processedHash = true;
        // *** REMOVED the unnecessary redirect to /auth/callback ***
        // The Supabase JS client automatically handles the hash parameters.
      }
    }
    
    // Give Supabase time to establish the session from hash or storage
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check current session state
    console.log('[SESSION] Checking session state after delay');
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
    
    // Clean up URL and redirect if we just processed hash parameters and got a session
    if (processedHash && session) {
      console.log('[SESSION] Cleaning up URL and redirecting to dashboard after hash processing.');
      const cleanUrl = window.location.href.split('#')[0];
      window.history.replaceState({}, document.title, cleanUrl);
      window.location.href = '/dashboard'; // Redirect to dashboard
      return; // Stop further execution in this function after redirect
    }

    // Optional: Handle case where user is already logged in but lands on login page
    if (session && window.location.pathname === '/login.html') {
       console.log('[SESSION] User already logged in, redirecting from login page to dashboard.');
       window.location.href = '/dashboard';
       return;
    }

    // Server-side middleware should handle protecting routes now, but keep client-side check as fallback
    // if (!session && isProtectedRoute(window.location.pathname)) {
    //    console.log('[SESSION] No session on protected route, redirecting to login.');
    //    window.location.href = '/login.html';
    //    return;
    // }

  } catch (error) {
    console.error('[SESSION] Error during session handling:', error);
    if (window.Sentry) {
      Sentry.captureException(error, {
        tags: { component: 'session_handler' }
      });
    }
    // Potentially redirect to an error page or login page
    // if (!window.location.pathname.includes('login')) {
    //   window.location.href = '/login.html';
    // }
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
