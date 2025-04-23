/**
 * Magic Link Generator for Agent Smith
 * 
 * This module provides a centralized place for generating magic links,
 * ensuring consistent parameters and preventing duplicate token generation.
 * 
 * Implementation based on official Supabase documentation:
 * https://supabase.com/docs/reference/javascript/auth-admin-generatelink
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
    // Generate magic link according to official Supabase documentation
    // https://supabase.com/docs/reference/javascript/auth-admin-generatelink
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        // Set redirectTo to the auth callback endpoint
        // This is crucial - it must be a route that can handle the authentication
        redirectTo: 'https://agent-smith.magloft.com/auth/callback',
        data: {
          name: name,
          source: options.source || 'agent_smith'
        }
      }
    });
    
    // Log the full response for debugging
    console.log(`[AUTH] Magic link generation response:`, JSON.stringify(data, null, 2));
    
    if (error) {
      console.error(`[AUTH] Error generating magic link: ${error.message}`);
      throw error;
    }
    
    // Extract the sign-in link from the response
    // The Supabase API returns the link in data.properties.action_link
    if (!data || !data.properties || !data.properties.action_link) {
      console.error(`[AUTH] Magic link generation failed: Invalid response structure`, data);
      throw new Error('Invalid magic link response structure');
    }
    
    const signInLink = data.properties.action_link;
    console.log(`[AUTH] Magic link generated successfully: ${signInLink}`);
    
    return signInLink;
  } catch (error) {
    console.error(`[AUTH] Exception generating magic link: ${error.message}`);
    
    // If magic link generation fails, create a fallback link to the login page
    const fallbackLink = `https://agent-smith.magloft.com/login?email=${encodeURIComponent(email)}&error=magic_link_generation_failed`;
    
    console.log(`[AUTH] Using fallback link: ${fallbackLink}`);
    return fallbackLink;
  }
}

module.exports = {
  generateMagicLink
};
