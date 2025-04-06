require('dotenv').config();
const express = require('express');
const axios = require('axios');
const https = require('https');
const dns = require('dns');
const path = require('path');
const FireCrawlApp = require('@mendable/firecrawl-js').default;
const { z } = require('zod');
const emailProcessor = require('./src/emailProcessor');
const jobStore = require('./src/jobStore');
const processJobs = require('./api/cron/process-jobs');
const supabase = require('./src/supabaseClient');

const app = express();
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// API key validation middleware
const validateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const masterApiKey = process.env.API_KEY;
  
  // First check if it matches the master API key from environment variables (for backward compatibility)
  if (apiKey && apiKey === masterApiKey) {
    next();
    return;
  }
  
  // If not the master key, check if it's a valid company API key in the database
  try {
    if (apiKey) {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('api_key', apiKey)
        .eq('active', true)
        .single();
      
      if (data && !error) {
        // Valid company API key
        console.log(`Request authenticated for company: ${data.name}`);
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
    
    // Extract API key from headers for multi-tenant support
    const apiKey = req.headers['x-api-key'];
    console.log(`[Server] Processing signup with API key: ${apiKey}`);
    
    // Start the signup processing and get job info
    const jobInfo = await emailProcessor.processSignup(email, name, apiKey);
    console.log(`[Server] Job created with ID: ${jobInfo.jobId}, API key used: ${apiKey}`);
    
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
