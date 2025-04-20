// Agent Smith Email Hook for Supabase Magic Links with Resend
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize Resend for email sending
async function sendEmail(recipient, recipientName, subject, htmlContent) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  
  const senderEmail = Deno.env.get('RESEND_SENDER_EMAIL') || 'agent-smith@example.com';
  const senderName = 'Agent Smith';
  
  console.log(`[SendEmail] Sending email to ${recipient} via Resend`);
  
  const payload = {
    from: `${senderName} <${senderEmail}>`,
    to: [recipient],
    subject: subject,
    html: htmlContent,
    // Optional fields
    reply_to: senderEmail,
    text: htmlContent.replace(/<[^>]*>/g, ''), // Plain text version
    tags: [{
      name: "source",
      value: "agent_smith"
    }]
  };
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error(`[SendEmail] Error sending email via Resend:`, result);
      throw new Error(`Resend API error: ${result.message || 'Unknown error'}`);
    }
    
    console.log(`[SendEmail] Email sent successfully via Resend, ID: ${result.id}`);
    return result;
  } catch (error) {
    console.error(`[SendEmail] Exception sending email:`, error);
    throw error;
  }
}

// Handle invite emails with the new payload structure using Supabase's standard passwordless flow
async function handleInviteEmail(email, userData, emailData) {
  console.log(`[handleInviteEmail] Processing invite for ${email}`);
  
  try {
    // Get the user's name from metadata
    const name = userData.user_metadata?.name || email.split('@')[0];
    console.log(`[handleInviteEmail] User name: ${name}`);
    
    // Create a Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // The redirect URL - direct to dashboard after authentication
    const baseUrl = 'https://agent-smith.magloft.com';
    const dashboardUrl = `${baseUrl}/dashboard`;
    
    // Use Supabase's standard passwordless flow instead of custom invitation logic
    // This follows the recommended pattern in Supabase docs for magic links
    console.log(`[handleInviteEmail] Using standard Supabase passwordless auth flow`);
    
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: dashboardUrl
      }
    });
    
    if (error) {
      console.error(`[handleInviteEmail] Error generating magic link:`, error);
      throw error;
    }
    
    // Get the magic link from the response
    const magicLink = data.properties.action_link;
    console.log(`[handleInviteEmail] Magic link generated successfully using standard flow`);
    
    // Log the link (without exposing sensitive parts)
    const logLink = magicLink.replace(/token=([^&]+)/, 'token=[REDACTED]');
    console.log(`[handleInviteEmail] Magic link created: ${logLink}`);
    
    // Get Agent Smith content
    const agentSmithContent = await getAgentSmithContent(email);
    
    // Create complete HTML email with proper structure for email clients
    const htmlContent = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Personalized Agent Smith Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #000000;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td>
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse;">
          <tr>
            <td style="padding: 20px;">
              <!-- Email Header -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="font-size: 24px; font-weight: bold; color: #000000; padding-bottom: 20px;">
                    Welcome to Agent Smith, ${name}!
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 15px; color: #000000;">
                    We've prepared a personalized response for you:
                  </td>
                </tr>
              </table>
              
              <!-- Personalized Content -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color: #000000;">
                    ${agentSmithContent}
                  </td>
                </tr>
              </table>
              
              <!-- Invitation Section -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-top: 30px; color: #000000;">
                    To access your Agent Smith dashboard and complete your account setup, please click the invitation link below:
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 0;">
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: #4CAF50; border-radius: 4px; text-align: center;">
                          <a href="${magicLink}" style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-weight: bold;">Accept Invitation</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="color: #000000;">
                    This link will expire in 24 hours. If you did not request this invitation, please ignore it.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
    
    // Send combined email through Resend
    const emailResult = await sendEmail(email, name, 'Your Personalized Agent Smith Invitation', htmlContent);
    console.log(`[handleInviteEmail] Email sent result:`, emailResult);
    
    return new Response(JSON.stringify({
      success: true
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error(`[handleInviteEmail] Error:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200,  // Still return 200 to prevent Supabase from retrying
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

// Get Agent Smith job content for user
async function getAgentSmithContent(email) {
  console.log(`[getAgentSmithContent] Fetching job for email: ${email}`);
  
  try {
    // Log the Supabase client configuration (without sensitive info)
    console.log(`[getAgentSmithContent] Supabase URL: ${supabaseUrl ? 'Set' : 'Not set'}`);
    console.log(`[getAgentSmithContent] Supabase Service Key: ${supabaseServiceKey ? 'Set' : 'Not set'}`);
    
    // Use ilike for case-insensitive matching and bypass RLS with service role
    // First, check if we have any jobs at all for this email (regardless of status)
    const { data: allJobs, error: allJobsError } = await supabase.from('jobs').select('id, status, email')
      .ilike('email', email)
      .order('created_at', { ascending: false });
    
    if (allJobsError) {
      console.error(`[getAgentSmithContent] Error fetching all jobs:`, allJobsError);
    } else {
      console.log(`[getAgentSmithContent] Found ${allJobs?.length || 0} total jobs for ${email}`);
      if (allJobs && allJobs.length > 0) {
        console.log(`[getAgentSmithContent] Job statuses:`, allJobs.map(j => j.status));
      }
    }
    
    // Try to find any job for this email, even if not completed
    // Use case-insensitive matching with ilike
    const { data: anyJob, error: anyJobError } = await supabase.from('jobs').select('*')
      .ilike('email', email)
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (anyJobError) {
      console.error(`[getAgentSmithContent] Error fetching any job:`, anyJobError);
    } else {
      console.log(`[getAgentSmithContent] Any job found: ${!!anyJob && anyJob.length > 0}`);
      if (anyJob && anyJob.length > 0) {
        console.log(`[getAgentSmithContent] Found job with status: ${anyJob[0].status}`);
      }
    }
    
    // Query the most recent completed job for this email (case insensitive)
    const { data, error } = await supabase.from('jobs').select('*')
      .ilike('email', email)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1);
    
    console.log(`[getAgentSmithContent] Completed jobs query result:`, { 
      hasData: !!data, 
      dataLength: data?.length || 0, 
      error 
    });
    
    if (error) {
      console.error(`[getAgentSmithContent] Error fetching completed job:`, error);
      return '<p>Thank you for trying Agent Smith! We encountered an error retrieving your personalized content.</p>';
    }
    
    if (!data || data.length === 0) {
      console.log(`[getAgentSmithContent] No completed jobs found for ${email}`);
      
      // If we found any job (even if not completed), use a more specific message
      if (anyJob && anyJob.length > 0) {
        const status = anyJob[0].status;
        console.log(`[getAgentSmithContent] Using fallback content for job with status: ${status}`);
        
        if (status === 'pending' || status === 'scraping') {
          return `<p>Thank you for trying Agent Smith! We're currently researching your business website and preparing your personalized content. This usually takes about 5-10 minutes. Please check your dashboard soon!</p>`;
        } else if (status === 'failed') {
          return `<p>Thank you for trying Agent Smith! We encountered an issue while processing your request. Our team has been notified and will look into it. Please try again later or contact support.</p>`;
        }
      }
      
      return '<p>Thank you for trying Agent Smith! Your personalized content is being prepared and will be available in your dashboard soon.</p>';
    }
    
    // Extract email content from job
    const job = data[0];
    console.log(`[getAgentSmithContent] Found job ID: ${job.id}, created at: ${job.created_at}`);
    
    // Get HTML content from email_draft
    let htmlContent = '';
    
    if (job.email_draft && typeof job.email_draft === 'object' && job.email_draft.body) {
      // Get HTML content from the body field
      htmlContent = job.email_draft.body;
      console.log(`[getAgentSmithContent] Using HTML content from email_draft.body`);
    } else {
      // Fallback message if no content is found
      htmlContent = '<p>Your personalized email is being prepared and will be available in your dashboard soon.</p>';
      console.log(`[getAgentSmithContent] No email content found, using fallback message`);
    }
    
    // Format HTML content for email compatibility
    const styledHtmlContent = htmlContent
      // Style paragraphs for email
      .replace(/<p>/g, '<p style="margin: 0 0 16px 0; padding: 0; line-height: 1.6; color: #000000;">')
      // Convert headings to styled paragraphs
      .replace(/<h[1-6]>/g, '<p style="margin: 0 0 16px 0; padding: 0; font-weight: bold; font-size: 16px; line-height: 1.6; color: #000000;">')
      .replace(/<\/h[1-6]>/g, '</p>')
      // Ensure strong tags have color
      .replace(/<strong>/g, '<strong style="color: #000000;">')
      // Ensure em tags have color
      .replace(/<em>/g, '<em style="color: #000000;">');
    
    // Log a sample of the HTML content
    const sampleHtml = styledHtmlContent.substring(0, 100) + '...';
    console.log(`[getAgentSmithContent] Sample HTML content: ${sampleHtml}`);
    
    // For table-based email layout, we need to return just the content
    // without additional wrappers since it will be placed in a table cell
    return styledHtmlContent;
  } catch (fetchError) {
    console.error(`[getAgentSmithContent] Exception fetching job:`, fetchError);
    return '<p>Thank you for trying Agent Smith! We encountered an unexpected error.</p>';
  }
}

