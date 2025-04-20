const slackNotifier = require('./slackNotifier');
const FireCrawlApp = require('@mendable/firecrawl-js').default;
const { z } = require('zod');

/**
 * Start a website scraping job using Firecrawl API
 * @param {string} domain - Domain to scrape
 * @returns {Object} Job information including ID and status
 */
async function startScrapeJob(domain) {
  try {
    const websiteUrl = `https://${domain}`;
    
    // Initialize FireCrawl SDK
    const app = new FireCrawlApp({
      apiKey: process.env.FIRECRAWL_API_KEY
    });

    // Define schema for extraction
    const schema = z.object({
      overview: z.string(),
      summary: z.string(),
      company_name: z.string().optional(),
      services: z.array(z.string()).optional(),
      products: z.array(z.string()).optional(),
      contact_title: z.string().optional()
    });

    console.log(`Starting extraction for domain: ${domain}`);
    
    // Add more detailed logging before the API call
    console.log('About to call Firecrawl asyncExtract API...');
    console.log('API Key length:', process.env.FIRECRAWL_API_KEY ? process.env.FIRECRAWL_API_KEY.length : 'API key not found');
    console.log('Target URL:', `https://${domain}/`);
    
    try {
      // Start the extraction process
      console.log('Calling asyncExtract...');
      const extractJob = await app.asyncExtract(
        [`https://${domain}/`],
        {
          prompt: "Draft a 200-word max overview of the website. Provide a short paragraph that summarizes the homepage. Extract the company name, a list of services, and a list of products they provide.",
          schema
        }
      );
      console.log('asyncExtract call completed successfully');

      // Debug log to see the structure of the response
      console.log('Extract job response type:', typeof extractJob);
      console.log('Extract job response keys:', extractJob ? Object.keys(extractJob) : 'No keys (null or undefined)');
      console.log('Extract job response full object:', extractJob);
      
      try {
        console.log('Extract job response JSON:', JSON.stringify(extractJob, null, 2));
      } catch (e) {
        console.log('Could not stringify extract job response:', e.message);
      }
      
      // Extract the job ID - check different possible structures
      let jobId;
      if (extractJob && extractJob.jobId) {
        jobId = extractJob.jobId;
      } else if (extractJob && extractJob.id) {
        jobId = extractJob.id;
      } else if (typeof extractJob === 'string') {
        jobId = extractJob;
      } else {
        console.log('Unable to determine job ID from response:', extractJob);
        throw new Error('Failed to get extraction job ID');
      }
      
      console.log(`Extraction started with ID: ${jobId}`);
      
      // Return job information immediately without waiting for completion
      return {
        status: 'processing',
        jobId: jobId,
        domain: domain,
        url: websiteUrl,
        startTime: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error during asyncExtract call:');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      if (error.response) {
        console.error('API Response error data:', error.response.data);
        console.error('API Response error status:', error.response.status);
      }
      
      // Rethrow the error to be handled by the outer try/catch
      throw error;
    }
  } catch (error) {
    console.error(`Error scraping website for ${domain}:`, error);
    
    // Notify team about scraping failure via Slack
    try {
      await notifyScrapingFailure(domain, error.message);
    } catch (slackError) {
      console.error('Failed to send Slack notification:', slackError);
    }
    
    // Return a minimal object in case of failure
    return {
      url: `https://${domain}`,
      companyName: formatDomainAsCompanyName(domain),
      error: error.message,
      scrapingFailed: true
    };
  }
}

/**
 * Notify team about scraping failure via Slack
 */
async function notifyScrapingFailure(domain, errorMessage) {
  try {
    // Remove Slack notification for failures
    // Use the dedicated function in slackNotifier for scraping failures
    // await slackNotifier.sendScrapingFailureToSlack(domain, errorMessage);
    console.log(`[WebScraper] Scraping failure for ${domain}: ${errorMessage}`);
  } catch (error) {
    console.error('Failed to log scraping failure:', error);
  }
}

/**
 * Wait for FireCrawl extraction to complete
 * @param {Object} app - FireCrawl app instance
 * @param {string} extractionId - ID of the extraction job
 * @param {number} timeoutSeconds - Maximum time to wait in seconds
 * @returns {Object|null} - Extraction result or null if timed out
 */
