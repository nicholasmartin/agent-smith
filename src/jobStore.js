/**
 * Job Store Module for Agent Smith
 * Handles all database operations related to job management using Supabase
 */
const supabase = require('./supabaseClient');

/**
 * Create a new job in the database
 * @param {Object} jobData - Job information
 * @param {string} jobData.email - User's email address
 * @param {string} jobData.name - User's name
 * @param {string} jobData.domain - Company domain
 * @param {string} [jobData.apiKeyId] - API key ID for the enhanced security system
 * @param {string} [jobData.companyId] - Company ID that submitted this request
 * @param {boolean} [jobData.fromWebsite] - Whether this submission came from the website form
 * @param {string} [jobData.userId] - Supabase Auth user ID if available
 * @param {boolean} [jobData.email_sent] - Whether the final email has been sent
 * @returns {Object} Created job data
 */
async function createJob(jobData) {
  try {
    const { email, name, domain, apiKeyId, companyId, fromWebsite, userId, email_sent } = jobData;
    
    console.log(`Creating job for ${name} (${email}) from domain ${domain}`);
    
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        email,
        name,
        domain,
        api_key_id: apiKeyId,
        company_id: companyId,
        from_website: fromWebsite,
        user_id: userId || null, // Store user ID if available
        email_sent: email_sent || false, // Flag to indicate if the final email has been sent
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
 * @param {boolean} [emailSent=false] - Whether the email has been sent
 * @returns {Object} Updated job data
 */
async function completeJobWithEmail(jobId, emailDraft, emailSent = false) {
  try {
    console.log(`Completing job ${jobId} with email draft (email_sent: ${emailSent})`);
    
    const { data, error } = await supabase
      .from('jobs')
      .update({
        email_draft: emailDraft,
        email_content: JSON.stringify(emailDraft), // Store as JSON string for easier retrieval
        status: 'completed',
        email_sent: emailSent,
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
      .select(`
        id,
        status,
        email,
        domain,
        created_at,
        updated_at,
        completed_at,
        scrape_result,
        scrape_job_id
      `)
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
 * @param {string} status - Status to filter by
 * @returns {Array} Array of jobs with the specified status
 */
async function getJobsByStatus(status) {
  try {
    console.log(`Getting jobs with status: ${status}`);
    
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error getting jobs with status ${status}:`, error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error(`Failed to get jobs with status ${status}:`, error);
    throw error;
  }
}

/**
 * Get jobs by status and email sent flag
 * @param {string} status - Status to filter by
 * @param {boolean} emailSent - Email sent flag to filter by
 * @returns {Array} Array of jobs matching the criteria
 */
async function getJobsByStatusAndEmailSent(status, emailSent) {
  try {
    console.log(`Getting jobs with status: ${status} and email_sent: ${emailSent}`);
    
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', status)
      .eq('email_sent', emailSent)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(`Error getting jobs with status ${status} and email_sent ${emailSent}:`, error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error(`Failed to get jobs with status ${status} and email_sent ${emailSent}:`, error);
    throw error;
  }
}

/**
 * Update job with user ID
 * @param {string} jobId - Database job ID
 * @param {string} userId - Supabase Auth user ID
 * @returns {Object} Updated job data
 */
async function updateJobWithUserId(jobId, userId) {
  try {
    console.log(`Updating job ${jobId} with user ID: ${userId}`);
    
    const { data, error } = await supabase
      .from('jobs')
      .update({
        user_id: userId,
        invitation_pending: false, // Mark invitation as sent
        updated_at: new Date()
      })
      .eq('id', jobId)
      .select();
      
    if (error) {
      console.error(`Error updating job with user ID: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    console.error(`Error in updateJobWithUserId: ${error.message}`);
    throw error;
  }
}

/**
 * Mark email as sent
 * @param {string} jobId - Database job ID
 * @returns {Object} Updated job data
 */
async function markEmailSent(jobId) {
  try {
    console.log(`Marking email as sent for job ${jobId}`);
    
    const { data, error } = await supabase
      .from('jobs')
      .update({
        email_sent: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      console.error('Error marking email as sent:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error(`Failed to mark email as sent for job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Update job metadata
 * @param {string} jobId - Database job ID
 * @param {Object} metadata - Metadata to store with the job
 * @returns {Object} Updated job data
 */
async function updateJobMetadata(jobId, metadata) {
  try {
    console.log(`Updating job ${jobId} with metadata`);
    
    const { data, error } = await supabase
      .from('jobs')
      .update({
        metadata,
        updated_at: new Date()
      })
      .eq('id', jobId)
      .select();
      
    if (error) {
      console.error(`Error updating job metadata: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    console.error(`Error in updateJobMetadata: ${error.message}`);
    throw error;
  }
}

module.exports = {
  createJob,
  getJobById,
  updateJobWithScrapeId,
  updateJobWithScrapeResult,
  completeJobWithEmail,
  markJobAsFailed,
  getPendingJobs,
  getJobsByStatus,
  getJobsByStatusAndEmailSent,
  updateJobWithUserId,
  markEmailSent,
  updateJobMetadata
};
