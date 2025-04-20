/**
 * TailAdmin Main JavaScript
 * Handles dashboard interactions and UI functionality
 */

// Initialize Alpine.js components
document.addEventListener('alpine:init', () => {
  // Define Alpine.js data and methods as needed
});

// Handle sidebar toggle on mobile
document.addEventListener('DOMContentLoaded', function() {
  // Initialize dashboard components
  initDashboard();
  
  // Handle logout clicks
  document.querySelectorAll('#logout-link, #dropdown-logout').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      
      try {
        await window.supabase.auth.signOut();
        window.location.href = '/login.html';
      } catch (error) {
        console.error('Error signing out:', error);
      }
    });
  });
  
  // Initialize form handlers
  initFormHandlers();
});

// Dashboard initialization
function initDashboard() {
  // Load user jobs
  loadUserJobs();
  
  // Load user profile
  loadUserProfile();
  
  // Update user info in header
  updateUserInfo();
  
  // Update job statistics
  updateJobStats();
}

// Load user jobs from API
async function loadUserJobs() {
  const jobsContainer = document.querySelector('#jobs-list');
  if (!jobsContainer) return;
  
  try {
    // Get session
    const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Authentication required');
    }
    
    // Show loading state
    jobsContainer.innerHTML = `
      <tr>
        <td colspan="4" class="py-4 text-center">
          <div class="flex justify-center">
            <svg class="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </td>
      </tr>
    `;
    
    // Fetch jobs from API
    const response = await fetch('/api/user/jobs', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    const { jobs } = await response.json();
    
    if (!jobs || jobs.length === 0) {
      jobsContainer.innerHTML = `
        <tr>
          <td colspan="4" class="py-4 text-center">
            <p class="text-gray-500">No jobs found. Submit a new request to get started.</p>
          </td>
        </tr>
      `;
      return;
    }
    
    // Sort jobs by created_at (newest first)
    jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Clear container
    jobsContainer.innerHTML = '';
    
    // Add jobs to table
    jobs.forEach(job => {
      const row = document.createElement('tr');
      row.className = 'border-b border-gray-200 hover:bg-gray-50';
      
      // Format date
      const createdDate = new Date(job.created_at);
      const formattedDate = createdDate.toLocaleDateString() + ' ' + 
                           createdDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      
      // Determine status class
      let statusClass = '';
      let statusText = job.status;
      
      switch (job.status) {
        case 'pending':
          statusClass = 'bg-yellow-100 text-yellow-800';
          statusText = 'Pending';
          break;
        case 'scraping':
          statusClass = 'bg-blue-100 text-blue-800';
          statusText = 'Scraping';
          break;
        case 'generating_email':
          statusClass = 'bg-purple-100 text-purple-800';
          statusText = 'Generating';
          break;
        case 'completed':
          statusClass = 'bg-green-100 text-green-800';
          statusText = 'Completed';
          break;
        case 'failed':
          statusClass = 'bg-red-100 text-red-800';
          statusText = 'Failed';
          break;
        default:
          statusClass = 'bg-gray-100 text-gray-800';
      }
      
      // Determine action button based on job status
      let actionButton = '';
      
      if (job.status === 'completed' && job.email_draft) {
        actionButton = `
          <button data-job-id="${job.id}" class="view-email-btn rounded-lg bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
            View Email
          </button>
        `;
      } else if (job.status === 'failed') {
        actionButton = `
          <button data-job-id="${job.id}" class="retry-job-btn rounded-lg bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100">
            Retry
          </button>
        `;
      } else {
        actionButton = `
          <span class="text-xs text-gray-500">No action available</span>
        `;
      }
      
      // Create row content
      row.innerHTML = `
        <td class="py-4 px-4">
          <h5 class="font-medium text-black">${job.domain || 'N/A'}</h5>
        </td>
        <td class="py-4 px-4">
          <p class="text-sm text-gray-600">${formattedDate}</p>
        </td>
        <td class="py-4 px-4">
          <span class="inline-block rounded-full ${statusClass} px-2.5 py-0.5 text-xs font-medium">
            ${statusText}
          </span>
        </td>
        <td class="py-4 px-4">
          ${actionButton}
        </td>
      `;
      
      jobsContainer.appendChild(row);
    });
    
    // Add event listeners to view email buttons
    document.querySelectorAll('.view-email-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const jobId = btn.getAttribute('data-job-id');
        const job = jobs.find(j => j.id === jobId);
        
        if (job && job.email_draft) {
          showEmailModal(job);
        }
      });
    });
    
    // Add event listeners to retry buttons
    document.querySelectorAll('.retry-job-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const jobId = btn.getAttribute('data-job-id');
        await retryJob(jobId);
      });
    });
    
    // Update job statistics
    updateJobStats(jobs);
    
  } catch (error) {
    console.error('Error loading jobs:', error);
    
    if (jobsContainer) {
      jobsContainer.innerHTML = `
        <tr>
          <td colspan="4" class="py-4 text-center">
            <p class="text-red-500">Error loading jobs: ${error.message}</p>
          </td>
        </tr>
      `;
    }
    
    // Redirect to login if authentication error
    if (error.message.includes('Authentication')) {
      window.location.href = '/login.html';
    }
  }
}

