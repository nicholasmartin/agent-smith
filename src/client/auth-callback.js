/**
 * Authentication Callback Page JavaScript
 * 
 * Handles authentication callbacks for email verification, password reset, and magic links.
 */

import { supabaseClient } from './supabase-browser';

document.addEventListener('DOMContentLoaded', async () => {
  const statusElement = document.getElementById('status');
  const messageElement = document.getElementById('message');
  
  try {
    showStatus('Verifying authentication...', 'info');
    
    // Check for tokens in the URL hash (email verification, magic link, password reset)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');
    
    // If we have tokens in the URL, set the session
    if (accessToken && refreshToken) {
      showStatus('Setting up your session...', 'info');
      
      // Set the session with the tokens
      const { error } = await supabaseClient.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      
      if (error) {
        throw error;
      }
      
      // Clean up the URL by removing the hash
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Show success message based on auth type
      const successMessage = type === 'recovery' 
        ? 'Password reset successful! Redirecting to dashboard...'
        : 'Authentication successful! Redirecting to dashboard...';
      
      showStatus(successMessage, 'success');
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
      
      return;
    }
    
    // No tokens found, check if we already have a session
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
      showStatus('Already authenticated! Redirecting to dashboard...', 'success');
      
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
      
      return;
    }
    
    // No authentication found, redirect to login
    showStatus('No authentication found! Redirecting to login...', 'error');
    
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 2000);
    
  } catch (error) {
    console.error('Auth callback error:', error);
    showStatus('Authentication error: ' + (error.message || 'Unknown error'), 'error');
    
    // On error, redirect to login after a delay
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 3000);
  }
  
  // Helper function to show status
  function showStatus(message, type) {
    if (statusElement) {
      statusElement.className = 'status ' + type;
    }
    
    if (messageElement) {
      messageElement.textContent = message;
    }
  }
});
