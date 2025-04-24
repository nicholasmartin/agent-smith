/**
 * Supabase Client Initialization
 * This file initializes the Supabase client for use throughout the application
 * using the @supabase/ssr package for cookie-based authentication
 */

// Initialize Supabase client
function initSupabase() {
  try {
    // First check if we already have a directly initialized client
    if (window.supabaseClient) {
      console.log('[AUTH] Using pre-initialized Supabase client');
      const client = window.supabaseClient;
      
      // Add helper methods to the client if not already added
      if (!client._enhanced) {
        enhanceClient(client);
      }
      
      return client;
    }
    
    // Get Supabase URL and anon key from meta tags or global config
    const urlMeta = document.querySelector('meta[name="supabase-url"]');
    const keyMeta = document.querySelector('meta[name="supabase-anon-key"]');
    
    const supabaseUrl = urlMeta?.content || window.AGENT_SMITH_CONFIG?.supabaseUrl;
    const supabaseAnonKey = keyMeta?.content || window.AGENT_SMITH_CONFIG?.supabaseAnonKey;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[AUTH] Supabase configuration not found');
      return null;
    }
    
    // Create the Supabase client with cookie-based auth
    console.log('[AUTH] Creating Supabase client with cookie-based auth');
    
    // Prioritize cookie-based auth with @supabase/ssr
    let client;
    if (typeof supabaseSSR !== 'undefined' && typeof supabaseSSR.createBrowserClient === 'function') {
      client = supabaseSSR.createBrowserClient(supabaseUrl, supabaseAnonKey);
    } else {
      console.warn('[AUTH] @supabase/ssr not available, falling back to standard client');
      client = supabase.createClient(supabaseUrl, supabaseAnonKey);
    }
    
    // Add helper methods to the client
    enhanceClient(client);
    
    return client;
  } catch (error) {
    console.error('[AUTH] Error initializing Supabase client:', error);
    return null;
  }
}

/**
 * Add helper methods to the Supabase client
 * @param {Object} client - The Supabase client instance
 */
function enhanceClient(client) {
  if (!client) return;
  
  // Mark the client as enhanced
  client._enhanced = true;
  
  // Check if user is authenticated
  client.isAuthenticated = async function() {
    try {
      const { data: { session } } = await this.auth.getSession();
      return !!session;
    } catch (error) {
      console.error('[AUTH] Error checking authentication:', error);
      return false;
    }
  };
  
  // Get current user with error handling
  client.getCurrentUser = async function() {
    try {
      const { data: { user } } = await this.auth.getUser();
      return user || null;
    } catch (error) {
      console.error('[AUTH] Error getting current user:', error);
      return null;
    }
  };
  
  // Get user profile with error handling
  client.getUserProfile = async function() {
    try {
      const user = await this.getCurrentUser();
      if (!user) return null;
      
      const { data } = await this
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      return data || null;
    } catch (error) {
      console.error('[AUTH] Error getting user profile:', error);
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
  
  // Add onAuthStateChange listener with simplified logic
  client.auth.onAuthStateChange((event, session) => {
    console.log('[AUTH] onAuthStateChange event:', event);
    
    // Handle auth state changes
    switch(event) {
      case 'SIGNED_IN':
        console.log('[AUTH] User signed in');
        break;
      case 'SIGNED_OUT':
        console.log('[AUTH] User signed out');
        // Only redirect if on a protected route
        if (isProtectedRoute(window.location.pathname)) {
          window.location.href = '/login.html';
        }
        break;
      case 'INITIAL_SESSION':
        // Redirect from login to dashboard if already authenticated
        if (session && window.location.pathname === '/login.html') {
          console.log('[AUTH] User already authenticated, redirecting to dashboard');
          window.location.href = '/dashboard';
        }
        break;
    }
  });
}

// This function is no longer needed - auth state changes are handled directly
// in the onAuthStateChange callback

// Helper function still needed for checkProtectedRoute
function isProtectedRoute(pathname) {
  const protectedPaths = ['/dashboard', '/api/user/']; // Add other protected paths if needed
  // Ensure dashboard.html itself is considered protected
  if (pathname === '/dashboard.html') return true;
  return protectedPaths.some(path => pathname.startsWith(path));
}

// Make the Supabase client available globally
window.supabase = window.supabaseClient || initSupabase();

// Call checkProtectedRoute on DOM load for any initial UI adjustments needed
document.addEventListener('DOMContentLoaded', checkProtectedRoute);
