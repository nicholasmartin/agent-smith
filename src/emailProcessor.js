const domainChecker = require('./domainChecker');
const webScraper = require('./webScraper');
const emailGenerator = require('./emailGenerator');
const slackNotifier = require('./slackNotifier');
const jobStore = require('./jobStore');
const supabase = require('./supabaseClient');
const emailService = require('./emailService');

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
    console.log(`[EmailProcessor] ENTER processSignup for ${email} (Name: ${name}, API Key ID: ${apiKeyId}, Company ID: ${companyId}, From Website: ${fromWebsite})`);
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
    let userData = null; // Define userData outside the try block
    
    if (fromWebsite) {
      console.log(`[EmailProcessor] Creating Supabase user for ${email}`);
      
      try {
        // Create user without sending email
        const { data: createData, error: userError } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true, // Mark email as confirmed
          user_metadata: { 
            name,
            source: 'agent_smith'
          }
        });
        
        if (userError) {
          // Check if it's a known 'user already exists' error (adjust codes/messages as needed)
          const isDuplicateError = userError.message.includes('User already registered') || 
                                  userError.message.includes('duplicate key value violates unique constraint') || 
                                  userError.status === 422 || // Sometimes used for duplicates
                                  userError.code === '23505'; // PostgreSQL unique violation

          if (isDuplicateError) {
            console.warn(`[EmailProcessor] User ${email} already exists. Attempting to fetch existing user ID.`);
            // Try to fetch the existing user ID
            const { data: existingUsers, error: fetchError } = await supabase.auth.admin.listUsers({ email });
            if (fetchError || !existingUsers || existingUsers.length === 0) {
              console.error(`[EmailProcessor] Failed to fetch existing user ID for ${email}:`, fetchError?.message || 'No user found');
              // Decide how to handle: throw error, proceed without userId, etc.
              // For now, let's throw to be safe, as we expect the user to exist.
              throw new Error(`User ${email} exists but failed to fetch their ID.`);
            } else {
              userId = existingUsers[0].id;
              console.log(`[EmailProcessor] Found existing user ID: ${userId} for ${email}`);
              // Simulate userData structure if needed later (though profile upsert uses userId directly)
              userData = { user: existingUsers[0] }; 
            }
          } else {
            // It's a different, unexpected error - log details and throw
            console.error(`[EmailProcessor] UNEXPECTED error creating user ${email}: Status=${userError.status}, Code=${userError.code}, Message=${userError.message}`, userError);
            throw new Error(`Failed to create Supabase user for ${email}: ${userError.message}`); // Halt execution
          }
        } else {
          // User creation successful
          userData = createData; // Assign successful creation data
          userId = userData.user.id;
          console.log(`[EmailProcessor] Created user with ID: ${userId}`);
        }
      } catch (authError) {
        // Catch exceptions from the try block (e.g., fetching existing user fails)
        console.error(`[EmailProcessor] EXCEPTION during user/profile handling for ${email}: ${authError.message}`);
        // Re-throw the error to halt execution of processSignup
        throw authError; 
      }
      
      // Only attempt profile upsert if we have a valid userId (either new or fetched)
      if (userId) {
        console.log(`[EmailProcessor] Upserting profile for user ID: ${userId}`);
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            name: name,
            // Check if user data exists and has profile data to merge if needed, otherwise set defaults
            // Example: account_completed might come from existing profile data if fetched
            account_completed: userData?.user?.user_metadata?.account_completed ?? false, 
            updated_at: new Date()
          }, { onConflict: 'id' }); // Ensure conflict resolution is on 'id'
        
        if (profileError) { 
          // Log profile error but potentially continue? Or throw?
          // For now, log warning and continue, job might still be useful without full profile sync.
          console.warn(`[EmailProcessor] Error upserting profile for user ${userId}: ${profileError.message}`);
        }
      } else {
        // This case should ideally not be reached if we throw errors above correctly
        console.warn(`[EmailProcessor] Skipping profile upsert as userId is null for ${email}.`);
      }
    }
    
    // Step 3: Create a job record with user ID
    console.log(`Creating job record for ${name} (${email}) from domain ${domain}`);
    
    const jobData = {
      email, 
      name, 
      domain, 
      apiKeyId,
      companyId, 
      fromWebsite,
      userId, // Will be the user ID if created or fetched, or null if fromWebsite=false or creation failed
      email_sent: false // Flag to indicate if the final email has been sent
    };
    console.log('[EmailProcessor] Job data before creation:', jobData);
    const job = await jobStore.createJob(jobData);
    
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
        
        // Send notification to Slack (optional)
        // await slackNotifier.sendToSlack(job.name, job.email, job.domain, emailDraft, websiteData);
        
        // Generate a magic link for the user
        console.log(`Generating magic link for: ${job.email}`);
        const { data: { properties }, error: linkError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: job.email,
          options: {
            redirectTo: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/dashboard`
          }
        });
        
        if (linkError) {
          console.error(`Error generating magic link: ${linkError.message}`);
          throw linkError;
        }
        
        // Extract the sign-in link from the properties
        const signInLink = properties.action_link;
        console.log(`Magic link generated for ${job.email}`);
        
        // Send the email with the AI content and magic link using Resend
        console.log(`Sending email via Resend for: ${job.email}`);
        const emailResult = await emailService.sendJobCompletionEmail(job, emailDraft, signInLink);
        
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
        // Generate a magic link for the user
        console.log(`Generating magic link for: ${job.email}`);
        const { data: { properties }, error: linkError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: job.email,
          options: {
            redirectTo: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/dashboard`
          }
        });
        
        if (linkError) {
          console.error(`Error generating magic link: ${linkError.message}`);
          continue;
        }
        
        // Extract the sign-in link from the properties
        const signInLink = properties.action_link;
        console.log(`Magic link generated for ${job.email}`);
        
        // Send the email with the AI content and magic link using Resend
        console.log(`Sending email via Resend for: ${job.email}`);
        await emailService.sendJobCompletionEmail(job, JSON.parse(job.email_content), signInLink);
        
        // Update job to mark email as sent
        await jobStore.updateJob(job.id, { email_sent: true });
        
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
