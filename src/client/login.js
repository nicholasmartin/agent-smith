/**
 * Login Page JavaScript
 * 
 * Handles login form submission, validation, and password reset functionality.
 */

import { supabaseClient } from './supabase-browser';

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const loginForm = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('login-btn');
  const resetPasswordLink = document.getElementById('reset-password');
  const loginStatus = document.getElementById('login-status');

  // Check if already authenticated
  checkAuth();

  // Handle form submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      
      if (!email || !password) {
        showStatus('Please fill in all fields', 'error');
        return;
      }
      
      try {
        showStatus('Logging in...', 'info');
        loginBtn.disabled = true;
        
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        
        if (error) throw error;
        
        showStatus('Login successful, redirecting...', 'success');
        window.location.href = '/dashboard';
      } catch (error) {
        showStatus(error.message || 'Login failed', 'error');
        loginBtn.disabled = false;
      }
    });
  }

  // Enable pressing Enter to submit
  if (passwordInput) {
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && loginBtn) {
        e.preventDefault();
        loginBtn.click();
      }
    });
  }

  // Handle password reset
  if (resetPasswordLink) {
    resetPasswordLink.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const email = emailInput.value.trim();
      
      if (!email) {
        showStatus('Please enter your email address', 'error');
        return;
      }
      
      try {
        showStatus('Sending password reset email...', 'info');
        
        // Request password reset with redirect to auth-callback
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/auth-callback.html'
        });
        
        if (error) throw error;
        
        showStatus('Password reset email sent. Please check your inbox.', 'success');
      } catch (error) {
        showStatus(error.message || 'Error sending reset email', 'error');
      }
    });
  }

  // Helper function to check authentication
  async function checkAuth() {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      if (session) {
        // Already authenticated, redirect to dashboard
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
    }
  }

  // Helper function to show status messages
  function showStatus(message, type) {
    if (loginStatus) {
      loginStatus.textContent = message;
      loginStatus.className = `status ${type}`;
      loginStatus.style.display = 'block';
    }
  }
});
