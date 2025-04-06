# Agent Smith: Supabase + Vercel Cron Jobs Implementation Plan

This document outlines the step-by-step process to implement Supabase storage and Vercel cron jobs for the Agent Smith project. This approach will solve the serverless timeout limitations when processing web scraping operations.

## Prerequisites

1. Supabase project already set up and linked (confirmed)
2. Vercel account with access to deploy the project
3. Node.js environment for local development

## Implementation Steps

### Phase 1: Database Setup

1. **Create Supabase Tables**
   ```sql
   -- Create jobs table
   CREATE TABLE jobs (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     email TEXT NOT NULL,
     name TEXT NOT NULL,
     domain TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     completed_at TIMESTAMP WITH TIME ZONE,
     scrape_job_id TEXT,
     scrape_result JSONB,
     email_draft JSONB,
     error_message TEXT,
     retry_count INTEGER DEFAULT 0
   );

   -- Create an index on status for faster queries
   CREATE INDEX idx_jobs_status ON jobs(status);
   ```

2. **Install Supabase Client**
   ```bash
   npm install @supabase/supabase-js
   ```

### Phase 2: Supabase Integration

1. **Create Database Client Module (`src/supabaseClient.js`)**
   ```javascript
   const { createClient } = require('@supabase/supabase-js');

   // Initialize Supabase client
   const supabaseUrl = process.env.SUPABASE_URL;
   const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

   if (!supabaseUrl || !supabaseKey) {
     console.error('Missing Supabase credentials');
   }

   const supabase = createClient(supabaseUrl, supabaseKey);

   module.exports = supabase;
   ```

2. **Create Job Store Module (`src/jobStore.js`)**
   ```javascript
   const supabase = require('./supabaseClient');

   /**
    * Create a new job in the database
    */
   async function createJob(email, name, domain) {
     const { data, error } = await supabase
       .from('jobs')
       .insert({
         email,
         name,
         domain,
         status: 'pending'
       })
       .select()
       .single();

     if (error) throw error;
     return data;
   }

   /**
    * Update job with scrape job ID
    */
   async function updateJobWithScrapeId(jobId, scrapeJobId) {
     const { data, error } = await supabase
       .from('jobs')
       .update({
         scrape_job_id: scrapeJobId,
         status: 'scraping',
         updated_at: new Date().toISOString()
       })
       .eq('id', jobId)
       .select()
       .single();

     if (error) throw error;
     return data;
   }

   /**
    * Update job with scrape results
    */
   async function updateJobWithScrapeResult(jobId, scrapeResult) {
     const { data, error } = await supabase
       .from('jobs')
       .update({
         scrape_result: scrapeResult,
         status: 'generating_email',
         updated_at: new Date().toISOString()
       })
       .eq('id', jobId)
       .select()
       .single();

     if (error) throw error;
     return data;
   }

   /**
    * Update job with email draft
    */
   async function completeJobWithEmail(jobId, emailDraft) {
     const { data, error } = await supabase
       .from('jobs')
       .update({
         email_draft: emailDraft,
         status: 'completed',
         updated_at: new Date().toISOString(),
         completed_at: new Date().toISOString()
       })
       .eq('id', jobId)
       .select()
       .single();

     if (error) throw error;
     return data;
   }

   /**
    * Mark job as failed
    */
   async function markJobAsFailed(jobId, errorMessage) {
     const { data, error } = await supabase
       .from('jobs')
       .update({
         status: 'failed',
         error_message: errorMessage,
         updated_at: new Date().toISOString()
       })
       .eq('id', jobId)
       .select()
       .single();

     if (error) throw error;
     return data;
   }

   /**
    * Get pending jobs for processing
    */
   async function getPendingJobs(limit = 5) {
     const { data, error } = await supabase
       .from('jobs')
       .select('*')
       .in('status', ['pending', 'scraping'])
       .order('created_at', { ascending: true })
       .limit(limit);

     if (error) throw error;
     return data;
   }

   /**
    * Get a specific job by ID
    */
   async function getJobById(jobId) {
     const { data, error } = await supabase
       .from('jobs')
       .select('*')
       .eq('id', jobId)
       .single();

     if (error) throw error;
     return data;
   }

   /**
    * Increment retry count for a job
    */
   async function incrementRetryCount(jobId) {
     const { data, error } = await supabase
       .from('jobs')
       .update({
         retry_count: supabase.rpc('increment', { row_id: jobId }),
         updated_at: new Date().toISOString()
       })
       .eq('id', jobId)
       .select()
       .single();

     if (error) throw error;
     return data;
   }

   module.exports = {
     createJob,
     updateJobWithScrapeId,
     updateJobWithScrapeResult,
     completeJobWithEmail,
     markJobAsFailed,
     getPendingJobs,
     getJobById,
     incrementRetryCount
   };
   ```

### Phase 3: Modify Existing Components

1. **Update Email Processor (`src/emailProcessor.js`)**
   - Remove in-memory job storage
   - Remove background polling with setTimeout
   - Integrate with jobStore for database operations

2. **Update Web Scraper (`src/webScraper.js`)**
   - Modify to work with database job storage
   - Ensure it can handle partial processing

