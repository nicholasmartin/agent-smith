/**
 * Cron job handler for processing pending jobs
 * This endpoint is called by Vercel's cron scheduler every minute
 */
const jobStore = require('../../src/jobStore');
const webScraper = require('../../src/webScraper');
const emailGenerator = require('../../src/emailGenerator');
const emailDelivery = require('../../src/emailDelivery');
const slackNotifier = require('../../src/slackNotifier');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Process a batch of pending jobs
 */
async function processJobs(req, res) {
  try {
    console.log('Cron job started: processing pending jobs');
    
    // Get pending jobs
    const pendingJobs = await jobStore.getPendingJobs(5);
    console.log(`Found ${pendingJobs.length} pending jobs`);
    
    if (pendingJobs.length === 0) {
      return res.status(200).json({ message: 'No pending jobs to process' });
    }
    
    // Process each job
    const results = [];
    for (const job of pendingJobs) {
      try {
        const result = await processJob(job);
        results.push({
          jobId: job.id,
          status: result.status,
          message: result.message
        });
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
        
        // Increment retry count and mark as failed if max retries reached
        try {
          const updatedJob = await jobStore.incrementRetryCount(job.id);
          
          if (updatedJob.retry_count >= 3) {
            await jobStore.markJobAsFailed(job.id, error.message);
            // Remove Slack notification for failures
            // await slackNotifier.sendScrapingFailureToSlack(job.domain, error.message);
            console.log(`[Cron] Job ${job.id} for ${job.domain} failed after ${updatedJob.retry_count} retries: ${error.message}`);
            
            results.push({
              jobId: job.id,
              status: 'failed',
              error: error.message,
              retries: updatedJob.retry_count
            });
          } else {
            results.push({
              jobId: job.id,
              status: 'retry',
              error: error.message,
              retries: updatedJob.retry_count
            });
          }
        } catch (dbError) {
          console.error(`Error updating job retry count:`, dbError);
          results.push({
            jobId: job.id,
            status: 'error',
            error: `Failed to update retry count: ${dbError.message}`
          });
        }
      }
    }
    
    return res.status(200).json({ 
      message: `Processed ${pendingJobs.length} jobs`,
      results
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return res.status(500).json({ error: 'Cron job failed', message: error.message });
  }
}

/**
 * Process an individual job based on its current status
 * @param {Object} job - Job data from database
 * @returns {Object} Processing result
 */
async function processJob(job) {
  console.log(`Processing job ${job.id} with status ${job.status}`);
  
  // If job is pending, start scraping
  if (job.status === 'pending') {
    // Start the scraping job
    const scrapeInfo = await webScraper.startScrapeJob(job.domain);
    
    // Update job with scrape ID
    await jobStore.updateJobWithScrapeId(job.id, scrapeInfo.jobId);
    
    return {
      status: 'scraping_started',
      message: `Started scraping for domain ${job.domain} with scrape job ID ${scrapeInfo.jobId}`
    };
  }
  // If job is in scraping status, check scrape status
  else if (job.status === 'scraping' && job.scrape_job_id) {
    // Check scrape job status
    const scrapeStatus = await webScraper.checkScrapeJobStatus(job.scrape_job_id);
    
    // If still processing, do nothing
    if (scrapeStatus.status === 'processing') {
      return {
        status: 'still_processing',
        message: `Scrape job ${job.scrape_job_id} is still processing`
      };
    }
    
    // If failed, mark as failed
    if (scrapeStatus.status === 'error' || scrapeStatus.status === 'failed') {
      const errorMessage = scrapeStatus.message || 'Unknown error';
      await jobStore.markJobAsFailed(job.id, errorMessage);
      // Remove Slack notification for failures
      // await slackNotifier.sendScrapingFailureToSlack(job.domain, errorMessage);
      console.log(`[Cron] Scraping failed for job ${job.id}, domain ${job.domain}: ${errorMessage}`);
      
      return {
        status: 'scraping_failed',
        message: `Scraping failed: ${errorMessage}`
      };
    }
    
    // If completed, process the results
    if (scrapeStatus.status === 'completed' && scrapeStatus.result) {
      // Format the website data
      const websiteData = await webScraper.formatScrapeResult(job.domain, scrapeStatus.result);
      
      // Update job with scrape results
      await jobStore.updateJobWithScrapeResult(job.id, websiteData);
      
      // Generate personalized email
      console.log(`[ProcessJobs] Generating email for job: ${job.id}`);
      console.log(`[ProcessJobs] Using company ID: ${job.company_id} and API key: ${job.api_key}`);
      const emailDraft = await emailGenerator.generateEmail(
        job.name, 
        job.email, 
        job.domain, 
        websiteData,
        job.api_key, // Pass the API key from the job record (may be null)
        job.company_id // Pass the company ID (new parameter)
      );
      
      // Complete the job with email draft
      await jobStore.completeJobWithEmail(job.id, emailDraft);
      
      // Check if we need to send the email with authentication link
      // We'll send an email for all completed jobs that have a user_id
      if (job.user_id && !job.email_sent) {
        try {
          console.log(`[Cron] Sending combined email to ${job.email} with AI content and optional auth`);
          
          // Determine if this job requires authentication (was it from the website?)
          const requiresAuth = job.from_website === true;
          
          // Send email with AI content and optional auth link using the centralized delivery module
          const emailResult = await emailDelivery.sendJobCompletionEmail(job, emailDraft, requiresAuth);
          
          if (emailResult.success) {
            console.log(`[Cron] Combined email sent successfully to ${job.email}, ID: ${emailResult.emailId}`);
          } else {
            console.error(`[Cron] Failed to send email to ${job.email}`);
          }
        } catch (error) {
          console.error(`[Cron] Error in email sending process: ${error.message}`);
        }
      }
      
      return {
        status: 'completed',
        message: `Job completed successfully for ${job.email}`
      };
    }
    
    return {
      status: 'unknown_scrape_status',
      message: `Unknown scrape status: ${scrapeStatus.status}`
    };
  }
  // If job is in generating_email state, continue with email generation
  else if (job.status === 'generating_email' && job.scrape_result) {
    // Generate personalized email
    console.log(`[ProcessJobs] Generating email for job: ${job.id}`);
    console.log(`[ProcessJobs] Using company ID: ${job.company_id} and API key: ${job.api_key}`);
    const emailDraft = await emailGenerator.generateEmail(
      job.name, 
      job.email, 
      job.domain, 
      job.scrape_result,
      job.api_key, // Pass the API key from the job record (may be null)
      job.company_id // Pass the company ID (new parameter)
    );
    
    // Complete the job with email draft
    await jobStore.completeJobWithEmail(job.id, emailDraft);
    
    // Check if we need to send the email with authentication link
    // We'll send an email for all completed jobs that have a user_id
    if (job.user_id && !job.email_sent) {
      try {
        console.log(`[Cron] Sending combined email to ${job.email} with AI content and optional auth`);
        
        // Determine if this job requires authentication (was it from the website?)
        const requiresAuth = job.from_website === true;
        
        // Send email with AI content and optional auth link using the centralized delivery module
        const emailResult = await emailDelivery.sendJobCompletionEmail(job, emailDraft, requiresAuth);
        
        if (emailResult.success) {
          console.log(`[Cron] Combined email sent successfully to ${job.email}, ID: ${emailResult.emailId}`);
        } else {
          console.error(`[Cron] Failed to send email to ${job.email}`);
        }
      } catch (error) {
        console.error(`[Cron] Error in email sending process: ${error.message}`);
      }
    }
    
    return {
      status: 'completed',
      message: `Job completed successfully for ${job.email}`
    };
  }
  
  return {
    status: 'skipped',
    message: `Job ${job.id} with status ${job.status} was not processed`
  };
}

module.exports = processJobs;
