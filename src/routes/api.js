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

// Import middleware
const { validateApiKey, validateWebsiteSecret } = require('../middleware/validation');

// Website form submission endpoint with special protection
router.post('/website-signup', validateWebsiteSecret, async (req, res) => {
  console.log(`[Server] ENTER /api/website-signup handler. Request ID (if available): ${req.headers['x-vercel-id'] || 'N/A'}`); // Log entry
  try {
    const { email, name } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
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
    
    // Process the signup with Agent Smith company info
    const jobInfo = await emailProcessor.processSignup(
      email, 
      name, 
      agentSmithCompany.default_api_key_id,
      agentSmithCompany.id,
      true // fromWebsite flag
    );
    
    console.log(`[Server] Website form submission processed, Job ID: ${jobInfo.jobId}`);
    
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
