/**
 * Form Configuration Loader for Agent Smith
 * This file loads the form configuration from the server
 */

// Initialize the form configuration
(function() {
  // Function to fetch configuration from the server
  async function fetchFormConfig() {
    try {
      const response = await fetch('/api/form-config');
      if (!response.ok) {
        throw new Error('Failed to load form configuration');
      }
      
      const config = await response.json();
      
      // Store in the global config
      window.AGENT_SMITH_CONFIG = window.AGENT_SMITH_CONFIG || {};
      window.AGENT_SMITH_CONFIG.websiteFormSecret = config.websiteFormSecret;
      window.AGENT_SMITH_CONFIG.csrfToken = config.csrfToken;
      
      console.log('Form config loaded successfully');
      return true;
    } catch (error) {
      console.error('Error loading form configuration:', error);
      return false;
    }
  }
  
  // Load the configuration when the page loads
  window.addEventListener('DOMContentLoaded', fetchFormConfig);
})();
