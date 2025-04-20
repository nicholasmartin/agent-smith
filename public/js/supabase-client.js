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
 * Unified Supabase Session Handler (magic link/session persistence)
 * Handles magic link tokens, session establishment, and protected route checks
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
  
  // Create a transaction to track the entire auth flow
  let transaction;
  if (window.Sentry && Sentry.startTransaction) {
    transaction = Sentry.startTransaction({
      name: 'Authentication Flow',
      op: 'auth.session_handling',
    });
    // Set the transaction on the scope so all spans are attached to it
    Sentry.configureScope(scope => scope.setSpan(transaction));
  }
  
  try {
    // Add breadcrumb for session handling start
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
    
    // Check if we've already processed magic link auth in this session
    // This prevents double-processing of the same auth parameters
    const magicLinkProcessed = sessionStorage.getItem('magicLinkProcessed');
    if (magicLinkProcessed) {
      console.log('[SESSION] Magic link already processed in this session, skipping authentication parameter check');
      if (window.Sentry) {
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'Magic link already processed',
          level: 'info'
        });
      }
      await checkProtectedRoute();
      return;
    }
    
    console.log('[SESSION] Checking authentication state...');
    
    // 1. Check for authentication parameters in URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hasAccessToken = hashParams.has('access_token');
    const hasRefreshToken = hashParams.has('refresh_token');
    const hasError = hashParams.has('error');
    const hasAuthParams = hasAccessToken || hasRefreshToken || hasError;
    
    // Track auth parameters in Sentry
    if (window.Sentry) {
      Sentry.setTag('has_auth_params', hasAuthParams ? 'yes' : 'no');
      Sentry.setTag('has_access_token', hasAccessToken ? 'yes' : 'no');
      Sentry.setTag('has_refresh_token', hasRefreshToken ? 'yes' : 'no');
      Sentry.setTag('has_error', hasError ? 'yes' : 'no');
    }
    
    // Process auth parameters if present
    if (hasAuthParams) {
      console.log('[SESSION] Auth parameters detected in URL hash');
      if (window.Sentry) {
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'Auth parameters detected in URL',
          level: 'info'
        });
      }
      
      // Handle auth errors
      if (hasError) {
        const errorDescription = hashParams.get('error_description');
        console.error('[SESSION] Authentication error:', errorDescription);
        if (window.Sentry) {
          Sentry.captureMessage(`Authentication error: ${errorDescription}`, {
            level: 'error',
            tags: { auth_stage: 'hash_params' }
          });
        }
        // Redirect to login if there's an auth error
        window.location.href = '/login.html';
        return;
      }
      
      // Process valid auth tokens
      if (hasAccessToken && hasRefreshToken) {
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        console.log('[SESSION] Setting session with tokens...');
        
        // Create a span for token processing
        let tokenSpan;
        if (transaction) {
          tokenSpan = transaction.startChild({
            op: 'auth.process_tokens',
            description: 'Process auth tokens from URL'
          });
        }
        
        // Immediately clean up URL hash for security before processing
        // This helps prevent token from being consumed twice
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
          console.log('[SESSION] Cleaned up URL hash parameters');
          if (window.Sentry) {
            Sentry.addBreadcrumb({
              category: 'auth',
              message: 'Cleaned URL hash parameters',
              data: { newUrl: window.location.href },
              level: 'info'
            });
          }
        }
        
        // Now set the session with the tokens
        let setSessionSpan;
        if (transaction) {
          setSessionSpan = transaction.startChild({
            op: 'auth.set_session',
            description: 'Set Supabase session with tokens'
          });
        }
        
        const { data, error } = await window.supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (setSessionSpan) setSessionSpan.finish();
        
        if (error) {
          console.error('[SESSION] Error setting session:', error);
          if (window.Sentry) {
            Sentry.captureException(error, {
              tags: { auth_stage: 'set_session' },
              extra: { error_message: error.message }
            });
          }
          window.location.href = '/login.html';
          return;
        }
        
        console.log('[SESSION] Session established successfully:', 
          data.session ? `User: ${data.session.user?.email}` : 'No user');
        
        if (window.Sentry) {
          Sentry.addBreadcrumb({
            category: 'auth',
            message: 'Session established successfully',
            data: { 
              hasSession: !!data.session,
              userEmail: data.session?.user?.email
            },
            level: 'info'
          });
        }
        
        // Add delay to ensure session is fully established
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Set flag to indicate we've already processed a magic link
        // This prevents the same token from being consumed twice
        sessionStorage.setItem('magicLinkProcessed', 'true');
        console.log('[SESSION] Set magicLinkProcessed flag in sessionStorage');
        
        if (tokenSpan) tokenSpan.finish();
      }
    }
    
    // 2. Finally check protection status of current route
    let routeCheckSpan;
    if (transaction) {
      routeCheckSpan = transaction.startChild({
        op: 'auth.check_protected_route',
        description: 'Check if current route is protected'
      });
    }
    
    await checkProtectedRoute();
    
    if (routeCheckSpan) routeCheckSpan.finish();
    
  } catch (err) {
    console.error('[SESSION] Error in unified session handler:', err);
    if (window.Sentry) {
      Sentry.captureException(err, {
        tags: { component: 'session_handler' }
      });
    }
    window.location.href = '/login.html';
  } finally {
    // Finish the transaction
    if (transaction) transaction.finish();
  }
}

