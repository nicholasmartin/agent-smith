const domainChecker = require('./domainChecker');
const webScraper = require('./webScraper');
const emailGenerator = require('./emailGenerator');
const slackNotifier = require('./slackNotifier');

// Store active jobs in memory (in a production environment, this would be in a database)
const activeJobs = {};

/**
 * Process a new signup by checking the domain and starting the scraping job
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @returns {Object} Job information
 */
async function processSignup(email, name) {
  try {
    // Step 1: Check if it's a business domain
    const { isDomainFree, domain } = domainChecker.checkDomain(email);
    
    // If it's a free email provider, ignore and return
    if (isDomainFree) {
      console.log(`Skipping free email provider: ${email}`);
      return { status: 'skipped', reason: 'free email provider' };
    }
    
    // Step 2: Start the website scraping job
    console.log(`Starting scrape job for domain: ${domain}`);
    const jobInfo = await webScraper.startScrapeJob(domain);
    
    // Store the job information along with user details
    const jobData = {
      jobId: jobInfo.jobId,
      status: jobInfo.status,
      domain,
      email,
      name,
      startTime: new Date().toISOString()
    };
    
    // Store job in memory
    activeJobs[jobInfo.jobId] = jobData;
    
    // Start background polling for this job
    startJobPolling(jobInfo.jobId);
    
    console.log(`Scrape job started with ID: ${jobInfo.jobId} for ${email}`);
    
    return {
      status: 'processing',
      jobId: jobInfo.jobId,
      email,
      domain
    };
  } catch (error) {
    console.error(`Error starting processing for ${email}:`, error);
    throw error;
  }
}

/**
 * Check the status of a processing job and complete it if ready
 * @param {string} jobId - The job ID to check
 * @returns {Object} Current status and results if complete
 */
async function checkJobStatus(jobId, email, name, domain) {
  try {
    // Check the status of the scraping job
    const jobStatus = await webScraper.checkScrapeJobStatus(jobId);
    
    // If still processing, return status
    if (jobStatus.status === 'processing') {
      return { status: 'processing', jobId };
    }
    
    // If there was an error or it failed, notify about the failure
    if (jobStatus.status === 'error' || jobStatus.status === 'failed') {
      await webScraper.notifyScrapingFailure(domain, jobStatus.message || 'Unknown error');
      return { 
        status: 'failed', 
        jobId,
        error: jobStatus.message || 'Unknown error'
      };
    }
    
    // If completed, process the results
    if (jobStatus.status === 'completed' && jobStatus.result) {
      // Format the website data
      const websiteData = await webScraper.formatScrapeResult(domain, jobStatus.result);
      
      // Generate personalized email
      console.log(`Generating email for: ${name} at ${domain}`);
      const emailDraft = await emailGenerator.generateEmail(name, email, domain, websiteData);
      
      // Send to Slack
      console.log(`Sending notification to Slack for: ${email}`);
      await slackNotifier.sendToSlack(name, email, domain, emailDraft, websiteData);
      
      return {
        status: 'completed',
        email,
        domain,
        emailDraft
      };
    }
    
    // Fallback for unexpected status
    return { status: 'unknown', jobId };
  } catch (error) {
    console.error(`Error checking job status for ${jobId}:`, error);
    return { status: 'error', error: error.message };
  }
}

/**
 * Start polling for job status in the background
 * @param {string} jobId - The job ID to poll for
 */
function startJobPolling(jobId) {
  const pollingInterval = 10000; // 10 seconds
  const maxAttempts = 30; // 5 minutes total (30 * 10 seconds)
  let attempts = 0;
  
  console.log(`Starting background polling for job ${jobId}`);
  
  const poll = async () => {
    if (!activeJobs[jobId]) {
      console.log(`Job ${jobId} no longer active, stopping polling`);
      return;
    }
    
    attempts++;
    if (attempts > maxAttempts) {
      console.log(`Max polling attempts reached for job ${jobId}, marking as timed out`);
      activeJobs[jobId].status = 'timed_out';
      return;
    }
    
    try {
      const jobData = activeJobs[jobId];
      const status = await checkJobStatus(jobId, jobData.email, jobData.name, jobData.domain);
      
      // If job is no longer processing, we can stop polling
      if (status.status !== 'processing') {
        console.log(`Job ${jobId} completed with status: ${status.status}`);
        delete activeJobs[jobId]; // Remove from active jobs
      } else {
        // Schedule next poll
        setTimeout(poll, pollingInterval);
      }
    } catch (error) {
      console.error(`Error polling job ${jobId}:`, error);
      // Schedule next poll despite error
      setTimeout(poll, pollingInterval);
    }
  };
  
  // Start polling after a short delay
  setTimeout(poll, 5000);
}

/**
 * Get all active jobs
 * @returns {Object} Map of active jobs
 */
function getActiveJobs() {
  return { ...activeJobs };
}

module.exports = {
  processSignup,
  checkJobStatus,
  getActiveJobs
};
