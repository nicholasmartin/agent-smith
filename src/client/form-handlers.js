/**
 * Form Handlers for Agent Smith
 * 
 * This module provides the necessary functionality for the website form,
 * allowing visitors to submit their information for personalized emails.
 */

import { createBrowserClient } from '@supabase/ssr';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize form handlers
  initializeFormHandlers();
  
  // Load form configuration
  loadFormConfig();
});

/**
 * Initialize Supabase client for the website form
 */
function initializeSupabase() {
  // Get Supabase configuration from meta tags
  const supabaseUrl = document.querySelector('meta[name="supabase-url"]')?.content;
  const supabaseAnonKey = document.querySelector('meta[name="supabase-anon-key"]')?.content;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase configuration');
    return null;
  }
  
  // Create browser client
  try {
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('Error initializing Supabase client:', error);
    return null;
  }
}

/**
 * Initialize form handlers for the website
 */
function initializeFormHandlers() {
  // Get the form elements
  const emailForm = document.getElementById('email-form');
  const statusMessage = document.getElementById('status-message');
  
  // Skip if form is not found (not on homepage)
  if (!emailForm) return;
  
  // Add submit handler
  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Show loading state
    if (statusMessage) {
      statusMessage.className = 'status-message info';
      statusMessage.textContent = 'Processing your request...';
      statusMessage.style.display = 'block';
    }
    
    // Get form data
    const formData = new FormData(emailForm);
    const data = {
      email: formData.get('email'),
      firstName: formData.get('firstName') || '',
      lastName: formData.get('lastName') || '',
      company: formData.get('company') || '',
      websiteUrl: formData.get('websiteUrl') || ''
    };
    
    // Validate email
    if (!data.email) {
      showStatus('Please enter your email address', 'error');
      return;
    }
    
    try {
      // Get form secret from meta tag
      const formSecret = document.querySelector('meta[name="website-form-secret"]')?.content;
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
      
      // Send the form data to the server
      const response = await fetch('/api/website-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Website-Secret': formSecret || '',
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Error submitting form');
      }
      
      // Show success message
      showStatus('Thank you! We\'ll send your personalized email shortly.', 'success');
      
      // Clear the form
      emailForm.reset();
      
    } catch (error) {
      console.error('Error submitting form:', error);
      showStatus(error.message || 'Error submitting form. Please try again.', 'error');
    }
  });
  
  // Helper function to show status messages
  function showStatus(message, type) {
    if (statusMessage) {
      statusMessage.className = `status-message ${type}`;
      statusMessage.textContent = message;
      statusMessage.style.display = 'block';
    }
  }
}

/**
 * Load form configuration from the server
 */
async function loadFormConfig() {
  try {
    const response = await fetch('/api/form-config');
    const config = await response.json();
    
    // Update form secret
    const formSecretMeta = document.querySelector('meta[name="website-form-secret"]');
    if (formSecretMeta && config.websiteFormSecret) {
      formSecretMeta.content = config.websiteFormSecret;
    }
    
    // Update CSRF token
    const csrfTokenMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfTokenMeta && config.csrfToken) {
      csrfTokenMeta.content = config.csrfToken;
    }
    
    console.log('Form config loaded successfully');
  } catch (error) {
    console.error('Error loading form config:', error);
  }
}
