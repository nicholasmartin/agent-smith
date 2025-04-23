/**
 * Create Password Client-Side Handler
 * 
 * This script handles the password creation form submission and user authentication.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Get URL parameters
  const params = new URLSearchParams(window.location.search);
  const email = params.get('email');
  const jobId = params.get('job_id');
  
  // Set email field value
  const emailField = document.getElementById('email');
  if (emailField && email) {
    emailField.value = email;
  }
  
  // Handle form submission
  const form = document.getElementById('password-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');
    
    // Clear previous messages
    errorMessage.textContent = '';
    errorMessage.classList.add('hidden');
    successMessage.classList.add('hidden');
    
    // Validate passwords match
    if (password !== confirmPassword) {
      errorMessage.textContent = 'Passwords do not match';
      errorMessage.classList.remove('hidden');
      return;
    }
    
    try {
      // Create user account with password
      console.log('Submitting password creation request...');
      // Get the base URL from the current location
      const baseUrl = window.location.origin;
      const response = await fetch(`${baseUrl}/api/auth/create-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          jobId
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Special handling for different error types
        if (response.status === 409 && data.code === 'user_exists') {
          // User already exists, show message and try to sign in directly
          successMessage.textContent = 'Account already exists. Attempting to sign in...';
          successMessage.classList.remove('hidden');
        } else if (response.status === 400 && data.code === 'invalid_password') {
          // Password doesn't meet requirements
          throw new Error('Password must be at least 6 characters long');
        } else if (response.status === 404) {
          // Job not found
          throw new Error('Job information not found. Please contact support.');
        } else {
          throw new Error(data.error || 'Failed to create password');
        }
      } else {
        // Show success message
        successMessage.textContent = data.message || 'Password created! Signing you in...';
        successMessage.classList.remove('hidden');
      }
      
      try {
        console.log('[AUTH] Attempting to sign in with:', email);
        
        // Try direct Supabase client authentication first (client-side)
        // This is more reliable for maintaining the session in the browser
        console.log('[AUTH] Attempting direct Supabase client authentication');
        const { data: authData, error: authError } = await window.supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (authError) {
          console.error('[AUTH] Direct auth error:', authError);
          // Fall back to server-side login as backup
          console.log('[AUTH] Falling back to server-side login');
          
          const loginResponse = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
          });
          
          const loginData = await loginResponse.json();
          
          if (!loginResponse.ok) {
            console.error('[AUTH] Server login error:', loginData.error);
            throw new Error(loginData.error || 'Failed to sign in');
          }
        }
        
        // Double-check that we have a session
        const { data: { session } } = await window.supabase.auth.getSession();
        console.log('[AUTH] Session check after login:', !!session);
        
        if (!session) {
          console.error('[AUTH] No session after authentication attempts');
          throw new Error('Authentication succeeded but no session was created');
        }
        
        console.log('[AUTH] User signed in successfully with session');
        
        
        // Redirect to dashboard
        successMessage.textContent = 'Sign in successful! Redirecting to dashboard...';
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000); // Short delay to show the success message
      } catch (signInError) {
        // If sign-in fails after password creation/update
        console.error('Sign in error:', signInError);
        errorMessage.textContent = 'Password set successfully, but sign-in failed. Please go to the login page.';
        errorMessage.classList.remove('hidden');
        successMessage.classList.add('hidden');
      }
      
    } catch (error) {
      errorMessage.textContent = error.message || 'An error occurred';
      errorMessage.classList.remove('hidden');
      console.error('Password creation error:', error);
    }
  });
});
