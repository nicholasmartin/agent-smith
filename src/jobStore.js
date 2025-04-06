/**
 * Job Store Module for Agent Smith
 * Handles all database operations related to job management using Supabase
 */
const supabase = require('./supabaseClient');

/**
 * Create a new job in the database
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @param {string} domain - Company domain
 * @param {string} apiKey - Optional company API key for multi-tenant support
 * @returns {Object} Created job data
 */
async function createJob(email, name, domain, apiKey = null) {
  try {
    console.log(`Creating job for ${name} (${email}) from domain ${domain}`);
    
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        email,
        name,
        domain,
        api_key: apiKey,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating job:', error);
      throw error;
    }
    
    console.log(`Job created with ID: ${data.id}`);
    return data;
  } catch (error) {
    console.error('Failed to create job:', error);
    throw error;
  }
}

/**
 * Update job with scrape job ID
 * @param {string} jobId - Database job ID
 * @param {string} scrapeJobId - Firecrawl scrape job ID
 * @returns {Object} Updated job data
 */
async function updateJobWithScrapeId(jobId, scrapeJobId) {
  try {
    console.log(`Updating job ${jobId} with scrape job ID ${scrapeJobId}`);
    
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

    if (error) {
      console.error('Error updating job with scrape ID:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error(`Failed to update job ${jobId} with scrape ID:`, error);
    throw error;
  }
}

/**
 * Update job with scrape results
 * @param {string} jobId - Database job ID
 * @param {Object} scrapeResult - Formatted scrape results
 * @returns {Object} Updated job data
 */
async function updateJobWithScrapeResult(jobId, scrapeResult) {
  try {
    console.log(`Updating job ${jobId} with scrape results`);
    
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

    if (error) {
      console.error('Error updating job with scrape results:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error(`Failed to update job ${jobId} with scrape results:`, error);
    throw error;
  }
}

/**
 * Update job with email draft and mark as completed
 * @param {string} jobId - Database job ID
 * @param {Object} emailDraft - Generated email draft with subject and body
 * @returns {Object} Updated job data
 */
async function completeJobWithEmail(jobId, emailDraft) {
  try {
    console.log(`Completing job ${jobId} with email draft`);
    
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

    if (error) {
      console.error('Error completing job with email:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error(`Failed to complete job ${jobId} with email:`, error);
    throw error;
  }
}

/**
 * Mark job as failed
 * @param {string} jobId - Database job ID
 * @param {string} errorMessage - Error message
 * @returns {Object} Updated job data
 */
async function markJobAsFailed(jobId, errorMessage) {
  try {
    console.log(`Marking job ${jobId} as failed: ${errorMessage}`);
    
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

    if (error) {
      console.error('Error marking job as failed:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error(`Failed to mark job ${jobId} as failed:`, error);
    throw error;
  }
}

/**
 * Get pending jobs for processing
 * @param {number} limit - Maximum number of jobs to retrieve
 * @returns {Array} Array of pending jobs
 */
async function getPendingJobs(limit = 5) {
  try {
    console.log(`Getting up to ${limit} pending jobs`);
    
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .in('status', ['pending', 'scraping'])
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error getting pending jobs:', error);
      throw error;
    }
    
    console.log(`Found ${data.length} pending jobs`);
    return data;
  } catch (error) {
    console.error('Failed to get pending jobs:', error);
    throw error;
  }
}

/**
 * Get a specific job by ID
 * @param {string} jobId - Database job ID
 * @returns {Object} Job data
 */
async function getJobById(jobId) {
  try {
    console.log(`Getting job with ID: ${jobId}`);
    
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error(`Error getting job ${jobId}:`, error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error(`Failed to get job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Increment retry count for a job
 * @param {string} jobId - Database job ID
 * @returns {Object} Updated job data
 */
async function incrementRetryCount(jobId) {
  try {
    console.log(`Incrementing retry count for job ${jobId}`);
    
    // First get the current retry count
    const { data: job, error: getError } = await supabase
      .from('jobs')
      .select('retry_count')
      .eq('id', jobId)
      .single();
      
    if (getError) {
      console.error(`Error getting retry count for job ${jobId}:`, getError);
      throw getError;
    }
    
    // Increment the retry count
    const newRetryCount = (job.retry_count || 0) + 1;
    
    const { data, error } = await supabase
      .from('jobs')
      .update({
        retry_count: newRetryCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      console.error(`Error incrementing retry count for job ${jobId}:`, error);
      throw error;
    }
    
    console.log(`Job ${jobId} retry count incremented to ${newRetryCount}`);
    return data;
  } catch (error) {
    console.error(`Failed to increment retry count for job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Get jobs by status
 * @param {string} status - Job status to filter by
 * @param {number} limit - Maximum number of jobs to retrieve
 * @returns {Array} Array of jobs with the specified status
 */
async function getJobsByStatus(status, limit = 20) {
  try {
    console.log(`Getting up to ${limit} jobs with status: ${status}`);
    
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', status)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`Error getting jobs with status ${status}:`, error);
      throw error;
    }
    
    console.log(`Found ${data.length} jobs with status ${status}`);
    return data;
  } catch (error) {
    console.error(`Failed to get jobs with status ${status}:`, error);
    throw error;
  }
}

module.exports = {
  createJob,
  updateJobWithScrapeId,
  updateJobWithScrapeResult,
  completeJobWithEmail,
  markJobAsFailed,
  getPendingJobs,
  getJobById,
  incrementRetryCount,
  getJobsByStatus
};
