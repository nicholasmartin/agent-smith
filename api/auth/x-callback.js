/**
 * Enhanced Auth Callback Handler for Agent Smith
 * 
 * This endpoint handles authentication callbacks from Supabase Auth,
 * exchanging the auth code for a session and redirecting to the appropriate page.
 * It's designed to work with magic links and other authentication flows.
 * 
 * Based on official Supabase documentation for handling auth callbacks.
 */

const { createPagesServerClient } = require('@supabase/auth-helpers-nextjs');

module.exports = async (req, res) => {
  try {
    console.log('[AUTH] Processing auth callback request');
    const supabase = createPagesServerClient({ req, res });
    
    // Log the query parameters for debugging (excluding sensitive data)
    const queryParams = { ...req.query };
    if (queryParams.access_token) queryParams.access_token = '[REDACTED]';
    if (queryParams.refresh_token) queryParams.refresh_token = '[REDACTED]';
    console.log('[AUTH] Callback parameters:', queryParams);
    
    // Extract auth parameters from query
    const code = req.query.code;
    const type = req.query.type; // auth type (e.g., 'magiclink')
    const redirectTo = req.query.redirect_to || '/dashboard';
    
    // Important: The hash fragment with access_token and refresh_token is not accessible server-side
    // It will be handled by the client-side JavaScript in auth-handler.js
    
    // Handle code exchange (standard OAuth flow)
    if (code) {
      console.log('[AUTH] Auth code found, exchanging for session');
      
      try {
        // Exchange the code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          console.error('[AUTH] Code exchange error:', error.message);
          return res.redirect('/login?error=code_exchange_error');
        }
        
        console.log('[AUTH] Code successfully exchanged for session');
      } catch (exchangeError) {
        console.error('[AUTH] Exception during code exchange:', exchangeError);
        return res.redirect('/login?error=code_exchange_exception');
      }
    } else {
      console.log('[AUTH] No auth code found in request - will rely on client-side handling');
    }
    
    // Verify if a session was established
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[AUTH] Error verifying session:', sessionError.message);
    }
    
    if (session) {
      console.log('[AUTH] Session verified server-side, redirecting to:', redirectTo);
      return res.redirect(redirectTo);
    }
    
    // If no session was established server-side, we'll redirect to a special URL
    // that will trigger client-side auth handling with the hash parameters
    console.log('[AUTH] No session established server-side, redirecting to client-side handler');
    
    // Create a special HTML page that will handle the hash fragment
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authenticating...</title>
      <script>
        // This script will run in the browser and handle the hash fragment
        window.onload = function() {
          console.log('[AUTH-REDIRECT] Processing authentication redirect');
          
          // If there's a hash in the URL, we need to pass it to the dashboard
          if (window.location.hash) {
            console.log('[AUTH-REDIRECT] Hash fragment detected, redirecting to dashboard with hash');
            // Redirect to dashboard with the hash intact
            window.location.href = '/dashboard' + window.location.hash;
          } else {
            console.log('[AUTH-REDIRECT] No hash fragment, redirecting to dashboard');
            // No hash, just redirect to dashboard
            window.location.href = '/dashboard';
          }
        };
      </script>
    </head>
    <body>
      <h1>Authenticating...</h1>
      <p>Please wait while we complete your authentication.</p>
    </body>
    </html>
    `;
    
    // Send the HTML response
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('[AUTH] Callback error:', error);
    res.redirect('/login?error=callback_exception');
  }
};
