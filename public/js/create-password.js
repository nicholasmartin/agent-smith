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
      const response = await fetch('/api/auth/create-password', {
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
        // Special handling for user already exists error
        if (response.status === 409 && data.code === 'user_exists') {
          // User already exists, show message and try to sign in directly
          successMessage.textContent = 'Account already exists. Attempting to sign in...';
          successMessage.classList.remove('hidden');
        } else {
          throw new Error(data.error || 'Failed to create password');
        }
      } else {
        // Show success message
        successMessage.textContent = data.message || 'Password created! Signing you in...';
        successMessage.classList.remove('hidden');
      }
      
      try {
        // Sign in the user
        const { error: signInError } = await window.supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (signInError) {
          throw signInError;
        }
        
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
