/**
 * Magic Link Authentication Handler for Agent Smith
 * 
 * This script handles the authentication process when a user arrives via a magic link.
 * It extracts tokens from the URL hash, establishes a session, and ensures proper redirection.
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[AUTH-HANDLER] Initializing authentication handler');
  
  // Check if URL contains authentication hash parameters
  if (window.location.hash) {
    handleAuthHash();
  }
});

/**
 * Handle authentication hash parameters in the URL
 */
async function handleAuthHash() {
  console.log('[AUTH-HANDLER] URL contains hash, checking for auth parameters');
  
  // Parse hash parameters
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const hasAuthParams = hashParams.has('access_token') || hashParams.has('refresh_token') || hashParams.has('type');
  
  if (hasAuthParams) {
    console.log('[AUTH-HANDLER] Auth parameters detected in hash');
    
    // Extract tokens
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');
    
    if (accessToken && refreshToken) {
      console.log('[AUTH-HANDLER] Found access and refresh tokens, establishing session');
      
      try {
        // Clean URL immediately to prevent double token consumption
        const cleanUrl = window.location.href.split('#')[0];
        console.log('[AUTH-HANDLER] Cleaning URL hash');
        window.history.replaceState({}, document.title, cleanUrl);
        
        // Set session with tokens
        const { error } = await window.supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        
        if (error) {
          console.error('[AUTH-HANDLER] Error setting session:', error.message);
          window.location.href = '/login?error=token_session_error';
          return;
        }
        
        console.log('[AUTH-HANDLER] Session established successfully');
        
        // Give Supabase time to establish the session
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify the session was established
        const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
        
        if (sessionError || !session) {
          console.error('[AUTH-HANDLER] Session verification failed:', sessionError?.message || 'No session established');
          window.location.href = '/login?error=session_verification_error';
          return;
        }
        
        console.log('[AUTH-HANDLER] Session verified, staying on dashboard');
        
        // Reload the dashboard to ensure all components are properly initialized
        if (window.location.pathname === '/dashboard') {
          window.location.reload();
        }
      } catch (error) {
        console.error('[AUTH-HANDLER] Exception during authentication:', error);
        window.location.href = '/login?error=auth_exception';
      }
    }
  }
}
