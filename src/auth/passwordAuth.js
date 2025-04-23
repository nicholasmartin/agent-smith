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
  
  // Check if user already exists
  try {
    const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email);
    
    if (existingUser) {
      console.log(`[AUTH] User already exists for email: ${email}, updating password`);
      
      // Update existing user's password
      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password: password, user_metadata: metadata }
      );
      
      if (updateError) {
        console.error(`[AUTH] Error updating user: ${updateError.message}`);
        throw updateError;
      }
      
      console.log(`[AUTH] User password updated successfully for: ${email}`);
      return updatedUser;
    }
  } catch (checkError) {
    // If error is not related to user not found, rethrow it
    if (!checkError.message.includes('not found')) {
      throw checkError;
    }
    // Otherwise continue with user creation
    console.log(`[AUTH] User does not exist, creating new account`);
  }
  
  // Create new user
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