3. **Update Server (`server.js`)**
   - Modify endpoints to work with the new job storage system
   - Add environment variables for Supabase

### Phase 4: Create Cron Job Endpoint

1. **Create Vercel Cron Job Configuration**
   
   Create a `vercel.json` file in the project root:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/process-jobs",
         "schedule": "* * * * *"
       }
     ]
   }
   ```

2. **Create Cron Job Handler (`api/cron/process-jobs.js`)**
   ```javascript
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
       for (const job of pendingJobs) {
         try {
           await processJob(job);
         } catch (error) {
           console.error(`Error processing job ${job.id}:`, error);
           
           // Increment retry count and mark as failed if max retries reached
           try {
             const updatedJob = await jobStore.incrementRetryCount(job.id);
             
             if (updatedJob.retry_count >= 3) {
               await jobStore.markJobAsFailed(job.id, error.message);
               await slackNotifier.sendScrapingFailureToSlack(job.domain, error.message);
             }
           } catch (dbError) {
             console.error(`Error updating job retry count:`, dbError);
           }
         }
       }
       
       return res.status(200).json({ 
         message: `Processed ${pendingJobs.length} jobs`,
         jobIds: pendingJobs.map(job => job.id)
       });
     } catch (error) {
       console.error('Cron job error:', error);
       return res.status(500).json({ error: 'Cron job failed' });
     }
   }

   /**
    * Process an individual job based on its current status
    */
   async function processJob(job) {
     console.log(`Processing job ${job.id} with status ${job.status}`);
     
     // If job is pending, start scraping
     if (job.status === 'pending') {
       // Start the scraping job
       const scrapeInfo = await webScraper.startScrapeJob(job.domain);
       
       // Update job with scrape ID
       await jobStore.updateJobWithScrapeId(job.id, scrapeInfo.jobId);
     }
     // If job is in scraping status, check scrape status
     else if (job.status === 'scraping' && job.scrape_job_id) {
       // Check scrape job status
       const scrapeStatus = await webScraper.checkScrapeJobStatus(job.scrape_job_id);
       
       // If completed, process the results
       if (scrapeStatus.status === 'completed' && scrapeStatus.result) {
         // Format the website data
         const websiteData = await webScraper.formatScrapeResult(job.domain, scrapeStatus.result);
         
         // Update job with scrape results
         await jobStore.updateJobWithScrapeResult(job.id, websiteData);
         
         // Generate personalized email
         const emailDraft = await emailGenerator.generateEmail(
           job.name, 
           job.email, 
           job.domain, 
           websiteData
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
       }
       // If failed, mark as failed
       else if (scrapeStatus.status === 'error' || scrapeStatus.status === 'failed') {
         const errorMessage = scrapeStatus.message || 'Unknown error';
         await jobStore.markJobAsFailed(job.id, errorMessage);
         await slackNotifier.sendScrapingFailureToSlack(job.domain, errorMessage);
       }
       // Otherwise, it's still processing - do nothing
     }
   }

   module.exports = processJobs;
   ```

3. **Create API Route Handler (`pages/api/cron/process-jobs.js`)**
   ```javascript
   const processJobs = require('../../../api/cron/process-jobs');

   export default async function handler(req, res) {
     // Verify the request is from Vercel Cron
     const authHeader = req.headers.authorization || '';
     
     if (process.env.VERCEL_ENV === 'production' && !authHeader.includes('Bearer')) {
       return res.status(401).json({ error: 'Unauthorized' });
     }
     
     return processJobs(req, res);
   }
   ```

### Phase 5: Environment Variables

1. **Update `.env` File**
   ```
   # Existing variables
   API_KEY=em4il_p3rs0n_ag3nt_hj49dh4kl0s74jh31
   FIRECRAWL_API_KEY=your_firecrawl_api_key
   OPENAI_API_KEY=your_openai_api_key
   SLACK_WEBHOOK_URL=your_slack_webhook_url

   # New variables for Supabase
   SUPABASE_URL=https://jnpdszffuosiirapfvwp.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

2. **Add Environment Variables to Vercel**
   - Add all the above environment variables to your Vercel project settings

### Phase 6: Testing

1. **Local Testing**
   - Test the database operations with the Supabase client
   - Test the cron job endpoint locally by calling it directly

2. **Deployment Testing**
   - Deploy to Vercel
   - Monitor the cron job execution
   - Check logs for any errors

### Phase 7: Monitoring and Maintenance

1. **Set Up Monitoring**
   - Add more detailed logging
   - Consider setting up alerts for failed jobs

2. **Maintenance Tasks**
   - Implement a cleanup job to archive old completed jobs
   - Add analytics for job processing statistics

## Implementation Notes

- The cron job runs every minute, which is the minimum interval for Vercel cron jobs
- Jobs are processed in batches of 5 to avoid timeout issues
- Failed jobs are retried up to 3 times before being marked as permanently failed
- All job state is stored in Supabase, making the system resilient to serverless function restarts

## Troubleshooting

- If jobs are not being processed, check Vercel logs for cron job execution
- If database operations fail, verify Supabase credentials and table structure
- For scraping failures, check the Firecrawl API status and response
