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
  
  // Generate magic link according to Supabase documentation format
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: email,
    options: {
      // Use direct dashboard URL - client-side code will handle the auth
      redirectTo: 'https://agent-smith.magloft.com/dashboard',
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
  
  // Get the original link
  let signInLink = data.properties.action_link;
  console.log(`[AUTH] Original magic link: ${signInLink}`);
  
  // Verify the link is not null or undefined
  if (!signInLink) {
    console.error(`[AUTH] Magic link is null or undefined`);
    throw new Error('Magic link is null or undefined');
  }
  
  // Ensure the link has the required verification type parameter
  // This fixes the "Verify requires a verification type" error
  if (signInLink.includes('/verify?') && !signInLink.includes('&type=magiclink')) {
    // Add the type parameter if it's missing
    signInLink = signInLink.replace('/verify?', '/verify?type=magiclink&');
  } else if (signInLink.includes('/verify?') && !signInLink.includes('type=')) {
    // Add the type parameter if no type parameter exists
    signInLink += '&type=magiclink';
  }
  
  console.log(`[AUTH] Modified magic link: ${signInLink}`);
  console.log(`[AUTH] Magic link generated successfully for ${email}`);
  
  
  return signInLink;
}

module.exports = {
  generateMagicLink
};
