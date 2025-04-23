/**
 * Password Authentication Module for Agent Smith
 * 
 * This module provides a centralized place for handling password authentication.
 */

const supabase = require('../supabaseClient');

/**
 * Create a user account with email and password
 * 
 * @param {string} email - User's email address
 * @param {string} password - User's chosen password
 * @param {Object} metadata - Additional user data
 * @returns {Promise<Object>} Result of the operation
 */
async function createUserWithPassword(email, password, metadata = {}) {
  console.log(`[AUTH] Creating user account for: ${email}`);
  
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email
    user_metadata: metadata
  });
  
  if (error) {
    console.error(`[AUTH] Error creating user: ${error.message}`);
    throw error;
  }
  
  console.log(`[AUTH] User account created successfully for: ${email}`);
  return data;
}

/**
 * Generate a password creation link
 * 
 * @param {string} email - User's email address
 * @param {string} jobId - ID of the job
 * @returns {string} URL for password creation
 */
function generatePasswordCreationLink(email, jobId) {
  // Create a secure link to the password creation page
  const baseUrl = process.env.BASE_URL || 'https://agent-smith.magloft.com';
  const encodedEmail = encodeURIComponent(email);
  const encodedJobId = encodeURIComponent(jobId);
  
  return `${baseUrl}/create-password?email=${encodedEmail}&job_id=${encodedJobId}`;
}

/**
 * Sign in a user with email and password
 * 
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {Promise<Object>} Result of the operation
 */
async function signInWithPassword(email, password) {
  console.log(`[AUTH] Signing in user: ${email}`);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    console.error(`[AUTH] Sign in error: ${error.message}`);
    throw error;
  }
  
  console.log(`[AUTH] User signed in successfully: ${email}`);
  return data;
}

module.exports = {
  createUserWithPassword,
  generatePasswordCreationLink,
  signInWithPassword
};
