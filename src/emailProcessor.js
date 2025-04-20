const domainChecker = require('./domainChecker');
const webScraper = require('./webScraper');
const emailGenerator = require('./emailGenerator');
const slackNotifier = require('./slackNotifier');
const jobStore = require('./jobStore');
const supabase = require('./supabaseClient');

/**
 * Process a new signup by checking the domain and starting the scraping job
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @param {string} apiKeyId - API key ID for the enhanced security system
 * @param {string} companyId - Company ID that submitted this request
 * @param {boolean} [fromWebsite=false] - Whether this submission came from the website form
 * @returns {Object} Job information
 */
async function processSignup(email, name, apiKeyId, companyId, fromWebsite = false) {
  try {
    console.log(`[EmailProcessor] Processing signup for ${email} from ${fromWebsite ? 'website form' : 'API'}`);
    
    // Step 1: Check if it's a business domain
    const { isDomainFree, domain } = domainChecker.checkDomain(email);
    
    // If it's a free email provider, ignore and return
    if (isDomainFree) {
      console.log(`Skipping free email provider: ${email}`);
      return { status: 'skipped', reason: 'free email provider' };
    }
    
    // Step 2: Create Supabase Auth user immediately
    // This is the key change in our refactored authentication flow
    let userId = null;
    
    if (fromWebsite) {
      console.log(`[EmailProcessor] Creating Supabase user for ${email}`);
      
      try {
        // Create user without sending email
        const { data: userData, error: userError } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true, // Mark email as confirmed
          user_metadata: { 
            name,
            source: 'agent_smith'
          }
        });
        
        if (userError) {
          console.error(`[EmailProcessor] Error creating user: ${userError.message}`);
        } else {
          userId = userData.user.id;
          console.log(`[EmailProcessor] Created user with ID: ${userId}`);
          
          // Create/update user profile
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: userId,
              name: name,
              account_completed: false,
              updated_at: new Date()
            });
            
          if (profileError) {
            console.error(`[EmailProcessor] Error creating profile: ${profileError.message}`);
          }
        }
      } catch (authError) {
        console.error(`[EmailProcessor] Exception creating user: ${authError.message}`);
      }
    }
    
    // Step 3: Create a job record with user ID
    console.log(`Creating job record for ${name} (${email}) from domain ${domain}`);
    
    // Create job with new security parameters and user ID
    const job = await jobStore.createJob({
      email, 
      name, 
      domain, 
      apiKeyId,
      companyId, 
      fromWebsite,
      userId, // Will be the user ID if created, or null
      email_sent: false // Flag to indicate if the final email has been sent
    });
    
    console.log(`[EmailProcessor] Job created with ID: ${job.id}`);
    
    // Step 4: Start the website scraping job
    console.log(`Starting scrape job for domain: ${domain}`);
    const jobInfo = await webScraper.startScrapeJob(domain);
    
    // Step 5: Update the job record with the scrape job ID
    await jobStore.updateJobWithScrapeId(job.id, jobInfo.jobId);
    
    console.log(`Scrape job started with ID: ${jobInfo.jobId} for ${email}`);
    
    return {
      status: 'processing',
      jobId: job.id,
      scrapeJobId: jobInfo.jobId,
      email,
      domain,
      userId // Will be the user ID if created, or null
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
        
        // Remove Slack notification - email will be sent through Supabase Edge Function instead
        console.log(`Email will be sent through Supabase Edge Function for: ${job.email}`);
        // await slackNotifier.sendToSlack(job.name, job.email, job.domain, emailDraft, websiteData);
        
        // Update job as completed
        await jobStore.completeJobWithEmail(jobId, emailDraft);
        
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
 * @param {string} status - Status to filter by
 * @param {number} limit - Maximum number of jobs to return
 * @returns {Array} Array of jobs with the specified status
 */
async function getJobsByStatus(status, limit = 20) {
  try {
    return await jobStore.getJobsByStatus(status, limit);
  } catch (error) {
    console.error(`Error getting jobs with status ${status}:`, error);
    throw error;
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
