/**
 * Email Delivery Module for Agent Smith
 * 
 * This module centralizes all email sending and magic link generation
 * to ensure we only generate one magic link per user.
 */

const magicLinkGenerator = require('./auth/magicLinkGenerator');
const emailService = require('./emailService');
const supabase = require('./supabaseClient');

/**
 * Send job completion email with AI content
 * This is the ONLY place that should generate magic links and send emails
 * 
 * @param {Object} job - The job data from database
 * @param {Object} emailContent - The email content to send
 * @param {boolean} requiresAuth - Whether this email requires auth (true for website submissions)
 * @returns {Promise<Object>} Result of email sending
 */
async function sendJobCompletionEmail(job, emailContent, requiresAuth = false) {
  try {
    console.log(`[EmailDelivery] Preparing email for: ${job.email}`);
    
    // Only generate magic link for website submissions that require authentication
    let signInLink = null;
    
    // MAGIC_LINK_DEBUG: Log detailed information about the job and auth requirements
    console.log(`MAGIC_LINK_DEBUG: Job details - ID: ${job.id}, Email: ${job.email}, Name: ${job.name}`);
    console.log(`MAGIC_LINK_DEBUG: Auth flags - from_website: ${job.from_website}, requiresAuth: ${requiresAuth}`);
    console.log(`MAGIC_LINK_DEBUG: User ID in job: ${job.user_id || 'not set'}`);
    
    if (requiresAuth) {
      console.log(`MAGIC_LINK_DEBUG: Will attempt to generate magic link for ${job.email}`);
      try {
        console.log(`[EmailDelivery] Generating magic link for: ${job.email}`);
        
        // Verify required parameters are present
        if (!job.email || !job.name) {
          throw new Error(`Missing required parameters: email=${job.email}, name=${job.name}`);
        }
        
        signInLink = await magicLinkGenerator.generateMagicLink(job.email, job.name, {
          source: 'agent_smith_email_delivery'
        });
        
        console.log(`MAGIC_LINK_DEBUG: Magic link generation returned: ${signInLink ? 'SUCCESS' : 'NULL'}`);
        console.log(`[EmailDelivery] Magic link generated successfully for ${job.email}`);
      } catch (linkError) {
        console.error(`MAGIC_LINK_DEBUG: ERROR generating magic link: ${linkError.message}`);
        console.error(`[EmailDelivery] Error generating magic link: ${linkError.message}`);
        // Continue without auth link if generation fails
      }
    } else {
      console.log(`MAGIC_LINK_DEBUG: Skipping magic link generation because requiresAuth=${requiresAuth}`);
    }
    
    // Send the email with content and optional magic link
    console.log(`[EmailDelivery] Sending email to: ${job.email}`);
    const emailResult = await emailService.sendJobCompletionEmail(job, emailContent, signInLink);
    
    if (emailResult.success) {
      console.log(`[EmailDelivery] Email sent successfully to ${job.email}, ID: ${emailResult.emailId}`);
      
      // Update job to mark email as sent
      try {
        const { error } = await supabase
          .from('jobs')
          .update({ email_sent: true })
          .eq('id', job.id);
          
        if (error) {
          console.error(`[EmailDelivery] Error marking email as sent: ${error.message}`);
        }
      } catch (dbError) {
        console.error(`[EmailDelivery] Database error: ${dbError.message}`);
      }
    } else {
      console.error(`[EmailDelivery] Failed to send email to ${job.email}`);
    }
    
    return emailResult;
  } catch (error) {
    console.error(`[EmailDelivery] Error in email delivery process: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Determine if a job requires authentication
 * Website submissions require auth, API submissions do not
 * 
 * @param {Object} job - The job data
 * @returns {boolean} Whether the job requires authentication
 */
function jobRequiresAuth(job) {
  // Website submissions (fromWebsite=true) require authentication
  // API submissions (fromWebsite=false) do not require authentication
  return job.from_website === true;
}

module.exports = {
  sendJobCompletionEmail,
  jobRequiresAuth
};