// Single event listener for handling authentication and session persistence
document.addEventListener('DOMContentLoaded', handleSupabaseSession);

// Add listener for page unload to clean up session flags
window.addEventListener('beforeunload', () => {
  // Remove the magic link processed flag to ensure clean state on next load
  sessionStorage.removeItem('magicLinkProcessed');
});

// processAuthParameters function has been removed and its functionality consolidated into handleSupabaseSession

// Function to check if current route is protected and requires auth
async function checkProtectedRoute() {
  // Check if we're on a protected page
  const protectedPaths = ['/dashboard.html', '/dashboard', '/profile.html', '/settings.html'];
  const currentPath = window.location.pathname;
  
  console.log('🔍 [PROTECT] Checking protected route:', currentPath);
  
  // Track route check in Sentry
  if (window.Sentry) {
    Sentry.addBreadcrumb({
      category: 'route',
      message: 'Checking protected route',
      data: { 
        path: currentPath,
        isProtected: protectedPaths.some(path => currentPath.includes(path)),
        referrer: document.referrer,
        url: window.location.href
      },
      level: 'info'
    });
  }
  
  // Check if we've already processed magic link auth in this session
  const magicLinkProcessed = sessionStorage.getItem('magicLinkProcessed');
  if (magicLinkProcessed) {
    console.log('🔍 [PROTECT] Magic link already processed, skipping additional auth checks');
    if (window.Sentry) {
      Sentry.setTag('magic_link_processed', 'true');
    }
  } else if (window.Sentry) {
    Sentry.setTag('magic_link_processed', 'false');
  }
  
  // Check if there are any remaining auth parameters in the URL
  // This is a safety check, as they should have been cleaned by handleSupabaseSession
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const hasAuthParams = hashParams.has('access_token') || hashParams.has('refresh_token');
  
  // Track auth params in Sentry
  if (window.Sentry) {
    Sentry.setTag('has_auth_params_in_route_check', hasAuthParams ? 'yes' : 'no');
  }
  
  // If somehow auth params are still in URL, remove them
  if (hasAuthParams) {
    console.log('🔍 [PROTECT] Auth parameters found in URL during route check (unexpected)');
    if (window.Sentry) {
      Sentry.captureMessage('Auth parameters found in URL during route check (unexpected)', {
        level: 'warning',
        tags: { component: 'route_protection' }
      });
    }
    
    // Clean up URL immediately to prevent double processing
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
      console.log('🔍 [PROTECT] Cleaned up URL hash parameters');
      if (window.Sentry) {
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'Cleaned URL hash parameters during route check',
          level: 'info'
        });
      }
    }
  }
  
  const isProtectedRoute = protectedPaths.some(path => currentPath.includes(path));
  
  if (isProtectedRoute) {
    console.log('🔍 [PROTECT] Protected route detected:', currentPath);
    if (window.Sentry) {
      Sentry.addBreadcrumb({
        category: 'route',
        message: 'Protected route detected',
        data: { path: currentPath },
        level: 'info'
      });
    }
    
    // If we're on a protected page, ensure we're authenticated
    if (window.supabase) {
      try {
        console.log('🔍 [PROTECT] Checking session for protected route');
        
        // Create a timestamp to measure how long the session check takes
        const startTime = Date.now();
        if (window.Sentry) {
          Sentry.addBreadcrumb({
            category: 'auth',
            message: 'Starting session check for protected route',
            level: 'info'
          });
        }
        
        // Add a longer delay to give Supabase time to establish the session
        // This helps prevent flickering redirects after clicking magic links
        const delayMs = 1000;
        console.log('🔍 [PROTECT] Adding delay of', delayMs, 'ms before session check');
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        console.log('🔍 [PROTECT] Delay complete, getting session');
        const { data: { session } } = await window.supabase.auth.getSession();
        const sessionCheckDuration = Date.now() - startTime;
        
        console.log('🔍 [PROTECT] Current session:', !!session, 
          session ? `User: ${session.user?.email}` : 'No user');
        
        // Track session check in Sentry
        if (window.Sentry) {
          Sentry.addBreadcrumb({
            category: 'auth',
            message: 'Session check complete',
            data: { 
              hasSession: !!session,
              userEmail: session?.user?.email,
              checkDurationMs: sessionCheckDuration,
              currentUrl: window.location.href
            },
            level: 'info'
          });
          
          // Set important tags for filtering
          Sentry.setTag('has_session', !!session ? 'yes' : 'no');
          Sentry.setTag('protected_route', 'yes');
        }
        
        if (!session) {
          console.log('🔍 [PROTECT] No active session, redirecting to login');
          
          // Capture the redirect event in Sentry
          if (window.Sentry) {
            Sentry.captureMessage('Redirecting to login from protected route - No session', {
              level: 'warning',
              tags: { 
                redirect_reason: 'no_session',
                from_path: currentPath,
                to_path: '/login.html',
                magic_link_processed: magicLinkProcessed ? 'yes' : 'no'
              }
            });
          }
          
          window.location.href = '/login.html';
        } else {
          console.log('🔍 [PROTECT] Valid session found, staying on protected route');
          if (window.Sentry) {
            Sentry.addBreadcrumb({
              category: 'auth',
              message: 'Valid session for protected route',
              level: 'info'
            });
          }
        }
      } catch (error) {
        console.error('🔍 [PROTECT] Error checking authentication:', error);
        
        // Capture the error in Sentry
        if (window.Sentry) {
          Sentry.captureException(error, {
            tags: { 
              component: 'route_protection',
              error_type: 'session_check_failed'
            },
            extra: {
              currentPath,
              magicLinkProcessed: !!magicLinkProcessed
            }
          });
        }
        
        window.location.href = '/login.html';
      }
    } else {
      // If Supabase client isn't available, redirect to login
      console.error('🔍 [PROTECT] Supabase client not available');
      
      if (window.Sentry) {
        Sentry.captureMessage('Supabase client not available for protected route check', {
          level: 'error',
          tags: { component: 'route_protection' }
        });
      }
      
      window.location.href = '/login.html';
    }
  } else if (window.Sentry) {
    // Not a protected route
    Sentry.setTag('protected_route', 'no');
  }
}
