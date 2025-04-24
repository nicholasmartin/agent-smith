/**
 * Dashboard Page JavaScript
 * 
 * Handles dashboard functionality, including authentication checks,
 * user data loading, and client-side routing.
 */

import { supabaseClient, getUser, signOut } from './supabase-browser';

// Initialize the dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check if we're on the dashboard page
  if (!document.querySelector('.dashboard-container')) {
    return;
  }
  
  // Check authentication first
  checkAuth();
  
  // Set up event listeners for navigation
  setupNavigation();
  
  // Handle the initial route
  handleRouteChange();
  
  // Load user data
  loadUserData();
  
  // Add event listener for logout
  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', async (e) => {
      e.preventDefault();
      await signOut();
      window.location.href = '/login.html';
    });
  }
});

/**
 * Check authentication status and redirect if not authenticated
 */
async function checkAuth() {
  try {
    console.log('[DASHBOARD] Checking authentication...');
    const session = await getSession();
    
    if (!session) {
      console.warn('[DASHBOARD] No authentication found, redirecting to login');
      window.location.href = '/login.html';
    }
  } catch (error) {
    console.error('[DASHBOARD] Error checking authentication:', error);
    // On error, stay on the dashboard and let the server handle any redirects
  }
}

/**
 * Get the current session
 */
async function getSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

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
 * Handle route changes for client-side navigation
 */
function handleRouteChange() {
  const path = window.location.pathname;
  
  // Handle dashboard routes
  if (path === '/dashboard' || path === '/dashboard/') {
    // Show main dashboard
    // Hide any specific sections
    showMainDashboard();
  } else if (path.startsWith('/dashboard/')) {
    // Handle sub-routes
    const subPath = path.replace('/dashboard/', '');
    handleDynamicRoute(subPath);
  }
}

/**
 * Navigate to a specific path
 * @param {string} path - The path to navigate to
 */
function navigateTo(path) {
  history.pushState({}, '', path);
  handleRouteChange();
}

/**
 * Handle dynamic routes like company-specific pages
 * @param {string} subPath - The sub-path after /dashboard/
 */
function handleDynamicRoute(subPath) {
  // Handle specific routes like /dashboard/company/123
  if (subPath.startsWith('company/')) {
    const companyId = subPath.replace('company/', '').split('/')[0];
    const section = subPath.split('/')[2] || 'overview';
    
    loadCompanyData(companyId, section);
  } else {
    // Default to main dashboard for unknown routes
    showMainDashboard();
  }
}

/**
 * Load user data for the dashboard
 */
async function loadUserData() {
  try {
    console.log('[DASHBOARD] Loading user data');
    
    // Get the current user
    const user = await getUser();
    
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
    const { data: jobs, error } = await supabaseClient
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    updateJobsTable(jobs || []);
    updateJobCounts(jobs || []);
  } catch (error) {
    console.error('[DASHBOARD] Error loading jobs:', error);
  }
}

/**
 * Show the main dashboard view
 */
function showMainDashboard() {
  // Implement logic to show the main dashboard
  // and hide any specific sections
  const sections = document.querySelectorAll('.dashboard-section');
  sections.forEach(section => {
    if (section.id === 'main-dashboard') {
      section.style.display = 'block';
    } else {
      section.style.display = 'none';
    }
  });
}

/**
 * Update the jobs table with the provided jobs
 * @param {Array} jobs - The jobs to display
 */
function updateJobsTable(jobs) {
  const tableBody = document.querySelector('#jobs-table tbody');
  if (!tableBody) return;
  
  tableBody.innerHTML = '';
  
  if (jobs.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="5" class="text-center py-4">No jobs found</td>`;
    tableBody.appendChild(row);
    return;
  }
  
  jobs.forEach(job => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="py-2 px-4">${job.company_name || '-'}</td>
      <td class="py-2 px-4">${job.status || 'pending'}</td>
      <td class="py-2 px-4">${formatDate(job.created_at)}</td>
      <td class="py-2 px-4">
        <button class="view-btn bg-blue-500 text-white px-3 py-1 rounded" data-id="${job.id}">View</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
  
  // Add event listeners to view buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const jobId = e.target.getAttribute('data-id');
      navigateTo(`/dashboard/job/${jobId}`);
    });
  });
}

/**
 * Update job counts based on status
 * @param {Array} jobs - The jobs to count
 */
function updateJobCounts(jobs = []) {
  const pendingCount = document.getElementById('pending-count');
  const completedCount = document.getElementById('completed-count');
  const totalCount = document.getElementById('total-count');
  
  if (pendingCount) {
    pendingCount.textContent = jobs.filter(job => job.status === 'pending').length;
  }
  
  if (completedCount) {
    completedCount.textContent = jobs.filter(job => job.status === 'completed').length;
  }
  
  if (totalCount) {
    totalCount.textContent = jobs.length;
  }
}

/**
 * Format a date string
 * @param {string} dateString - The date string to format
 * @returns {string} - The formatted date
 */
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString();
}