// Load user profile data
async function loadUserProfile() {
  try {
    const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
    if (sessionError || !session) return;
    
    const response = await fetch('/api/user/profile', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    
    if (!response.ok) return;
    
    const data = await response.json();
    
    // Update profile form if it exists
    const nameInput = document.getElementById('profile-name');
    const emailInput = document.getElementById('profile-email');
    
    if (nameInput) nameInput.value = data.profile.name || '';
    if (emailInput) emailInput.value = data.user.email || '';
    
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

// Update user info in header
async function updateUserInfo() {
  try {
    const { data: { user } } = await window.supabase.auth.getUser();
    if (!user) return;
    
    // Update user name elements
    document.querySelectorAll('.user-name').forEach(el => {
      el.textContent = user.user_metadata?.name || user.email;
    });
    
    // Update user email elements
    document.querySelectorAll('.user-email').forEach(el => {
      el.textContent = user.email;
    });
    
    // Update user initials
    document.querySelectorAll('.user-initials').forEach(el => {
      const name = user.user_metadata?.name || user.email;
      const initials = name.split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
      
      el.textContent = initials;
    });
  } catch (error) {
    console.error('Error updating user info:', error);
  }
}

// Update job statistics
async function updateJobStats(jobs) {
  try {
    // If jobs not provided, fetch them
    if (!jobs) {
      const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
      if (sessionError || !session) return;
      
      const response = await fetch('/api/user/jobs', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) return;
      
      const result = await response.json();
      jobs = result.jobs;
    }
    
    if (!jobs) return;
    
    // Count jobs by status
    const counts = {
      total: jobs.length,
      completed: 0,
      pending: 0,
      failed: 0
    };
    
    jobs.forEach(job => {
      if (job.status === 'completed') {
        counts.completed++;
      } else if (job.status === 'failed') {
        counts.failed++;
      } else {
        counts.pending++;
      }
    });
    
    // Update count elements
    const totalElement = document.getElementById('total-jobs-count');
    const completedElement = document.getElementById('completed-jobs-count');
    const pendingElement = document.getElementById('pending-jobs-count');
    const failedElement = document.getElementById('failed-jobs-count');
    
    if (totalElement) totalElement.textContent = counts.total;
    if (completedElement) completedElement.textContent = counts.completed;
    if (pendingElement) pendingElement.textContent = counts.pending;
    if (failedElement) failedElement.textContent = counts.failed;
    
  } catch (error) {
    console.error('Error updating job stats:', error);
  }
}

// Show email content in a modal
function showEmailModal(job) {
  // Parse email draft if it's a string
  const emailDraft = typeof job.email_draft === 'string' 
    ? JSON.parse(job.email_draft) 
    : job.email_draft;
  
  // Create modal element if it doesn't exist
  let modal = document.getElementById('email-modal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'email-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
    document.body.appendChild(modal);
  }
  
  // Set modal content
  modal.innerHTML = `
    <div class="relative w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
      <button id="close-modal" class="absolute right-4 top-4 text-gray-500 hover:text-gray-700">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      <h3 class="mb-4 text-xl font-semibold text-gray-900">Personalized Email for ${job.domain}</h3>
      
      <div class="mb-4 rounded-md border border-gray-200 bg-gray-50 p-4">
        <p class="mb-2 font-medium">Subject: ${emailDraft.subject || 'Your Personalized Email'}</p>
        <div class="prose max-w-none text-gray-700">${emailDraft.content || emailDraft}</div>
      </div>
      
      <div class="flex justify-end space-x-3">
        <button id="copy-email" class="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
          Copy to Clipboard
        </button>
        <button id="close-button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Close
        </button>
      </div>
    </div>
  `;
  
  // Show the modal
  modal.classList.remove('hidden');
  
  // Add event listeners
  document.getElementById('close-modal').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  
  document.getElementById('close-button').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  
  document.getElementById('copy-email').addEventListener('click', () => {
    const emailText = `Subject: ${emailDraft.subject || 'Your Personalized Email'}\n\n${emailDraft.content || emailDraft}`;
    navigator.clipboard.writeText(emailText)
      .then(() => {
        const copyBtn = document.getElementById('copy-email');
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.remove('bg-gray-100', 'text-gray-700');
        copyBtn.classList.add('bg-green-100', 'text-green-700');
        
        setTimeout(() => {
          copyBtn.textContent = 'Copy to Clipboard';
          copyBtn.classList.remove('bg-green-100', 'text-green-700');
          copyBtn.classList.add('bg-gray-100', 'text-gray-700');
        }, 2000);
      })
      .catch(err => {
        console.error('Could not copy text: ', err);
      });
  });
}

// Retry a failed job
async function retryJob(jobId) {
  try {
    const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Authentication required');
    }
    
    const response = await fetch(`/api/job/${jobId}/retry`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    // Reload jobs after successful retry
    loadUserJobs();
    
  } catch (error) {
    console.error('Error retrying job:', error);
    alert(`Error retrying job: ${error.message}`);
  }
}

// Initialize form handlers
function initFormHandlers() {
  // Update profile handler
  const updateProfileBtn = document.getElementById('update-profile-btn');
  if (updateProfileBtn) {
    updateProfileBtn.addEventListener('click', async () => {
      const nameInput = document.getElementById('profile-name');
      const statusEl = document.getElementById('profile-status');
      
      try {
        statusEl.textContent = 'Updating profile...';
        statusEl.className = 'rounded-md bg-blue-50 p-4 text-blue-700';
        statusEl.classList.remove('hidden');
        
        const { data: { session } } = await window.supabase.auth.getSession();
        
        const response = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            name: nameInput.value
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        statusEl.textContent = 'Profile updated successfully!';
        statusEl.className = 'rounded-md bg-green-50 p-4 text-green-700';
        
        // Update new request form with updated name
        const newNameInput = document.getElementById('new-name');
        if (newNameInput) newNameInput.value = nameInput.value;
        
        // Update user name in header
        updateUserInfo();
        
      } catch (error) {
        console.error('Error updating profile:', error);
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.className = 'rounded-md bg-red-50 p-4 text-red-700';
      }
    });
  }
  
  // Submit new request handler
  const submitRequestBtn = document.getElementById('submit-request-btn');
  if (submitRequestBtn) {
    submitRequestBtn.addEventListener('click', async () => {
      const nameInput = document.getElementById('new-name');
      const emailInput = document.getElementById('new-email');
      const statusEl = document.getElementById('request-status');
      
      try {
        statusEl.textContent = 'Submitting request...';
        statusEl.className = 'rounded-md bg-blue-50 p-4 text-blue-700';
        statusEl.classList.remove('hidden');
        
        // Get website form secret from config
        const configResponse = await fetch('/js/config.js');
        const configText = await configResponse.text();
        const websiteSecret = configText.match(/WEBSITE_FORM_SECRET\s*=\s*['"]([^'"]+)['"]/);
        
        if (!websiteSecret || !websiteSecret[1]) {
          throw new Error('Could not retrieve form configuration');
        }
        
        // Submit request to website form endpoint
        const response = await fetch('/api/website-signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Website-Secret': websiteSecret[1]
          },
          body: JSON.stringify({
            name: nameInput.value,
            email: emailInput.value
          })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Error submitting request');
        }
        
        statusEl.textContent = 'Request submitted successfully! Your personalized email will be delivered soon.';
        statusEl.className = 'rounded-md bg-green-50 p-4 text-green-700';
        
        // Refresh jobs tab after a delay
        setTimeout(() => {
          // Navigate to dashboard
          document.querySelector('.menu-item a[href="index.html"]')?.click();
          // Reload jobs
          loadUserJobs();
        }, 2000);
        
      } catch (error) {
        console.error('Error submitting request:', error);
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.className = 'rounded-md bg-red-50 p-4 text-red-700';
      }
    });
  }
}
