/**
 * Supabase Authentication Handler for Agent Smith
 * Implements passwordless (magic link) authentication flow
 */

// Handle signup form submission with passwordless authentication
function setupSupabaseSignup() {
  const form = document.getElementById('signup-form');
  const statusContainer = document.getElementById('form-status');
  const emailInput = document.getElementById('email');
  const nameInput = document.getElementById('name');
  
  if (!form) return;
  
  // Use the globally initialized Supabase client
  const supabaseClient = window.supabase; 
  if (!supabaseClient) {
    console.error('Supabase client not available globally, passwordless auth will not work');
    // Optionally show an error message to the user
    showStatus('error', 'Authentication service unavailable. Please try again later.');
    return;
  }
  
  // Replace the existing submit handler with our Supabase version
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Clear previous status
    if (statusContainer) {
      statusContainer.innerHTML = '';
      statusContainer.className = 'form-status';
    }
    
    // Basic validation
    const email = emailInput.value.trim();
    const name = nameInput.value.trim();
    
    if (!email || !name) {
      showStatus('error', 'Please fill in all fields');
      return;
    }
    
    // Validate email format
    if (!isValidEmail(email)) {
      showStatus('error', 'Please enter a valid email address');
      return;
    }
    
    // Business email validation can be kept or removed as needed
    if (isPersonalEmail(email)) {
      showStatus('error', 'Please use your business email address');
      return;
    }
    
    // Show loading state
    showStatus('loading', 'Sending magic link...');
    
    try {
      // Use Supabase's passwordless authentication with magic link
      // Update to use the new auth callback endpoint
      const { data, error } = await supabaseClient.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect_to=/dashboard`,
          data: {
            name: name
          }
        }
      });
      
      if (error) {
        throw new Error(error.message || 'Authentication error');
      }
      
      // Show success message
      showStatus('success', 'Magic link sent! Please check your email to continue.');
      
      // Clear form
      form.reset();
      
      // Also submit to the API for job processing (optional)
      try {
        const csrfToken = window.AGENT_SMITH_CONFIG?.csrfToken || '';
        
        const response = await fetch('/api/website-signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Website-Secret': window.AGENT_SMITH_CONFIG?.websiteFormSecret || '',
            'X-CSRF-Token': csrfToken || '',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({
            email,
            name
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.jobId) {
          // Reference to the existing pollJobStatus function
          if (typeof pollJobStatus === 'function') {
            pollJobStatus(data.jobId);
          }
        }
      } catch (apiError) {
        console.error('API submission error:', apiError);
        // Don't show this error to user since auth was successful
      }
      
    } catch (error) {
      console.error('Authentication error:', error);
      showStatus('error', error.message || 'Failed to send magic link. Please try again.');
    }
  });
}

// Display status messages (reused from form-handlers.js)
function showStatus(type, message) {
  const statusContainer = document.getElementById('form-status');
  if (!statusContainer) return;
  
  statusContainer.innerHTML = message;
  statusContainer.className = `form-status status-${type}`;
}

// Email validation helper (reused from form-handlers.js)
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Check if email is from a common free provider (reused from form-handlers.js)
function isPersonalEmail(email) {
  const domain = email.split('@')[1].toLowerCase();
  const personalDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'yandex.com',
    'gmx.com', 'live.com', 'me.com', 'inbox.com', 'mail.ru'
  ];
  
  return personalDomains.includes(domain);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  setupSupabaseSignup();
});
