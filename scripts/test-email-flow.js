/**
 * Test script for the new authentication flow
 * This script simulates the entire flow from form submission to email sending
 */
require('dotenv').config();
const emailProcessor = require('../src/emailProcessor');
const jobStore = require('../src/jobStore');
const emailService = require('../src/emailService');
const supabase = require('../src/supabaseClient');

async function testEmailFlow() {
  try {
    console.log('Starting email flow test...');
    
    // Step 1: Process a signup (simulating form submission)
    const testEmail = `test-${Date.now()}@example.com`;
    const testName = 'Test User';
    const companyId = process.env.DEFAULT_COMPANY_ID || '00000000-0000-0000-0000-000000000000';
    
    console.log(`Processing signup for ${testEmail}...`);
    const signupResult = await emailProcessor.processSignup(
      testEmail,
      testName,
      null, // apiKeyId
      companyId,
      true // fromWebsite (true to create user)
    );
    
    console.log('Signup processed:', signupResult);
    
    if (signupResult.status === 'skipped') {
      console.log('Test skipped - free email provider detected');
      return;
    }
    
    const jobId = signupResult.jobId;
    
    // Step 2: Simulate job completion (normally done by the cron job)
    console.log(`Simulating job completion for ${jobId}...`);
    
    // Create a mock email draft
    const mockEmailDraft = {
      subject: 'Your Website Analysis',
      body: `
        <p>Hello ${testName},</p>
        <p>Thank you for your interest in Agent Smith.</p>
        <p>We've analyzed your website and found several opportunities for improvement.</p>
        <p>This is a test email to verify our new authentication flow.</p>
        <p>Best regards,<br>The Agent Smith Team</p>
      `
    };
    
    // Complete the job with the mock email draft
    await jobStore.completeJobWithEmail(jobId, mockEmailDraft);
    console.log('Job marked as completed with email draft');
    
    // Step 3: Get the job with the user ID
    const job = await jobStore.getJobById(jobId);
    console.log('Job retrieved:', job);
    
    if (!job.user_id) {
      console.log('No user ID found for job - cannot continue test');
      return;
    }
    
    // Step 4: Generate a sign-in link
    console.log(`Generating sign-in link for ${testEmail}...`);
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: testEmail,
      options: {
        redirectTo: `${process.env.SITE_URL || 'https://agent-smith.magloft.com'}/dashboard`,
        data: {
          name: testName,
          source: 'agent_smith'
        }
      }
    });
    
    if (linkError) {
      console.error('Error generating sign-in link:', linkError);
      return;
    }
    
    const signInLink = linkData.properties.action_link;
    console.log('Sign-in link generated successfully');
    console.log('Link (redacted):', signInLink.replace(/token=([^&]+)/, 'token=[REDACTED]'));
    
    // Step 5: Send the email
    console.log('Sending test email...');
    const emailResult = await emailService.sendJobCompletionEmail(job, mockEmailDraft, signInLink);
    
    if (emailResult.success) {
      console.log(`Email sent successfully, ID: ${emailResult.emailId}`);
      
      // Mark email as sent
      await jobStore.markEmailSent(jobId);
      console.log('Job marked as email sent');
    } else {
      console.error('Error sending email:', emailResult);
    }
    
    console.log('Email flow test completed successfully!');
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testEmailFlow().catch(console.error);
