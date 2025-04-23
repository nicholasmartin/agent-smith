/**
 * Magic Link Generator for Agent Smith
 * 
 * This module provides a centralized place for generating magic links,
 * ensuring consistent parameters and preventing duplicate token generation.
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
  
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: email,
    options: {
      // Use hardcoded production URL to ensure consistency
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
  
  // Extract the sign-in link from the properties
  const signInLink = data.properties.action_link;
  console.log(`[AUTH] Magic link generated successfully for ${email}`);
  
  return signInLink;
}

module.exports = {
  generateMagicLink
};
