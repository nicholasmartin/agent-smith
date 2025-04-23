const domainChecker = require('./domainChecker');
const webScraper = require('./webScraper');
const emailGenerator = require('./emailGenerator');
const slackNotifier = require('./slackNotifier');
const jobStore = require('./jobStore');
const supabase = require('./supabaseClient');
const emailDelivery = require('./emailDelivery');

/**
 * Process a new signup by checking the domain and starting the scraping job
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @param {string} apiKeyId - API key ID for the enhanced security system
 * @param {string} companyId - Company ID that submitted this request
 * @param {boolean} [fromWebsite=false] - Whether this submission came from the website form
 * @param {string} [trialId=null] - ID of the trial record if from website
 * @returns {Object} Job information
 */
async function processSignup(email, name, apiKeyId, companyId, fromWebsite = false, trialId = null) {
  try {
    console.log(`[EmailProcessor] ENTER processSignup for ${email} (Name: ${name}, API Key ID: ${apiKeyId}, Company ID: ${companyId}, From Website: ${fromWebsite}, Trial ID: ${trialId})`);
    console.log(`[EmailProcessor] Processing signup for ${email} from ${fromWebsite ? 'website form' : 'API'}`);
    
    // Step 1: Check if it's a business domain
    const { isDomainFree, domain } = domainChecker.checkDomain(email);
    
    // If it's a free email provider, ignore and return
    if (isDomainFree) {
      console.log(`Skipping free email provider: ${email}`);
      return { status: 'skipped', reason: 'free email provider' };
    }
    
    // Step 2: Create a job record
    console.log(`Creating job record for ${name} (${email}) from domain ${domain}`);
    
    // Parse the name into first and last name if from website
    let firstName = name;
    let lastName = '';
    
    if (name.includes(' ')) {
      const nameParts = name.split(' ');
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(' ');
    }
    
    const jobData = {
      email, 
      name, 
      domain, 
      apiKeyId,
      companyId, 
      fromWebsite,
      email_sent: false, // Flag to indicate if the final email has been sent
      invitation_pending: fromWebsite, // Set to true for website submissions to trigger invitation email
      metadata: fromWebsite ? {
        first_name: firstName,
        last_name: lastName,
        trial_id: trialId
      } : {}
    };
    
    console.log('[EmailProcessor] Job data before creation:', jobData);
    const job = await jobStore.createJob(jobData);
    
    console.log(`[EmailProcessor] Job created with ID: ${job.id}`);
    
    // Step 3: Start the website scraping job
    console.log(`Starting scrape job for domain: ${domain}`);
    const jobInfo = await webScraper.startScrapeJob(domain);
    
    // Step 4: Update the job record with the scrape job ID
    await jobStore.updateJobWithScrapeId(job.id, jobInfo.jobId);
    
    console.log(`Scrape job started with ID: ${jobInfo.jobId} for ${email}`);
    
    return {
      status: 'processing',
      jobId: job.id,
      scrapeJobId: jobInfo.jobId,
      email,
      domain,
      trialId
    };
  } catch (error) {
    console.error(`Error starting processing for ${email}:`, error);
    throw error;
  }
}

/**
 * Check the status of a processing job and complete it if ready
 * @param {string} jobId - The database job ID to check
 * @returns {Object} Current status and results if complete
 */
