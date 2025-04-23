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
  
  // Store in the global config
  window.AGENT_SMITH_CONFIG.supabaseUrl = supabaseUrl;
  window.AGENT_SMITH_CONFIG.supabaseAnonKey = supabaseAnonKey;
  
  // Add a helper method to get the Supabase client
  window.AGENT_SMITH_CONFIG.getSupabaseClient = function() {
    if (typeof supabase === 'undefined') {
      console.error('Supabase library not loaded');
      return null;
    }
    
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      console.error('Supabase configuration not found');
      return null;
    }
    
    console.log('Creating Supabase client with URL:', this.supabaseUrl);
    return supabase.createClient(this.supabaseUrl, this.supabaseAnonKey);
  };
  
  // Log configuration status
  console.log('Config loaded:', {
    supabaseUrl: supabaseUrl ? 'Found' : 'Missing',
    supabaseAnonKey: supabaseAnonKey ? 'Found' : 'Missing'
  });
})();
