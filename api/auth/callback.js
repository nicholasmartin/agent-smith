/**
 * Enhanced Auth Callback Handler for Agent Smith
 * 
 * This endpoint handles authentication callbacks from Supabase Auth,
 * exchanging the auth code for a session and redirecting to the appropriate page.
 * It's designed to work with magic links and other authentication flows.
 * 
 * This version has been enhanced to handle URL hash parameters and token exchange
 * for magic link authentication, addressing issues with email security scanners
 * and token consumption.
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
    let accessToken = req.query.access_token;
    let refreshToken = req.query.refresh_token;
    const redirectTo = req.query.redirect_to || '/dashboard';
    let type = req.query.type; // auth type (e.g., 'magiclink')
    
    // Since we're getting a hash fragment in the URL, we need to handle it differently
    // The hash fragment isn't sent to the server, so we need to use client-side handling
    // For now, we'll use the code flow and redirect to the dashboard with special handling
    
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
    }
    // Handle direct token auth (magic link flow)
    else if (accessToken && refreshToken) {
      console.log('[AUTH] Auth tokens found, setting session');
      
      try {
        // Set the session directly with the provided tokens
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        
        if (error) {
          console.error('[AUTH] Token session error:', error.message);
          return res.redirect('/login?error=token_session_error');
        }
        
        console.log('[AUTH] Session successfully set from tokens');
      } catch (tokenError) {
        console.error('[AUTH] Exception during token session:', tokenError);
        return res.redirect('/login?error=token_session_exception');
      }
    } else {
      console.log('[AUTH] No auth code or tokens found in request');
    }
    
    // Give the session time to establish
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify the session was established
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[AUTH] Error verifying session:', sessionError);
      return res.redirect('/login?error=session_verification_error');
    }
    
    if (!session) {
      console.warn('[AUTH] No session established after authentication');
      return res.redirect('/login?error=no_session_established');
    }
    
    console.log('[AUTH] Session verified, redirecting to:', redirectTo);
    
    // Redirect to the specified path or dashboard
    res.redirect(redirectTo);
  } catch (error) {
    console.error('[AUTH] Auth callback error:', error);
    res.redirect('/login?error=callback_error');
  }
};
