/**
 * Dashboard Client-Side Routing
 * 
 * This script handles client-side routing for the dashboard application,
 * allowing for a single-page application experience with clean URLs.
 */

// Initialize the dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check if we're on the dashboard page
  if (!document.querySelector('.dashboard-container')) {
    return;
  }
  
  // Set up event listeners for navigation
  setupNavigation();
  
  // Handle the initial route
  handleRouteChange();
  
  // Load user data
  loadUserData();
});

/**
 * Set up event listeners for navigation links
 */
function setupNavigation() {
  // Set up navigation event listeners
  window.addEventListener('popstate', handleRouteChange);
  
  // Add click handlers to all dashboard navigation links
  document.querySelectorAll('.dashboard-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const path = e.target.getAttribute('href');
      navigateTo(path);
    });
  });
  
  // Also handle links in the sidebar
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const path = e.target.getAttribute('href');
      navigateTo(path);
    });
  });
}

/**
 * Handle route changes (both navigation and browser history)
 */
function handleRouteChange() {
  const path = window.location.pathname;
  const subPath = path.replace('/dashboard', '').replace(/^\//, '') || 'home';
  
  console.log('[ROUTER] Handling route change:', subPath);
  
  // Hide all content sections
  document.querySelectorAll('.dashboard-content').forEach(section => {
    section.style.display = 'none';
  });
  
  // Show the relevant section
  const activeSection = document.getElementById(`section-${subPath}`);
  if (activeSection) {
    activeSection.style.display = 'block';
  } else {
    // Handle dynamic routes (e.g., company-specific pages)
    handleDynamicRoute(subPath);
  }
  
  // Update active navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  const activeNav = document.querySelector(`.nav-item[data-route="${subPath}"]`);
  if (activeNav) {
    activeNav.classList.add('active');
  }
}

/**
 * Navigate to a specific path
 * @param {string} path - The path to navigate to
 */
function navigateTo(path) {
  console.log('[ROUTER] Navigating to:', path);
  window.history.pushState({}, '', path);
  handleRouteChange();
}

/**
 * Handle dynamic routes like company-specific pages
 * @param {string} subPath - The sub-path after /dashboard/
 */
function handleDynamicRoute(subPath) {
  // Parse dynamic routes
  const parts = subPath.split('/');
  
  if (parts.length >= 1) {
    const companyId = parts[0];
    const section = parts[1] || 'overview';
    
    console.log('[ROUTER] Dynamic route detected:', companyId, section);
    
    // Load company-specific data
    loadCompanyData(companyId, section);
  }
}

/**
 * Load user data for the dashboard
 */
async function loadUserData() {
  try {
    console.log('[DASHBOARD] Loading user data');
    
    // Get the current user
    const { data: { user }, error } = await window.supabase.auth.getUser();
    
    if (error) {
      console.error('[DASHBOARD] Error getting user:', error);
      return;
    }
    
    if (!user) {
      console.error('[DASHBOARD] No user found');
      return;
    }
    
    // Display user information
    const userNameElement = document.getElementById('user-name');
    const userEmailElement = document.getElementById('user-email');
    
    if (userNameElement) {
      userNameElement.textContent = user.user_metadata?.name || 'User';
    }
    
    if (userEmailElement) {
      userEmailElement.textContent = user.email || '';
    }
    
    // Load user's jobs
    loadUserJobs();
  } catch (error) {
    console.error('[DASHBOARD] Error loading user data:', error);
  }
}

/**
 * Load user's jobs
 */
async function loadUserJobs() {
  try {
    console.log('[DASHBOARD] Loading user jobs');
    
    const response = await fetch('/api/user/jobs');
    
    if (!response.ok) {
      throw new Error(`Error loading jobs: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Update the jobs table
    updateJobsTable(data.jobs || []);
    
    // Update job counts
    updateJobCounts(data.jobs || []);
  } catch (error) {
    console.error('[DASHBOARD] Error loading jobs:', error);
  }
}

/**
 * Load company-specific data
 * @param {string} companyId - The company ID
 * @param {string} section - The section to display
 */
function loadCompanyData(companyId, section) {
  console.log('[DASHBOARD] Loading company data:', companyId, section);
  
  // Create or show the company section
  let companySection = document.getElementById(`section-company-${companyId}`);
  
  if (!companySection) {
    // Create a new section for this company
    companySection = document.createElement('div');
    companySection.id = `section-company-${companyId}`;
    companySection.className = 'dashboard-content';
    
    // Add a loading indicator
    companySection.innerHTML = `
      <h2>Company: ${companyId}</h2>
      <p>Loading company data...</p>
    `;
    
    // Add to the main content area
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.appendChild(companySection);
    }
    
    // Fetch company data from the API
    fetchCompanyData(companyId, companySection);
  }
  
  // Show this section
  companySection.style.display = 'block';
}

/**
 * Fetch company data from the API
 * @param {string} companyId - The company ID
 * @param {HTMLElement} container - The container element
 */
async function fetchCompanyData(companyId, container) {
  try {
    // Fetch company data from the API
    const response = await fetch(`/api/companies/${companyId}`);
    
    if (!response.ok) {
      throw new Error(`Error loading company: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Update the container with company data
    container.innerHTML = `
      <h2>${data.name || 'Company'}</h2>
      <div class="company-details">
        <p><strong>ID:</strong> ${data.id}</p>
        <p><strong>Slug:</strong> ${data.slug || 'N/A'}</p>
        <p><strong>Created:</strong> ${new Date(data.created_at).toLocaleDateString()}</p>
      </div>
      
      <h3>Jobs</h3>
      <div class="company-jobs">
        <p>Loading jobs...</p>
      </div>
    `;
    
    // Fetch company jobs
    fetchCompanyJobs(companyId, container.querySelector('.company-jobs'));
  } catch (error) {
    console.error('[DASHBOARD] Error fetching company data:', error);
    container.innerHTML = `
      <h2>Company: ${companyId}</h2>
      <div class="error-message">
        <p>Error loading company data: ${error.message}</p>
      </div>
    `;
  }
}

/**
 * Fetch company jobs
 * @param {string} companyId - The company ID
 * @param {HTMLElement} container - The container element
 */
async function fetchCompanyJobs(companyId, container) {
  try {
    // Fetch company jobs from the API
    const response = await fetch(`/api/companies/${companyId}/jobs`);
    
    if (!response.ok) {
      throw new Error(`Error loading jobs: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Update the container with jobs data
    if (data.jobs && data.jobs.length > 0) {
      const jobsHtml = data.jobs.map(job => `
        <div class="job-card">
          <div class="job-header">
            <h4>${job.name} (${job.email})</h4>
            <span class="job-status status-${job.status}">${job.status}</span>
          </div>
          <p><strong>Domain:</strong> ${job.domain}</p>
          <p><strong>Created:</strong> ${new Date(job.created_at).toLocaleString()}</p>
          ${job.completed_at ? `<p><strong>Completed:</strong> ${new Date(job.completed_at).toLocaleString()}</p>` : ''}
          ${job.email_draft ? '<div class="email-content">' + (job.email_draft.body || 'No email content') + '</div>' : ''}
        </div>
      `).join('');
      
      container.innerHTML = jobsHtml;
    } else {
      container.innerHTML = '<p>No jobs found for this company.</p>';
    }
  } catch (error) {
    console.error('[DASHBOARD] Error fetching company jobs:', error);
    container.innerHTML = `<p>Error loading jobs: ${error.message}</p>`;
  }
}

/**
 * Update the jobs table with the provided jobs
 * @param {Array} jobs - The jobs to display
 */
function updateJobsTable(jobs) {
  const tableBody = document.querySelector('#jobs-table tbody');
  
  if (!tableBody) {
    console.error('[DASHBOARD] Jobs table not found');
    return;
  }
  
  if (jobs.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5">No jobs found</td></tr>';
    return;
  }
  
  // Sort jobs by created_at (newest first)
  jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  // Limit to the 10 most recent jobs
  const recentJobs = jobs.slice(0, 10);
  
  // Generate table rows
  const rows = recentJobs.map(job => `
    <tr>
      <td>${job.name}</td>
      <td>${job.email}</td>
      <td>${job.domain}</td>
      <td><span class="status-badge status-${job.status}">${job.status}</span></td>
      <td>${new Date(job.created_at).toLocaleString()}</td>
    </tr>
  `).join('');
  
  tableBody.innerHTML = rows;
}

/**
 * Update job counts based on status
 * @param {Array} jobs - The jobs to count
 */
function updateJobCounts(jobs) {
  if (!jobs) return;
  
  // Count jobs by status
  const counts = {
    total: jobs.length,
    pending: jobs.filter(job => job.status === 'pending').length,
    scraping: jobs.filter(job => job.status === 'scraping').length,
    generating_email: jobs.filter(job => job.status === 'generating_email').length,
    completed: jobs.filter(job => job.status === 'completed').length,
    failed: jobs.filter(job => job.status === 'failed').length
  };
  
  // Update count elements
  document.querySelectorAll('[data-count]').forEach(element => {
    const countType = element.getAttribute('data-count');
    if (counts[countType] !== undefined) {
      element.textContent = counts[countType];
    }
  });
}
