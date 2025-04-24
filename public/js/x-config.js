/**
 * Dynamic configuration loader for Agent Smith
 * This file loads configuration values from environment variables or defaults
 */

// Initialize the global configuration object
window.AGENT_SMITH_CONFIG = window.AGENT_SMITH_CONFIG || {};

// Load Supabase configuration
(function() {
  // First try to load from meta tags (preferred method)
  const supabaseUrl = document.querySelector('meta[name="supabase-url"]')?.content;
  const supabaseAnonKey = document.querySelector('meta[name="supabase-anon-key"]')?.content;
  const websiteFormSecret = document.querySelector('meta[name="website-form-secret"]')?.content || 'form-secret-placeholder';
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
  
  // Store in the global config
  window.AGENT_SMITH_CONFIG.supabaseUrl = supabaseUrl;
  window.AGENT_SMITH_CONFIG.supabaseAnonKey = supabaseAnonKey;
  window.AGENT_SMITH_CONFIG.websiteFormSecret = websiteFormSecret;
  window.AGENT_SMITH_CONFIG.csrfToken = csrfToken;
  
  // Add a helper method to get the Supabase client with cookie-based auth
  window.AGENT_SMITH_CONFIG.getSupabaseClient = function() {
    // First check if we have the SSR package for cookie-based auth
    if (typeof supabaseSSR !== 'undefined' && typeof supabaseSSR.createBrowserClient === 'function') {
      if (!this.supabaseUrl || !this.supabaseAnonKey) {
        console.error('Supabase configuration not found');
        return null;
      }
      
      console.log('Creating cookie-based Supabase client with @supabase/ssr');
      return supabaseSSR.createBrowserClient(this.supabaseUrl, this.supabaseAnonKey);
    }
    
    // Fallback to regular client if SSR package not available
    if (typeof supabase === 'undefined') {
      console.error('Supabase library not loaded');
      return null;
    }
    
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      console.error('Supabase configuration not found');
      return null;
    }
    
    console.log('Creating standard Supabase client (fallback):', this.supabaseUrl);
    return supabase.createClient(this.supabaseUrl, this.supabaseAnonKey);
  };
  
  // Log configuration status
  console.log('Config loaded:', {
    supabaseUrl: supabaseUrl ? 'Found' : 'Missing',
    supabaseAnonKey: supabaseAnonKey ? 'Found' : 'Missing'
  });
})();
