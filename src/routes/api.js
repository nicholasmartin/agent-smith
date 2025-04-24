/**
 * API Routes for Agent Smith
 * 
 * This module contains all routes related to the API endpoints for job processing.
 */

const express = require('express');
const router = express.Router();
const emailProcessor = require('../emailProcessor');
const jobStore = require('../jobStore');
const processJobs = require('../../api/cron/process-jobs');
const supabase = require('../supabaseClient');
const crypto = require('crypto');

// Import middleware
const { validateApiKey, validateWebsiteSecret } = require('../middleware/validation');

// Form configuration endpoint - provides necessary client-side configuration
router.get('/form-config', (req, res) => {
  // Generate a random CSRF token - no session dependency
  const csrfToken = crypto.randomBytes(16).toString('hex');
  
  // Return the configuration
  res.json({
    websiteFormSecret: process.env.WEBSITE_FORM_SECRET || '',
    csrfToken: csrfToken
  });
  
  console.log('Form config endpoint called successfully');
});

// Set auth cookie endpoint - sets authentication cookies from Supabase tokens
router.post('/set-auth-cookie', (req, res) => {
  try {
    const { access_token, refresh_token } = req.body;
    
    if (!access_token) {
      return res.status(400).json({ error: 'Missing access_token' });
    }
    
    // Debug: Check environment variables
    console.log('[AUTH] Environment variables check:');
    console.log('[AUTH] SUPABASE_URL:', !!process.env.SUPABASE_URL);
    console.log('[AUTH] SUPABASE_ANON_KEY:', !!process.env.SUPABASE_ANON_KEY);
    console.log('[AUTH] SUPABASE_SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Set the access token as a cookie
    res.cookie('sb-access-token', access_token, {
      maxAge: 3600 * 1000, // 1 hour
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' // Important for auth redirects
    });
    
    // Set the refresh token as a cookie if provided
    if (refresh_token) {
      res.cookie('sb-refresh-token', refresh_token, {
        maxAge: 30 * 24 * 3600 * 1000, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    }
    
    // Also set the Supabase-specific cookie format
    const projectRef = 'jnpdszffuosiirapfvwp';
    const cookieName = `sb-${projectRef}-auth-token`;
    const sessionData = JSON.stringify({
      access_token,
      refresh_token
    });
    
    res.cookie(cookieName, sessionData, {
      maxAge: 3600 * 1000, // 1 hour
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    console.log('[AUTH] Set auth cookies successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('[AUTH] Error setting auth cookies:', error);
    res.status(500).json({ error: 'Failed to set auth cookies' });
  }
});

// Debug endpoint to check environment variables
router.get('/debug-env', (req, res) => {
  try {
    // Check required environment variables
    const requiredVars = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];
    
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    // Log the check but don't expose actual values
    console.log('[DEBUG] Environment variable check:');
    requiredVars.forEach(varName => {
      console.log(`[DEBUG] ${varName}: ${!!process.env[varName]}`);
    });
    
    res.json({
      success: missingVars.length === 0,
      missingVars,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('[DEBUG] Error checking environment variables:', error);
    res.status(500).json({ error: 'Failed to check environment variables' });
  }
});

// Debug endpoint to check authentication status
router.get('/debug-auth', async (req, res) => {
  try {
    console.log('[DEBUG] Checking server-side authentication');
    console.log('[DEBUG] Available cookies:', Object.keys(req.cookies || {}));
    
    // Extract JWT from request
    const jwt = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.substring(7)
      : req.cookies['sb-access-token'] || null;
    
    if (!jwt) {
      console.log('[DEBUG] No JWT found in request');
      return res.json({
        authenticated: false,
        message: 'No JWT token found',
        cookies: Object.keys(req.cookies || {})
      });
    }
    
    // Check authentication with Supabase
    const { data, error } = await req.supabase.auth.getUser();
    
    if (error) {
      console.log('[DEBUG] Authentication error:', error.message);
      return res.json({
        authenticated: false,
        message: error.message,
        error: error.message
      });
    }
    
    if (!data || !data.user) {
      console.log('[DEBUG] No user data returned');
      return res.json({
        authenticated: false,
        message: 'No user data returned',
        data
      });
    }
    
    // User is authenticated
    console.log('[DEBUG] User authenticated successfully:', data.user.email);
    return res.json({
      authenticated: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at
      }
    });
  } catch (error) {
    console.error('[DEBUG] Error checking authentication:', error);
    res.status(500).json({
      authenticated: false,
      message: 'Server error checking authentication',
      error: error.message
    });
  }
});

// Website form submission endpoint with special protection
router.post('/website-signup', validateWebsiteSecret, async (req, res) => {
  console.log(`[Server] ENTER /api/website-signup handler. Request ID (if available): ${req.headers['x-vercel-id'] || 'N/A'}`); // Log entry
  try {
    const { email, firstName, lastName } = req.body;
    
    // Validate required fields
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ 
        error: 'Email, first name, and last name are required',
        missingFields: !email ? 'email' : !firstName ? 'firstName' : 'lastName'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Check for business email (no free providers)
    const domain = email.split('@')[1].toLowerCase();
    const personalDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
      'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'yandex.com',
      'gmx.com', 'live.com', 'me.com', 'inbox.com', 'mail.ru'
    ];
    
    if (personalDomains.includes(domain)) {
      return res.status(400).json({ error: 'Please use your business email address' });
    }
    
    // Get Agent Smith company for website submissions
    const { data: agentSmithCompany, error: companyError } = await supabase
      .from('companies')
      .select('id, default_api_key_id')
      .eq('slug', 'agent-smith')
      .eq('active', true)
      .single();
    
    if (companyError || !agentSmithCompany) {
      console.error('Error finding Agent Smith company:', companyError);
      return res.status(500).json({ error: 'Error processing website submission' });
    }
    
    // Create a new trial record
    const { data: trial, error: trialError } = await supabase
      .from('trials')
      .insert({
        first_name: firstName,
        last_name: lastName,
        email: email,
        has_registered: false
      })
      .select()
      .single();
    
    if (trialError) {
      console.error('Error creating trial record:', trialError);
      return res.status(500).json({ error: 'Error creating trial record' });
    }
    
    console.log(`[Server] Created trial record for ${firstName} ${lastName} (${email})`);
    
    // Process the signup with Agent Smith company info
    const jobInfo = await emailProcessor.processSignup(
      email, 
      `${firstName} ${lastName}`, 
      agentSmithCompany.default_api_key_id,
      agentSmithCompany.id,
      true, // fromWebsite flag
      trial.id // Pass the trial ID
    );
    
    // Update the trial record with the job ID
    const { error: updateError } = await supabase
      .from('trials')
      .update({ job_id: jobInfo.jobId })
      .eq('id', trial.id);
    
    if (updateError) {
      console.error('Error updating trial record with job ID:', updateError);
      // Continue anyway since the trial record was created
    }
    
    console.log(`[Server] Website form submission processed, Job ID: ${jobInfo.jobId}, Trial ID: ${trial.id}`);
    
    // Return job information to the client
    return res.status(202).json({ 
      message: 'Signup received and being processed',
      email,
      firstName,
      lastName,
      jobId: jobInfo.jobId,
      trialId: trial.id,
      status: jobInfo.status
    });
  } catch (error) {
    console.error('Website form submission error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Combined job status endpoint that handles both website form security and API key validation
// This middleware will check for either a valid website secret or a valid API key
const validateWebsiteSecretOrApiKey = async (req, res, next) => {
  // First check for website secret
  const websiteSecret = req.headers['x-website-secret'];
  const expectedSecret = process.env.WEBSITE_FORM_SECRET;
  
  if (websiteSecret && websiteSecret === expectedSecret) {
    // Valid website secret
    return next();
  }
  
  // If no valid website secret, check for API key
  const apiKey = req.headers['x-api-key'];
  const masterApiKey = process.env.API_KEY;
  const endpoint = req.path.split('/')[1]; // Extract endpoint from path
  
  // Check master API key
  if (apiKey && apiKey === masterApiKey) {
    // Admin key has full access
    req.company = {
      id: null,
      name: 'System Administrator',
      slug: 'admin'
    };
    return next();
  }
  
  // Check secure API key
  try {
    if (apiKey) {
      // Use keyManager to validate the API key
      const apiInfo = await keyManager.validateApiKey(apiKey, endpoint);
      
      if (apiInfo) {
        // Valid API key
        req.company = {
          id: apiInfo.companyId,
          name: apiInfo.companyName,
          slug: apiInfo.companySlug,
          keyId: apiInfo.keyId
        };
        return next();
      }
    }
    
    // If we get here, neither validation passed
    return res.status(401).json({ error: 'Unauthorized: Invalid credentials' });
  } catch (error) {
    console.error('Error validating credentials:', error);
    return res.status(500).json({ error: 'Error validating credentials' });
  }
};

// Job status endpoint with combined validation
router.get('/job-status/:jobId', validateWebsiteSecretOrApiKey, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }
    
    // Get job status from database
    const job = await jobStore.getJobById(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Return job status information
    return res.status(200).json({
      jobId: job.id,
      status: job.status,
      email: job.email,
      domain: job.domain,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at,
      // Include additional info from emailProcessor if available
      ...(await emailProcessor.checkJobStatus(jobId))
    });
  } catch (error) {
    console.error('Job status check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Cron job endpoint
router.all('/cron/process-jobs', processJobs);

// Get jobs by status endpoint
router.get('/jobs/status/:status', validateApiKey, async (req, res) => {
  try {
    const { status } = req.params;
    const { limit } = req.query;
    
    const jobs = await emailProcessor.getJobsByStatus(status, parseInt(limit) || 20);
    
    return res.status(200).json({
      jobs,
      count: jobs.length,
      status
    });
  } catch (error) {
    console.error(`Error getting jobs with status ${req.params.status}:`, error);
    return res.status(500).json({ error: 'Error getting jobs by status' });
  }
});

// Main API endpoint with API key validation
router.post('/process-signup', validateApiKey, async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }
    
    // Use the company info from the middleware
    const company = req.company;
    console.log(`[Server] Processing signup for company: ${company.name}`);
    
    // Start the signup processing and get job info
    const jobInfo = await emailProcessor.processSignup(email, name, company.keyId, company.id);
    console.log(`[Server] Job created with ID: ${jobInfo.jobId}, Company ID: ${company.id}, Key ID: ${company.keyId}`);
    
    // Return job information to the client
    return res.status(202).json({ 
      message: 'Signup received and being processed',
      email,
      name,
      jobId: jobInfo.jobId,
      scrapeJobId: jobInfo.scrapeJobId,
      status: jobInfo.status
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all active jobs with API key validation
router.get('/jobs', validateApiKey, async (req, res) => {
  try {
    const activeJobs = await emailProcessor.getActiveJobs();
    return res.status(200).json({
      activeJobs,
      count: activeJobs.length
    });
  } catch (error) {
    console.error('Error getting active jobs:', error);
    return res.status(500).json({ error: 'Error getting active jobs' });
  }
});

// Get company information
router.get('/companies/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Get company data from database
    const { data: company, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();
    
    if (error) {
      console.error('Error fetching company:', error);
      return res.status(500).json({ error: 'Error fetching company data' });
    }
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    return res.status(200).json(company);
  } catch (error) {
    console.error('Error in company endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get company jobs
router.get('/companies/:companyId/jobs', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Get company jobs from database
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching company jobs:', error);
      return res.status(500).json({ error: 'Error fetching company jobs' });
    }
    
    return res.status(200).json({ jobs });
  } catch (error) {
    console.error('Error in company jobs endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// The job status endpoint has been combined with the one above

// Job retry endpoint
router.post('/job/:jobId/retry', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }
    
    // Get the job
    const job = await jobStore.getJobById(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Reset job status and retry count
    const updatedJob = await jobStore.updateJob(jobId, {
      status: 'pending',
      retry_count: 0,
      error_message: null,
      updated_at: new Date()
    });
    
    console.log(`[API] Job ${jobId} queued for retry`);
    
    return res.status(200).json({
      message: 'Job queued for retry',
      job: updatedJob
    });
  } catch (error) {
    console.error('Error retrying job:', error);
    return res.status(500).json({ error: 'Error retrying job' });
  }
});

// Process completed jobs that need emails sent
router.post('/process-emails', validateApiKey, async (req, res) => {
  try {
    console.log('[API] Processing completed jobs that need emails sent');
    
    // Process completed jobs
    const result = await emailProcessor.processCompletedJobs();
    
    return res.status(200).json({
      message: 'Processed completed jobs',
      ...result
    });
  } catch (error) {
    console.error('Error processing completed jobs:', error);
    return res.status(500).json({ error: 'Error processing completed jobs' });
  }
});

module.exports = router;
