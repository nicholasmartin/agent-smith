/**
 * Create Password Route Handler for Agent Smith
 * 
 * This route handler processes password creation requests for new users.
 * It verifies the job exists and belongs to the email before creating the user.
 */

const express = require('express');
const router = express.Router();
const { createUserWithPassword } = require('../../auth/passwordAuth');
const { getJobById } = require('../../jobStore');

// Make sure we're using the correct route path
router.post('/', async (req, res) => {
  console.log('[AUTH] Received password creation request');
  try {
    const { email, password, jobId } = req.body;
    console.log(`[AUTH] Processing password creation for email: ${email}, jobId: ${jobId}`);
    
    if (!email || !password || !jobId) {
      console.log('[AUTH] Missing required fields in request');
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Verify job exists and belongs to this email
    console.log(`[AUTH] Fetching job with ID: ${jobId}`);
    let job;
    try {
      job = await getJobById(jobId);
      console.log(`[AUTH] Job fetch result: ${job ? 'Found' : 'Not found'}`);
    } catch (jobError) {
      console.error(`[AUTH] Error fetching job: ${jobError.message}`);
      return res.status(500).json({ error: `Error fetching job: ${jobError.message}` });
    }
    
    if (!job) {
      console.log(`[AUTH] Job not found with ID: ${jobId}`);
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Create or update the user with password
    try {
      console.log(`[AUTH] Creating/updating user account for: ${email}`);
      
      const userData = await createUserWithPassword(email, password, {
        name: job.name || email.split('@')[0],
        source: 'agent_smith',
        job_id: jobId
      });
      
      // If we get here, the user was either created or updated successfully
      console.log(`[AUTH] User account operation successful for: ${email}`);
      
      return res.status(200).json({ 
        success: true, 
        user: userData.user,
        message: 'Password set successfully' 
      });
    } catch (error) {
      console.error(`[AUTH] Error in user creation/update: ${error.message}`);
      
      // Handle specific error cases
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        return res.status(409).json({ 
          error: 'A user with this email already exists. Please try signing in with your password.',
          code: 'user_exists'
        });
      } else if (error.message.includes('password')) {
        return res.status(400).json({ 
          error: 'Password does not meet requirements. Please use at least 6 characters.',
          code: 'invalid_password'
        });
      }
      
      return res.status(500).json({ 
        error: `Error creating/updating user: ${error.message}`,
        code: 'user_creation_error'
      });
    }
    
  } catch (error) {
    console.error('[AUTH] Password creation error:', error);
    // Provide more detailed error information
    const errorResponse = {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      code: error.code || 'unknown_error'
    };
    res.status(500).json(errorResponse);
  }
});

module.exports = router;
