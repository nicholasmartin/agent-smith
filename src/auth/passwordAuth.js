/**
 * Password Authentication Module for Agent Smith
 * 
 * This module provides a centralized place for handling password authentication.
 */

const { createClient } = require('@supabase/supabase-js');

// Create a Supabase client with the service role key for admin operations
const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Regular client for non-admin operations
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
  
  try {
    // First, check if the user already exists using admin API
    console.log(`[AUTH] Checking if user exists: ${email}`);
    
    // Use listUsers to find a user by email (since getUserByEmail doesn't exist)
    const { data, error: listError } = await adminSupabase.auth.admin.listUsers();
    
    if (listError) {
      console.error(`[AUTH] Error listing users: ${listError.message}`);
      throw listError;
    }
    
    // According to the docs, users are in data.users
    console.log(`[AUTH] Found ${data?.users?.length || 0} users`);
    
    // Find the user with matching email
    const existingUser = data?.users?.find(user => 
      user.email && user.email.toLowerCase() === email.toLowerCase()
    );
    
    if (existingUser) {
      console.log(`[AUTH] User already exists, updating password: ${email}`);
      
      // User exists, update their password
      const { data: updatedUser, error: updateError } = await adminSupabase.auth.admin.updateUserById(
        existingUser.id,
        { 
          password,
          user_metadata: metadata
        }
      );
      
      if (updateError) {
        console.error(`[AUTH] Error updating user: ${updateError.message}`);
        throw updateError;
      }
      
      console.log(`[AUTH] User password updated successfully: ${email}`);
      return updatedUser;
    } else {
      // User doesn't exist, create a new one
      console.log(`[AUTH] User doesn't exist, creating new account: ${email}`);
      
      const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata
      });
      
      if (createError) {
        console.error(`[AUTH] Error creating user: ${createError.message}`);
        throw createError;
      }
      
      console.log(`[AUTH] User created successfully: ${email}`);
      return newUser;
    }
  } catch (error) {
    console.error(`[AUTH] Error in user management: ${error.message}`);
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