async function waitForExtraction(app, extractionId, timeoutSeconds = 120) {
  const startTime = Date.now();
  const timeoutMs = timeoutSeconds * 1000;
  
  // Check status every 5 seconds
  const checkInterval = 5000;
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      console.log(`Checking extraction status for ID: ${extractionId}`);
      
      // Add more detailed logging for debugging
      try {
        const status = await app.getExtractStatus(extractionId);
        
        console.log('Status response type:', typeof status);
        console.log('Status response keys:', status ? Object.keys(status) : 'No keys (null or undefined)');
        console.log('Status response:', status);
        
        // Handle different possible response formats
        if (status && status.status === 'completed') {
          console.log('Extraction completed successfully');
          
          // Check different result formats
          let result;
          if (status.result) {
            result = status.result;
          } else if (status.data) {
            result = status.data;
          } else if (status.results && status.results.length > 0) {
            result = status.results[0].data;
          }
          
          console.log('Extraction result:', result);
          return result;
        } else if (status && status.status === 'failed') {
          const errorMsg = status.error || 'Unknown error';
          console.error('Extraction failed:', errorMsg);
          throw new Error(`Extraction failed: ${errorMsg}`);
        } else {
          console.log('Extraction in progress or unknown status:', status);
        }
      } catch (error) {
        console.error('Error checking extraction status:', error);
        // Continue the loop instead of immediately throwing
        console.log('Will retry after interval...');
      }
      
      console.log(`Waiting ${checkInterval/1000} seconds before checking again...`);
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    } catch (error) {
      console.error('Error checking extraction status:', error);
      throw error;
    }
  }
  
  console.error(`Extraction timed out after ${timeoutSeconds} seconds`);
  return null;
}

/**
 * Extract company name from scraped data or format from domain
 */
function extractCompanyName(data, domain) {
  // Try to get company name from scraping result if available
  if (data.companyName) {
    return data.companyName;
  }
  
  // Otherwise format from domain
  return formatDomainAsCompanyName(domain);
}

/**
 * Format domain as company name
 */
function formatDomainAsCompanyName(domain) {
  // Extract first part of domain and capitalize it
  const name = domain.split('.')[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Extract list of services from scraped data
 */
function extractServices(data) {
  // Return services list if available in the scraping result
  if (data.services && Array.isArray(data.services)) {
    return data.services;
  }
  
  // Return empty array if no services found
  return [];
}

/**
 * Check the status of a scraping job
 * @param {string} jobId - ID of the extraction job
 * @returns {Object} Job status and result if completed
 */
async function checkScrapeJobStatus(jobId) {
  try {
    // Initialize FireCrawl SDK
    const app = new FireCrawlApp({
      apiKey: process.env.FIRECRAWL_API_KEY
    });
    
    console.log(`Checking status for job ID: ${jobId}`);
    const status = await app.getExtractStatus(jobId);
    
    console.log('Status response:', status);
    
    if (!status) {
      return { status: 'error', message: 'Failed to get status' };
    }
    
    if (status.status === 'completed') {
      // Get the result data
      let result;
      if (status.result) {
        result = status.result;
      } else if (status.data) {
        result = status.data;
      } else if (status.output) {
        result = status.output;
      }
      
      if (!result) {
        return { status: 'error', message: 'Extraction completed but no result found' };
      }
      
      // Format the result
      return {
        status: 'completed',
        result: {
          companyName: result.company_name || '',
          pageText: result.overview || '',
          summary: result.summary || '',
          services: result.services || [],
          products: result.products || [],
          contactTitle: result.contact_title || ''
        }
      };
    } else if (status.status === 'failed') {
      return { status: 'failed', message: status.error || 'Extraction failed' };
    } else {
      return { status: 'processing' };
    }
  } catch (error) {
    console.error(`Error checking job status for ${jobId}:`, error);
    return { status: 'error', message: error.message };
  }
}

/**
 * Complete the scraping process and format the results
 * @param {string} domain - Domain that was scraped
 * @param {Object} extractResult - Result from the extraction
 * @returns {Object} Formatted website data
 */
async function formatScrapeResult(domain, extractResult) {
  const websiteUrl = `https://${domain}/`;
  
  return {
    url: websiteUrl,
    companyName: extractResult.companyName || formatDomainAsCompanyName(domain),
    pageText: extractResult.pageText || '',
    summary: extractResult.summary || '',
    services: extractResult.services || [],
    products: extractResult.products || [],
    contactTitle: extractResult.contactTitle || ''
  };
}

module.exports = {
  startScrapeJob,
  checkScrapeJobStatus,
  formatScrapeResult,
  notifyScrapingFailure
};