async function checkJobStatus(jobId) {
  try {
    // Get the job from the database
    const job = await jobStore.getJobById(jobId);
    
    if (!job) {
      return { status: 'not_found', jobId };
    }
    
    // If job is already completed or failed, return its status
    if (job.status === 'completed' || job.status === 'failed') {
      return {
        status: job.status,
        jobId,
        email: job.email,
        domain: job.domain,
        emailDraft: job.email_draft,
        error: job.error_message
      };
    }
    
    // If job is still in pending or initial state, return status
    if (job.status === 'pending') {
      return { status: 'pending', jobId };
    }
    
    // If job is in scraping state, check the scrape job status
    if (job.status === 'scraping' && job.scrape_job_id) {
      const scrapeStatus = await webScraper.checkScrapeJobStatus(job.scrape_job_id);
      
      // If still processing, return status
      if (scrapeStatus.status === 'processing') {
        return { status: 'processing', jobId };
      }
      
      // If there was an error or it failed, notify about the failure and update job
      if (scrapeStatus.status === 'error' || scrapeStatus.status === 'failed') {
        const errorMessage = scrapeStatus.message || 'Unknown error';
        // Remove Slack notification for failures as well
        // await slackNotifier.sendScrapingFailureToSlack(job.domain, errorMessage);
        await jobStore.markJobAsFailed(jobId, errorMessage);
        
        return { 
          status: 'failed', 
          jobId,
          error: errorMessage
        };
      }
      
      // If completed, process the results
      if (scrapeStatus.status === 'completed' && scrapeStatus.result) {
        // Format the website data
        const websiteData = await webScraper.formatScrapeResult(job.domain, scrapeStatus.result);
        
        // Update job with scrape results
        await jobStore.updateJobWithScrapeResult(jobId, websiteData);
        
        // Generate personalized email
        console.log(`Generating email for: ${job.name} at ${job.domain}`);
        console.log(`[EmailProcessor] Using company ID for template selection: ${job.company_id}`);
        
        // Pass both the API key and company ID to the email generator for reliable template selection
        // The emailGenerator will prioritize company ID over API key
        console.log(`[EmailProcessor] Using company ID for template selection: ${job.company_id}`);
        const emailDraft = await emailGenerator.generateEmail(
          job.name, 
          job.email, 
          job.domain, 
          websiteData, 
          null, // API key no longer needed since we're passing company ID directly
          job.company_id // Pass company ID directly
        );
        
        // Send notification to Slack (optional)
        // await slackNotifier.sendToSlack(job.name, job.email, job.domain, emailDraft, websiteData);
        
        // Determine if this job requires authentication (was it from the website?)
        const requiresAuth = job.from_website === true;
        
        // Send the email with AI content and optional magic link using our centralized delivery
        console.log(`[checkJobStatus] Sending email for: ${job.email} (Auth required: ${requiresAuth})`);
        const emailResult = await emailDelivery.sendJobCompletionEmail(job, emailDraft, requiresAuth);
        
        // Update job as completed with email sent flag
        await jobStore.completeJobWithEmail(jobId, emailDraft, true); // true indicates email was sent
        
        return {
          status: 'completed',
          email: job.email,
          domain: job.domain,
          emailDraft
        };
      }
    }
    
    // If job is in generating_email state, it's being processed by the cron job
    if (job.status === 'generating_email') {
      return { status: 'processing', jobId, message: 'Email is being generated' };
    }
    
    // Fallback for unexpected status
    return { status: job.status || 'unknown', jobId };
  } catch (error) {
    console.error(`Error checking job status for ${jobId}:`, error);
    return { status: 'error', error: error.message };
  }
}

/**
 * Get jobs by status
 * @param {string} status - Job status to filter by
 * @returns {Array} List of jobs with the specified status
 */
async function getJobsByStatus(status) {
  try {
    return await jobStore.getJobsByStatus(status);
  } catch (error) {
    console.error(`Error getting jobs with status ${status}:`, error);
    return [];
  }
}

/**
 * Process completed jobs that need emails sent
 * This function finds jobs that are completed but haven't had emails sent yet,
 * generates magic links, and sends emails using the Resend service.
 * @returns {Object} Processing results
 */
async function processCompletedJobs() {
  try {
    console.log('[EmailProcessor] Processing completed jobs that need emails...');
    
    // Get jobs that are completed but don't have emails sent yet
    const jobs = await jobStore.getJobsByStatusAndEmailSent('completed', false);
    
    if (!jobs || jobs.length === 0) {
      console.log('[EmailProcessor] No completed jobs waiting for emails');
      return { processed: 0 };
    }
    
    console.log(`[EmailProcessor] Found ${jobs.length} completed jobs needing emails`);
    let successCount = 0;
    
    for (const job of jobs) {
      try {
        // Determine if this job requires authentication (was it from the website?)
        const requiresAuth = job.from_website === true;
        
        // Send the email with AI content and optional magic link using our centralized delivery
        console.log(`[processCompletedJobs] Sending email for: ${job.email} (Auth required: ${requiresAuth})`);
        const emailResult = await emailDelivery.sendJobCompletionEmail(job, JSON.parse(job.email_content), requiresAuth);
        
        // No need to update the job here as the emailDelivery module handles this
        
        successCount++;
        console.log(`[EmailProcessor] Successfully sent email for job ${job.id}`);
      } catch (jobError) {
        console.error(`[EmailProcessor] Error processing job ${job.id}:`, jobError);
      }
    }
    
    return { 
      processed: jobs.length,
      success: successCount,
      failed: jobs.length - successCount
    };
  } catch (error) {
    console.error('[EmailProcessor] Error processing completed jobs:', error);
    return { processed: 0, error: error.message };
  }
}

/**
 * Get all active jobs
 * @returns {Object} Map of active jobs
 */
async function getActiveJobs() {
  try {
    // Get jobs that are in processing states
    const pendingJobs = await jobStore.getPendingJobs(100);
    
    // Format them into a map for backwards compatibility
    const jobsMap = {};
    for (const job of pendingJobs) {
      jobsMap[job.id] = {
        jobId: job.id,
        scrapeJobId: job.scrape_job_id,
        status: job.status,
        domain: job.domain,
        email: job.email,
        name: job.name,
        startTime: job.created_at
      };
    }
    
    return jobsMap;
  } catch (error) {
    console.error('Error getting active jobs:', error);
    return {};
  }
}

module.exports = {
  processSignup,
  checkJobStatus,
  getActiveJobs,
  getJobsByStatus
};
