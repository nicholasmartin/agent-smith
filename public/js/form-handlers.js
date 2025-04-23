/**
 * Form Handlers for Agent Smith Website
 * Handles secure form submissions and job tracking notifications
 */

// Form submission handler with security features
function setupSignupForm() {
  const form = document.getElementById('signup-form');
  const statusContainer = document.getElementById('form-status');
  const emailInput = document.getElementById('email');
  const firstNameInput = document.getElementById('firstName');
  const lastNameInput = document.getElementById('lastName');
  
  if (!form) return;
  
  // Add form submission handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Clear previous status
    if (statusContainer) {
      statusContainer.innerHTML = '';
      statusContainer.className = 'form-status';
    }
    
    // Basic validation
    const email = emailInput.value.trim();
    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    
    if (!email || !firstName || !lastName) {
      showStatus('error', 'Please fill in all fields');
      return;
    }
    
    // Validate email format
    if (!isValidEmail(email)) {
      showStatus('error', 'Please enter a valid email address');
      return;
    }
    
    // Validate business email (no free email providers)
    if (isPersonalEmail(email)) {
      showStatus('error', 'Please use your business email address');
      return;
    }
    
    // Show loading state
    showStatus('loading', 'Processing your request...');
    
    try {
      // Get CSRF token from dynamic config
      const csrfToken = window.AGENT_SMITH_CONFIG?.csrfToken || '';
      
      // Debug the websiteFormSecret being used
      const websiteSecret = window.AGENT_SMITH_CONFIG?.websiteFormSecret || '';
      console.log('DEBUG: Using websiteFormSecret:', websiteSecret ? (websiteSecret.substr(0, 3) + '...') : 'MISSING');
      
      // Submit the form with security headers
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
          firstName,
          lastName
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }
      
      // Show success message and job ID
      showStatus('success', `Thank you! Your request is being processed. Job ID: ${data.jobId}`);
      
      // Clear form
      form.reset();
      
      // Set up job status polling if we have a job ID
      if (data.jobId) {
        pollJobStatus(data.jobId);
      }
      
    } catch (error) {
      console.error('Form submission error:', error);
      showStatus('error', error.message || 'Failed to submit form. Please try again.');
    }
  });
}

// Poll for job status updates
function pollJobStatus(jobId, interval = 5000, maxAttempts = 12) {
  let attempts = 0;
  let lastStatus = null;
  let stuckInScraping = false;
  
  const statusCheck = async () => {
    try {
      // Get CSRF token from dynamic config
      const csrfToken = window.AGENT_SMITH_CONFIG?.csrfToken || '';
      
      const response = await fetch(`/api/job-status/${jobId}`, {
        method: 'GET',
        headers: {
          'X-Website-Secret': window.AGENT_SMITH_CONFIG?.websiteFormSecret || '',
          'X-CSRF-Token': csrfToken || '',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to check job status');
      }
      
      // Update status display
      updateJobStatusDisplay(data);
      
      // Track if we're stuck in scraping
      if (data.status === 'scraping') {
        if (lastStatus === 'scraping') {
          stuckInScraping = true;
        }
      } else {
        stuckInScraping = false;
      }
      
      lastStatus = data.status;
      
      // Continue polling if job is still in progress
      attempts++;
      if (data.status !== 'completed' && data.status !== 'failed' && attempts < maxAttempts) {
        setTimeout(statusCheck, interval);
      } else if (stuckInScraping && attempts >= maxAttempts) {
        // Do one final check after a longer timeout if we appear stuck in scraping
        console.log('Job appears stuck in scraping status, will perform one final check in 10 seconds');
        setTimeout(statusCheck, 10000);
      }
      
    } catch (error) {
      console.error('Job status check error:', error);
      // Continue polling despite errors
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(statusCheck, interval);
      }
    }
  };
  
  // Start polling
  setTimeout(statusCheck, interval);
}

// Update the job status display
function updateJobStatusDisplay(jobData) {
  const statusContainer = document.getElementById('job-status');
  if (!statusContainer) return;
  
  let statusClass = 'status-' + jobData.status;
  let statusMessage = '';
  
  switch (jobData.status) {
    case 'pending':
      statusMessage = 'Your request is in the queue...';
      break;
    case 'scraping':
      statusMessage = 'Researching your company website...';
      break;
    case 'generating':
      statusMessage = 'Crafting your personalized email...';
      break;
    case 'completed':
      statusMessage = 'Your email has been generated and sent to our team!';
      break;
    case 'failed':
      statusMessage = 'There was an issue processing your request. Our team has been notified.';
      break;
    default:
      statusMessage = 'Processing your request...';
  }
  
  statusContainer.innerHTML = `
    <div class="job-status ${statusClass}">
      <div class="status-icon"></div>
      <div class="status-message">${statusMessage}</div>
      <div class="status-details">${jobData.status} - Job ID: ${jobData.jobId}</div>
    </div>
  `;
}

// Display status messages
function showStatus(type, message) {
  const statusContainer = document.getElementById('form-status');
  if (!statusContainer) return;
  
  statusContainer.innerHTML = message;
  statusContainer.className = `form-status status-${type}`;
}

// Email validation helper
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Check if email is from a common free provider
function isPersonalEmail(email) {
  const domain = email.split('@')[1].toLowerCase();
  const personalDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'yandex.com',
    'gmx.com', 'live.com', 'me.com', 'inbox.com', 'mail.ru'
  ];
  
  return personalDomains.includes(domain);
}

// Initialize form handlers when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize signup form
  setupSignupForm();
});