// Hook handler
serve(async (req) => {
  // Enhanced logging - Initial request
  console.log('==== HOOK TRIGGERED ====');
  console.log('Time:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Log all environment variables (without values for security)
  const envVars = Object.keys(Deno.env.toObject());
  console.log('Available environment variables:', envVars);
  
  // Log headers in detail
  console.log('Request headers:');
  for (const [key, value] of req.headers.entries()) {
    console.log(`  ${key}: ${key.toLowerCase() === 'authorization' ? '[REDACTED]' : value}`);
  }
  
  try {
    // Verify webhook secret (implementation depends on your secret format)
    const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET');
    console.log('Hook secret available:', !!hookSecret);
    if (!hookSecret) {
      console.error('CRITICAL ERROR: SEND_EMAIL_HOOK_SECRET environment variable is not set');
    }
    // Add secret verification here if needed
    
    // Log request body
    const requestText = await req.text();
    console.log('Raw request body:', requestText);
    
    // Parse JSON payload
    let payload;
    try {
      payload = JSON.parse(requestText);
      console.log('Parsed payload:', JSON.stringify(payload, null, 2));
    } catch (parseError) {
      console.error('Failed to parse request body as JSON:', parseError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON payload'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Extract payload data - new Supabase Auth webhook format
    // The payload structure is different for invite emails
    console.log('Checking payload structure...');
    
    // Check if this is the new invite format
    if (payload.user && payload.email_data) {
      console.log('Detected invite email format');
      const email = payload.user.email;
      const type = payload.email_data.email_action_type;
      const userData = payload.user;
      
      console.log('Email:', email);
      console.log('Type:', type);
      console.log('User data available:', !!userData);
      
      // Handle invite emails
      if (type === 'invite') {
        console.log('Processing invite email');
        // Continue processing with the invite data
        return await handleInviteEmail(email, userData, payload.email_data);
      } else {
        console.log(`Not handling email action type: ${type}`);
        return new Response(JSON.stringify({
          success: false,
          error: `Not handling this email action type: ${type}`
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }
    
    // Legacy format handling
    const { email, type, data } = payload;
    console.log('Email:', email);
    console.log('Type:', type);
    console.log('Data available:', !!data);
    
    // Only handle magic link emails in legacy format
    if (type !== 'magiclink') {
      console.log(`Not handling email type: ${type}`);
      return new Response(JSON.stringify({
        success: false,
        error: `Not handling this email type: ${type}`
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Legacy format - Get the magic link URL
    const magicLink = data.action_link;
    
    // Legacy format - Get user information
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(data.user.id);
    if (userError) throw userError;
    
    const name = userData.user?.user_metadata?.name || 'there';
    
    // Get Agent Smith content
    const agentSmithContent = await getAgentSmithContent(email);
    
    // Create combined email HTML
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="padding: 20px;">
          <h2>Your Personalized Agent Smith Response</h2>
          ${agentSmithContent}
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p>To access your Agent Smith dashboard and complete your account setup, please click the verification link below:</p>
            <a href="${magicLink}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">Verify Account</a>
            <p>This link will expire in 24 hours. If you did not request this email, please ignore it.</p>
          </div>
        </div>
      </div>
    `;
    
    // Send combined email through Mailtrap
    await sendEmail(email, name, 'Your Personalized Response from Agent Smith', htmlContent);
    
    return new Response(JSON.stringify({
      success: true
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('==== EMAIL HOOK ERROR ====');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // Log environment state at time of error
    console.error('Environment variables available:', Object.keys(Deno.env.toObject()));
    console.error('MAILTRAP_API_TOKEN available:', !!Deno.env.get('MAILTRAP_API_TOKEN'));
    console.error('MAILTRAP_SENDER_EMAIL available:', !!Deno.env.get('MAILTRAP_SENDER_EMAIL'));
    
    // Return success to prevent Supabase from retrying
    // If we fail, Supabase will fall back to its standard email
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      errorType: error.constructor.name,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  // If we reach here without returning, something unexpected happened
  console.error('Function reached end without proper response');
  return new Response(JSON.stringify({
    success: false,
    error: 'Function execution completed without proper handling'
  }), {
    status: 500,
    headers: {
      'Content-Type': 'application/json'
    }
  });
});
