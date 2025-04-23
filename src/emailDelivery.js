/**
 * Email Delivery Module for Agent Smith
 * 
 * This module centralizes all email sending and signup link generation
 * to ensure consistent authentication flow.
 */

const emailService = require('./emailService');
const supabase = require('./supabaseClient');

/**
 * Generate a signup link with pre-populated fields
 * @param {Object} job - The job data from database
 * @returns {string} URL for the signup page
 */
function generateSignupLink(job) {
  // Extract user information from job metadata
  const metadata = job.metadata || {};
  const firstName = metadata.first_name || job.name.split(' ')[0] || '';
  const lastName = metadata.last_name || (job.name.includes(' ') ? job.name.split(' ').slice(1).join(' ') : '');
  const email = job.email;
  
  // Create a secure link to the signup page with pre-populated fields
  const baseUrl = process.env.BASE_URL || 'https://agent-smith.magloft.com';
  const params = new URLSearchParams();
  params.append('email', email);
  params.append('first_name', firstName);
  params.append('last_name', lastName);
  
  return `${baseUrl}/signup.html?${params.toString()}`;
}

/**
 * Send job completion email with AI content
 * This is the ONLY place that should generate signup links and send emails
 * 
 * @param {Object} job - The job data from database
 * @param {Object} emailContent - The email content to send
 * @param {boolean} requiresAuth - Whether this email requires auth (true for website submissions)
 * @returns {Promise<Object>} Result of email sending
 */
async function sendJobCompletionEmail(job, emailContent, requiresAuth = false) {
  try {
    console.log(`[EmailDelivery] Preparing email for: ${job.email}`);
    
    // Only generate signup link for website submissions that require authentication
    let signupLink = null;
    
    // Log detailed information about the job and auth requirements
    console.log(`[EmailDelivery] Job details - ID: ${job.id}, Email: ${job.email}, Name: ${job.name}`);
    console.log(`[EmailDelivery] Auth flags - from_website: ${job.from_website}, requiresAuth: ${requiresAuth}`);
    
    if (requiresAuth) {
      console.log(`[EmailDelivery] Generating signup link for ${job.email}`);
      try {
        // Verify required parameters are present
        if (!job.email || !job.id) {
          throw new Error(`Missing required parameters: email=${job.email}, job.id=${job.id}`);
        }
        
        // Generate signup link
        signupLink = generateSignupLink(job);
        
        console.log(`[EmailDelivery] Signup link generated successfully: ${signupLink}`);
        
        // Update the trial record with the email sent timestamp
        if (job.metadata?.trial_id) {
          const { error } = await supabase
            .from('trials')
            .update({ last_email_sent_at: new Date() })
            .eq('id', job.metadata.trial_id);
            
          if (error) {
            console.error(`[EmailDelivery] Error updating trial record: ${error.message}`);
          } else {
            console.log(`[EmailDelivery] Updated trial record ${job.metadata.trial_id} with email timestamp`);
          }
        }
      } catch (linkError) {
        console.error(`[EmailDelivery] Error generating signup link: ${linkError.message}`);
        // Continue without auth link if generation fails
      }
    } else {
      console.log(`[EmailDelivery] Skipping signup link generation because requiresAuth=${requiresAuth}`);
    }
    
    // Send the email with content and optional signup link
    console.log(`[EmailDelivery] Sending email to: ${job.email}`);
    const emailResult = await emailService.sendJobCompletionEmail(job, emailContent, signupLink);
    
    if (emailResult.success) {
      console.log(`[EmailDelivery] Email sent successfully to ${job.email}, ID: ${emailResult.emailId}`);
      
      // Update job to mark email as sent
      try {
        const { error } = await supabase
          .from('jobs')
          .update({ 
            email_sent: true,
            invitation_pending: false // Mark invitation as sent
          })
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
  // Website submissions (from_website=true) require authentication
  // API submissions (from_website=false) do not require authentication
  return job.from_website === true;
}

module.exports = {
  sendJobCompletionEmail,
  jobRequiresAuth,
  generateSignupLink
};
