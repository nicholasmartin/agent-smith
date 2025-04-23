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

// Use onAuthStateChange for reactive session handling
if (window.supabase) {
  // Flag to check if the initial URL had auth hash parameters
  let initialUrlHadAuthHash = false;
  let authHashParams = null;
  
  // Check if URL contains authentication hash parameters
  if (window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    initialUrlHadAuthHash = hashParams.has('access_token') || hashParams.has('refresh_token') || hashParams.has('type');
    
    if (initialUrlHadAuthHash) {
      console.log('[AUTH] Initial URL contains auth hash parameters.');
      authHashParams = {};
      
      // Store auth parameters for later use
      for (const [key, value] of hashParams.entries()) {
        authHashParams[key] = value;
      }
      
      // Immediately clean URL to prevent double token consumption
      const cleanUrl = window.location.href.split('#')[0];
      console.log('[AUTH] Cleaning URL hash to prevent double token consumption...');
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }

  // Flag to prevent multiple redirect attempts
  let hasRedirected = false;

  // Add a delay function to give Supabase time to establish the session
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Handle magic link authentication
  async function handleMagicLinkAuth() {
    console.log('[AUTH] Handling magic link authentication...');
    
    if (initialUrlHadAuthHash && !hasRedirected) {
      hasRedirected = true; // Set flag immediately to prevent multiple redirects
      
      try {
        // Give Supabase time to establish the session
        console.log('[AUTH] Waiting for session establishment...');
        await delay(1000); // 1 second delay
        
        // Verify session is established
        const { data: { session: currentSession }, error } = await window.supabase.auth.getSession();
        
        if (error) {
          console.error('[AUTH] Error getting session:', error);
          return;
        }
        
        if (currentSession) {
          console.log('[AUTH] Session established successfully, redirecting to dashboard...');
          window.location.href = '/dashboard';
        } else {
          console.error('[AUTH] Failed to establish session after delay');
          // If we're on login page, no need to redirect
          if (!window.location.pathname.includes('login')) {
            window.location.href = '/login';
          }
        }
      } catch (error) {
        console.error('[AUTH] Error during magic link authentication:', error);
        hasRedirected = false; // Reset flag to allow another attempt
      }
    }
  }
  
  // Process magic link parameters immediately if present
  if (initialUrlHadAuthHash) {
    handleMagicLinkAuth();
  }
  
  window.supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('[AUTH] onAuthStateChange event:', event, 'Session:', !!session);

    if (event === 'SIGNED_IN' && session) {
      console.log('[AUTH] User signed in.');

      // If sign-in happened and the initial URL had the hash, redirect to dashboard (only once)
      if (initialUrlHadAuthHash && !hasRedirected) {
        handleMagicLinkAuth();
      }
      
      // Handle case where user is already logged in and visits login page
      if (window.location.pathname === '/login.html') {
         console.log('[AUTH] User already signed in, redirecting from login page to dashboard.');
         window.location.href = '/dashboard';
         return;
      }

    } else if (event === 'SIGNED_OUT') {
      console.log('[AUTH] User signed out.');
      // Redirect to login if on a protected page after sign out
      // Note: Server-side middleware is primary protection
      // if (isProtectedRoute(window.location.pathname)) {
      //    window.location.href = '/login.html';
      // }
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
} else {
  console.error('[AUTH] Supabase client not initialized, cannot set up auth listener.');
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

// Call checkProtectedRoute on DOM load for any initial UI adjustments needed
document.addEventListener('DOMContentLoaded', checkProtectedRoute);
