/**
 * Email Service Module for Agent Smith
 * Handles sending emails with AI content and password creation links
 */
const { Resend } = require('resend');

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send job completion email with AI content
 * @param {Object} job - The job data
 * @param {Object} emailContent - The email content to send
 * @param {string} signupLink - Optional signup link for new users
 * @returns {Promise<Object>} Result of email sending
 */
async function sendJobCompletionEmail(job, emailContent, signupLink = null) {
  try {
    console.log(`[EmailService] Sending job completion email to ${job.email}`);
    
    // Extract name components from job
    const metadata = job.metadata || {};
    const firstName = metadata.first_name || job.name.split(' ')[0] || job.name;
    
    // Prepare email data
    const emailData = {
      to: job.email,
      subject: emailContent.subject || `Welcome to Agent Smith, ${firstName}!`,
      html: formatEmailContent(emailContent.body, firstName, signupLink)
    };
    
    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_SENDER_EMAIL || 'Agent Smith <hello@agent-smith.com>',
      ...emailData,
      // Optional fields
      text: emailData.html.replace(/<[^>]*>/g, ''), // Plain text version
      tags: [{
        name: "source",
        value: "agent_smith"
      }]
    });
    
    if (error) {
      console.error(`[EmailService] Error sending job completion email: ${error.message}`);
      throw error;
    }
    
    console.log(`[EmailService] Email sent successfully, ID: ${data.id}`);
    return {
      success: true,
      emailId: data.id,
      to: job.email
    };
  } catch (error) {
    console.error(`[EmailService] Exception sending job completion email: ${error.message}`);
    throw error;
  }
}

/**
 * Format email content with HTML and optional signup link
 * @param {string} content - The email content
 * @param {string} firstName - The recipient's first name
 * @param {string} signupLink - Optional signup link
 * @returns {string} Formatted HTML email
 */
function formatEmailContent(content, firstName, signupLink = null) {
  // Check if content is already HTML (contains HTML tags)
  const isHtml = /<[a-z][\s\S]*>/i.test(content);
  
  // Convert plain text to HTML paragraphs if needed
  let htmlContent = isHtml ? content : content.split('\n\n')
    .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('');
  
  // Add signup link section if provided
  let signupSection = '';
  if (signupLink) {
    signupSection = `
      <div style="margin-top: 30px; margin-bottom: 30px; text-align: center;">
        <a href="${signupLink}" style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Create Your Account
        </a>
        <p style="margin-top: 15px; font-size: 14px; color: #666;">
          Click the button above to create your account and access your dashboard.
        </p>
      </div>
    `;
  }
  
  // Create the full email template
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Agent Smith</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #000000; margin: 0; padding: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <tr>
          <td style="text-align: center; padding-bottom: 20px;">
            <h1 style="color: #000000; margin: 0;">Agent<span style="color: #4CAF50;">Smith</span></h1>
          </td>
        </tr>
        <tr>
          <td style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
            <p style="color: #000000; margin-top: 0;">Hi ${firstName},</p>
            ${htmlContent}
            ${signupSection}
            <p style="color: #000000; margin-bottom: 0;">Best regards,<br>The Agent Smith Team</p>
          </td>
        </tr>
        <tr>
          <td style="text-align: center; padding-top: 20px; font-size: 12px; color: #666;">
            <p>&copy; ${new Date().getFullYear()} Agent Smith. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

module.exports = {
  sendJobCompletionEmail
};
