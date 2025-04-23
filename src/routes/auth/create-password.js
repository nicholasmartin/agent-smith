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

router.post('/create-password', async (req, res) => {
  try {
    const { email, password, jobId } = req.body;
    
    if (!email || !password || !jobId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Verify job exists and belongs to this email
    const job = await getJobById(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Create the user with password
    const userData = await createUserWithPassword(email, password, {
      name: job.name || email.split('@')[0],
      source: 'agent_smith'
    });
    
    res.status(200).json({ success: true, user: userData.user });
    
  } catch (error) {
    console.error('[AUTH] Password creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
