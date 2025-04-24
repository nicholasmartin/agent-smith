// Test endpoint to check external API connectivity
const axios = require('axios');
const https = require('https');

module.exports = async (req, res) => {
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
          resolve({ status: res.statusCode, data: JSON.parse(data) });
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
    const dns = require('dns');
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
};
