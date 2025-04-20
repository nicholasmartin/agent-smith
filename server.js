require('dotenv').config();
const express = require('express');
const axios = require('axios');
const https = require('https');
const dns = require('dns');
const crypto = require('crypto');
const path = require('path');
const FireCrawlApp = require('@mendable/firecrawl-js').default;
const { z } = require('zod');
const emailProcessor = require('./src/emailProcessor');
const jobStore = require('./src/jobStore');
const processJobs = require('./api/cron/process-jobs');
const supabase = require('./src/supabaseClient');
const keyManager = require('./src/keyManager');
const { createServerSupabaseClient } = require('@supabase/auth-helpers-nextjs');

const app = express();

// Trust proxy - needed for express-rate-limit behind proxies like Vercel
app.set('trust proxy', 1);

app.use(express.json());

// Add Content-Security-Policy headers
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://*.fontawesome.com https://kit.fontawesome.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://jnpdszffuosiirapfvwp.supabase.co https://*.supabase.co wss://*.supabase.co"
  );
  next();
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve dashboard page for both /dashboard and /dashboard/* routes
app.get('/dashboard*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Serve confirmation page for authentication verification
app.get('/confirm*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'confirm.html'));
});

// Rate limiter middleware for API endpoints
const apiLimiter = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' }
});

// More strict rate limiter for website form submissions
const formLimiter = require('express-rate-limit')({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 form submissions per hour
  message: { error: 'Too many form submissions, please try again later' }
});

// Website form secret validation middleware
const validateWebsiteSecret = (req, res, next) => {
  const websiteSecret = req.headers['x-website-secret'];
  const expectedSecret = process.env.WEBSITE_FORM_SECRET;
  
  if (!websiteSecret || websiteSecret !== expectedSecret) {
    return res.status(403).json({ error: 'Invalid website form secret' });
  }
  
  next();
};

// API key validation middleware
const validateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const masterApiKey = process.env.API_KEY;
  const endpoint = req.path.split('/')[1]; // Extract endpoint from path
  
  // First check if it matches the master API key from environment variables (for backward compatibility during transition)
  if (apiKey && apiKey === masterApiKey) {
    // Admin key has full access
    req.company = {
      id: null,
      name: 'System Administrator',
      slug: 'admin'
    };
    next();
    return;
  }
  
  // Check if it's a valid secure API key in the new system
  try {
    if (apiKey) {
      // Use keyManager to validate the API key
      const apiInfo = await keyManager.validateApiKey(apiKey, endpoint);
      
      if (apiInfo) {
        // Valid API key
        console.log(`Request authenticated for company: ${apiInfo.companyName}`);
        
        // Add company info to request for downstream use
        req.company = {
          id: apiInfo.companyId,
          name: apiInfo.companyName,
          slug: apiInfo.companySlug,
          keyId: apiInfo.keyId
        };
        
        next();
        return;
      }
    }
    
    // If we get here, the API key is invalid
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  } catch (error) {
    console.error('Error validating API key:', error);
    return res.status(500).json({ error: 'Error validating API key' });
  }
};

// Website form submission endpoint with special protection
app.post('/api/website-signup', formLimiter, validateWebsiteSecret, async (req, res) => {
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

// User dashboard endpoints with authentication

// Get user profile
app.get('/api/user/profile', async (req, res) => {
  // Create Supabase client with context from request
  const supabaseServerClient = createServerSupabaseClient({ req, res });
  
  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseServerClient.auth.getUser();
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Get user profile
    const { data: profile, error: profileError } = await supabaseServerClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
      
    if (profileError) {
      return res.status(500).json({ error: 'Error retrieving profile' });
    }
    
    return res.status(200).json({ 
      profile,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Error in user profile endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
app.put('/api/user/profile', async (req, res) => {
  // Create Supabase client with context from request
  const supabaseServerClient = createServerSupabaseClient({ req, res });
  
  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseServerClient.auth.getUser();
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Get profile data from request
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Update profile
    const { data: profile, error: profileError } = await supabaseServerClient
      .from('profiles')
      .update({ 
        name,
        updated_at: new Date()
      })
      .eq('id', user.id)
      .select()
      .single();
      
    if (profileError) {
      return res.status(500).json({ error: 'Error updating profile' });
    }
    
    return res.status(200).json({ profile });
  } catch (error) {
    console.error('Error in update profile endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user jobs
app.get('/api/user/jobs', async (req, res) => {
  // Create Supabase client with context from request
  const supabaseServerClient = createServerSupabaseClient({ req, res });
  
  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseServerClient.auth.getUser();
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Get user's jobs
    const { data: jobs, error: jobsError } = await supabaseServerClient
      .from('jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
      
    if (jobsError) {
      return res.status(500).json({ error: 'Error retrieving jobs' });
    }
    
    return res.status(200).json({ jobs });
  } catch (error) {
    console.error('Error in user jobs endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Job status endpoint with website form security
app.get('/api/job-status/:jobId', validateWebsiteSecret, async (req, res) => {
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
      completedAt: job.completed_at
    });
  } catch (error) {
    console.error('Job status check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve the WEBSITE_FORM_SECRET as a JavaScript variable
// This keeps the secret on the server but makes it available to the client
app.get('/js/config.js', (req, res) => {
  // Set the content type to JavaScript
  res.setHeader('Content-Type', 'application/javascript');
  
  // Set cache control headers to prevent caching of this file
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Generate a random nonce for added security (prevents script injection)
  const nonce = crypto.randomBytes(16).toString('base64');
  
  // Create JavaScript that sets the WEBSITE_FORM_SECRET
  const js = `
    // Configuration for Agent Smith website
    // Generated at: ${new Date().toISOString()}
    window.AGENT_SMITH_CONFIG = {
      websiteFormSecret: "${process.env.WEBSITE_FORM_SECRET || ''}",
      csrfToken: "${nonce}" // Using the nonce as a CSRF token
    };
  `;
  
  res.send(js);
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Agent Smith API is running');
});

// Cron job endpoint
app.all('/api/cron/process-jobs', processJobs);

// Get jobs by status endpoint
app.get('/api/jobs/status/:status', validateApiKey, async (req, res) => {
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
app.post('/api/process-signup', validateApiKey, async (req, res) => {
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
app.get('/api/jobs', validateApiKey, async (req, res) => {
  try {
    const activeJobs = await emailProcessor.getActiveJobs();
    return res.status(200).json({
      activeJobs,
      count: Object.keys(activeJobs).length
    });
  } catch (error) {
    console.error('Error getting active jobs:', error);
    return res.status(500).json({ error: 'Error getting active jobs' });
  }
});

// Job status endpoint with API key validation
app.get('/api/job-status/:jobId', validateApiKey, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }
    
    // Check the job status
    const statusInfo = await emailProcessor.checkJobStatus(jobId);
    
    return res.status(200).json(statusInfo);
  } catch (error) {
    console.error('Error checking job status:', error);
    return res.status(500).json({ error: 'Error checking job status' });
  }
});

// Connectivity test endpoint
app.get('/api/test-connectivity', async (req, res) => {
  console.log('Starting connectivity test...');
  const results = {
    tests: [],
    timestamp: new Date().toISOString()
  };

  // Test 1: Basic HTTPS request
  try {
    console.log('Testing with native HTTPS module...');
    const httpsResult = await new Promise((resolve, reject) => {
      const req = https.get('https://httpbin.org/get', (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, data: data, parseError: e.message });
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      // Set a timeout for the request
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });
    });
    
    console.log('HTTPS test result:', httpsResult.status);
    results.tests.push({
      name: 'HTTPS Module',
      success: true,
      status: httpsResult.status,
      message: 'Successfully connected to httpbin.org'
    });
  } catch (error) {
    console.error('HTTPS test failed:', error.message);
    results.tests.push({
      name: 'HTTPS Module',
      success: false,
      error: error.message
    });
  }

  // Test 2: Axios request
  try {
    console.log('Testing with Axios...');
    const axiosResult = await axios.get('https://httpbin.org/get', { timeout: 5000 });
    console.log('Axios test result:', axiosResult.status);
    results.tests.push({
      name: 'Axios',
      success: true,
      status: axiosResult.status,
      message: 'Successfully connected to httpbin.org'
    });
  } catch (error) {
    console.error('Axios test failed:', error.message);
    results.tests.push({
      name: 'Axios',
      success: false,
      error: error.message
    });
  }

  // Test 3: Try to connect to Firecrawl API (without making an actual extraction)
  try {
    console.log('Testing connection to Firecrawl API...');
    // Just make a simple HEAD request to check connectivity
    const firecrawlResult = await axios.head('https://api.firecrawl.dev', {
      timeout: 5000,
      headers: {
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
      }
    });
    console.log('Firecrawl API test result:', firecrawlResult.status);
    results.tests.push({
      name: 'Firecrawl API',
      success: true,
      status: firecrawlResult.status,
      message: 'Successfully connected to Firecrawl API'
    });
  } catch (error) {
    console.error('Firecrawl API test failed:', error.message);
    results.tests.push({
      name: 'Firecrawl API',
      success: false,
      error: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null
    });
  }

  // Test 4: DNS resolution test
  try {
    console.log('Testing DNS resolution...');
    const domains = ['api.firecrawl.dev', 'httpbin.org', 'google.com'];
    const dnsResults = {};
    
    for (const domain of domains) {
      try {
        const addresses = await new Promise((resolve, reject) => {
          dns.resolve4(domain, (err, addresses) => {
            if (err) reject(err);
            else resolve(addresses);
          });
        });
        dnsResults[domain] = { success: true, addresses };
      } catch (error) {
        dnsResults[domain] = { success: false, error: error.message };
      }
    }
    
    results.tests.push({
      name: 'DNS Resolution',
      success: true,
      results: dnsResults
    });
  } catch (error) {
    console.error('DNS test failed:', error.message);
    results.tests.push({
      name: 'DNS Resolution',
      success: false,
      error: error.message
    });
  }

  // Test 5: Environment variables check
  results.tests.push({
    name: 'Environment Variables',
    success: true,
    results: {
      FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY ? 
        `Present (length: ${process.env.FIRECRAWL_API_KEY.length})` : 'Missing',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Present' : 'Missing',
      SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL ? 'Present' : 'Missing',
      API_KEY: process.env.API_KEY ? 'Present' : 'Missing',
      NODE_ENV: process.env.NODE_ENV || 'Not set'
    }
  });

  // Return all test results
  console.log('All connectivity tests completed');
  return res.status(200).json(results);
});

// Firecrawl SDK test endpoint
app.get('/api/test-firecrawl', async (req, res) => {
  console.log('Starting Firecrawl SDK test...');
  
  try {
    // Initialize FireCrawl SDK with API key
    console.log('Initializing FireCrawl SDK...');
    const app = new FireCrawlApp({
      apiKey: process.env.FIRECRAWL_API_KEY
    });
    console.log('FireCrawl SDK initialized');
    
    // Define a simple schema for extraction
    const schema = z.object({
      title: z.string()
    });
    
    // Test domain
    const testDomain = 'example.com';
    console.log(`Testing extraction for domain: ${testDomain}`);
    
    // Log the API key length for debugging
    console.log('API Key length:', process.env.FIRECRAWL_API_KEY ? process.env.FIRECRAWL_API_KEY.length : 'API key not found');
    
    // Attempt a simple extraction
    console.log('Starting simple extraction...');
    try {
      const extractJob = await app.asyncExtract(
        [`https://${testDomain}/`],
        {
          prompt: "Extract the title of the webpage",
          schema
        }
      );
      
      console.log('Extract job response:', extractJob);
      
      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Firecrawl SDK extraction test successful',
        extractJob
      });
    } catch (extractError) {
      console.error('Error during extraction:', extractError);
      return res.status(500).json({
        success: false,
        message: 'Firecrawl SDK extraction test failed',
        error: {
          name: extractError.name,
          message: extractError.message,
          stack: extractError.stack,
          response: extractError.response ? {
            status: extractError.response.status,
            data: extractError.response.data
          } : null
        }
      });
    }
  } catch (error) {
    console.error('General error in test-firecrawl:', error);
    return res.status(500).json({
      success: false,
      message: 'General error in Firecrawl SDK test',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });
  }
});

// Only start the server if this file is run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
