/**
 * Supabase Client Initialization
 * This file initializes the Supabase client for use throughout the application
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
    
    // Otherwise, initialize from scratch
    // Get Supabase URL and anon key from meta tags
    let supabaseUrl = '';
    let supabaseAnonKey = '';
    
    // Try to get from meta tags first
    const urlMeta = document.querySelector('meta[name="supabase-url"]');
    const keyMeta = document.querySelector('meta[name="supabase-anon-key"]');
    
    if (urlMeta && keyMeta) {
      supabaseUrl = urlMeta.content;
      supabaseAnonKey = keyMeta.content;
    } else if (window.AGENT_SMITH_CONFIG) {
      // Fall back to global config if available
      supabaseUrl = window.AGENT_SMITH_CONFIG.supabaseUrl;
      supabaseAnonKey = window.AGENT_SMITH_CONFIG.supabaseAnonKey;
    } else {
      console.error('Could not find Supabase configuration');
      return null;
    }
    
    // Create and return the Supabase client
    console.log('[AUTH] Creating Supabase client with URL:', supabaseUrl);
    
    // Check which version of Supabase is loaded
    let client;
    
    // Try the global supabase object from the CDN
    if (typeof supabase === 'object' && typeof supabase.createClient === 'function') {
      console.log('[AUTH] Using global supabase object');
      client = supabase.createClient(supabaseUrl, supabaseAnonKey);
    } else {
      console.error('[AUTH] Supabase library not properly loaded');
      return null;
    }
    
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
  
  // Mark the client as enhanced
  client._enhanced = true;
  
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
  
  // Add onAuthStateChange listener
  client.auth.onAuthStateChange((event, session) => {
    console.log('[AUTH] onAuthStateChange event:', event, 'Session:', !!session);
    
    // Handle auth state changes
    if (event === 'SIGNED_IN') {
      console.log('[AUTH] User signed in');
    } else if (event === 'SIGNED_OUT') {
      console.log('[AUTH] User signed out');
      // Redirect to login page if on a protected route
      checkProtectedRoute();
    } else if (event === 'USER_UPDATED') {
      console.log('[AUTH] User updated');
    } else if (event === 'INITIAL_SESSION') {
      console.log('[AUTH] Initial session loaded:', !!session);
      // Handle case where user has existing session and visits login page
      if (session && window.location.pathname === '/login.html') {
        console.log('[AUTH] User has existing session, redirecting from login page to dashboard.');
        window.location.href = '/dashboard';
        return;
      }
    }
    // Add handling for other events like TOKEN_REFRESHED if needed
  });
}

// Function to check if user is on a protected route - might still be useful for UI elements
async function checkProtectedRoute() {
  if (!window.supabase) return;
  
  // Server-side auth handles redirection, this is just for potential UI logic
  const { data: { session } } = await window.supabase.auth.getSession();
  const needsLogin = !session && isProtectedRoute(window.location.pathname);

  if (needsLogin) {
    console.warn('[AUTH] Client check: No session on protected route.');
    // Optionally hide/show UI elements, but avoid client-side redirects here
    // window.location.href = '/login.html'; 
  }
}

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
