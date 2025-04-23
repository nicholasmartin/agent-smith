/**
 * Magic Link Generator for Agent Smith
 * 
 * This module provides a centralized place for generating magic links,
 * ensuring consistent parameters and preventing duplicate token generation.
 */

// Use the already initialized Supabase client
const supabase = require('../supabaseClient');

/**
 * Generate a magic link for a user
 * This is the ONLY place in the codebase that should generate magic links
 * 
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @param {Object} options - Additional options
 * @returns {Promise<string>} The magic link URL
 */
async function generateMagicLink(email, name, options = {}) {
  console.log(`[AUTH] Generating magic link for: ${email}`);
  
  try {
    // First, create a sign-in link using the signInWithOtp method
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        // Use a direct dashboard URL
        redirectTo: 'https://agent-smith.magloft.com/dashboard',
        data: {
          name: name,
          source: options.source || 'agent_smith'
        }
      }
    });
    
    if (error) {
      console.error(`[AUTH] Error generating magic link: ${error.message}`);
      throw error;
    }
    
    if (!data || !data.properties || !data.properties.action_link) {
      console.error(`[AUTH] Invalid response structure:`, data);
      throw new Error('Invalid response structure');
    }
    
    const signInLink = data.properties.action_link;
    console.log(`[AUTH] Generated magic link: ${signInLink}`);
    
    return signInLink;
  } catch (error) {
    console.error(`[AUTH] Exception generating magic link: ${error.message}`);
    
    // If magic link generation fails, create a fallback link that will work with client-side auth
    // This is a direct link to the dashboard with instructions to sign in
    const fallbackLink = `https://agent-smith.magloft.com/login?email=${encodeURIComponent(email)}&message=Please%20sign%20in%20to%20access%20your%20dashboard`;
    
    console.log(`[AUTH] Using fallback link: ${fallbackLink}`);
    return fallbackLink;
  }
}

module.exports = {
  generateMagicLink
};
