/**
 * Cron job handler for processing pending jobs
 * This endpoint is called by Vercel's cron scheduler every minute
 */
const jobStore = require('../../src/jobStore');
const webScraper = require('../../src/webScraper');
const emailGenerator = require('../../src/emailGenerator');
const slackNotifier = require('../../src/slackNotifier');

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
            await slackNotifier.sendScrapingFailureToSlack(job.domain, error.message);
            
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
      await slackNotifier.sendScrapingFailureToSlack(job.domain, errorMessage);
      
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
      console.log(`[ProcessJobs] Generating email with API key from job: ${job.api_key}`);
      const emailDraft = await emailGenerator.generateEmail(
        job.name, 
        job.email, 
        job.domain, 
        websiteData,
        job.api_key // Pass the API key from the job record
      );
      
      // Send to Slack
      await slackNotifier.sendToSlack(
        job.name, 
        job.email, 
        job.domain, 
        emailDraft, 
        websiteData
      );
      
      // Complete the job
      await jobStore.completeJobWithEmail(job.id, emailDraft);
      
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
    console.log(`[ProcessJobs] Generating email with API key from job: ${job.api_key}`);
    const emailDraft = await emailGenerator.generateEmail(
      job.name, 
      job.email, 
      job.domain, 
      job.scrape_result,
      job.api_key // Pass the API key from the job record
    );
    
    // Send to Slack
    await slackNotifier.sendToSlack(
      job.name, 
      job.email, 
      job.domain, 
      emailDraft, 
      job.scrape_result
    );
    
    // Complete the job
    await jobStore.completeJobWithEmail(job.id, emailDraft);
    
    return {
      status: 'completed',
      message: `Email generated and sent to Slack for ${job.email}`
    };
  }
  
  return {
    status: 'skipped',
    message: `Job ${job.id} with status ${job.status} was not processed`
  };
}

module.exports = processJobs;
