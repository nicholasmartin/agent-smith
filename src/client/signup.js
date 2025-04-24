/**
 * Signup Page JavaScript
 * 
 * Handles user registration form submission and validation.
 */

import { supabaseClient } from './supabase-browser';

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const signupForm = document.getElementById('signup-form');
  const fullNameInput = document.getElementById('fullName');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const signupBtn = document.getElementById('signup-btn');
  const signupStatus = document.getElementById('signup-status');

  // Check if already authenticated
  checkAuth();
  
  // Handle form submission
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const fullName = fullNameInput ? fullNameInput.value.trim() : '';
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      
      if (!email || !password) {
        showStatus('Please fill in all required fields', 'error');
        return;
      }
      
      try {
        showStatus('Creating account...', 'info');
        signupBtn.disabled = true;
        
        const { error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: fullName
            }
          }
        });
        
        if (error) throw error;
        
        showStatus('Account created! Please check your email for verification instructions.', 'success');
        signupBtn.disabled = true;
        
        // Automatically redirect after a delay (optional)
        // setTimeout(() => {
        //   window.location.href = '/login.html';
        // }, 3000);
      } catch (error) {
        showStatus(error.message || 'Signup failed', 'error');
        signupBtn.disabled = false;
      }
    });
  }

  // Enable pressing Enter to submit
  if (passwordInput) {
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && signupBtn) {
        e.preventDefault();
        signupBtn.click();
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
    if (signupStatus) {
      signupStatus.textContent = message;
      signupStatus.className = `status ${type}`;
      signupStatus.style.display = 'block';
    }
  }
});
