# Authentication Flow Refactor

## Current Challenges

The Agent Smith project currently faces several challenges with its Supabase magic link authentication implementation:

1. **Token Consumption Issues**: Email security scanners prefetch and consume one-time tokens before users can click them
2. **Edge Function Complexity**: The current edge function is handling too many responsibilities, leading to timeouts
3. **Architectural Complexity**: User registration is tied to job processing in the cron system
4. **Reliability Issues**: Authentication failures due to expired or invalid tokens
5. **Debug Difficulty**: Hard to troubleshoot due to distributed responsibility across multiple components

In the current architecture:
- Users submit a form which creates a job but doesn't register them
- A cron job processes the website scraping and AI content generation
- After job completion, an invitation email is sent using `inviteUserByEmail()`
- An edge function attempts to intercept Supabase emails and customize them
- Users receive authentication errors when clicking magic links

## Proposed Solution

We'll simplify the architecture to create a more reliable and maintainable authentication flow while maintaining the user experience of receiving a single email with both AI content and login access.

### Key Architectural Changes

1. **Separate User Registration from Job Processing**
   - Create Supabase users immediately at form submission
   - Use `auth.admin.createUser()` which doesn't send any email
   - Store the user ID with the job from the beginning

2. **Remove Edge Function Dependency**
   - Generate sign-in links programmatically with `auth.admin.generateLink()`
   - Send custom emails directly through Resend.com
   - Eliminate the need to intercept Supabase emails

3. **Simplify Email Flow**
   - Send a single custom email after job completion
   - Include both AI content and authentication link
   - Handle all email sending from the main application

## Implementation Plan

### Phase 1: User Registration at Form Submission

1. **Modify API Endpoint for Form Submission**
   - Add user creation using `auth.admin.createUser()`
   - Store user ID in the jobs table
   - Update form handling code to support this new flow

```javascript
// Example implementation for form submission endpoint
const { email, name, website } = req.body;

// Create user without sending email
const { data: userData, error: userError } = await supabase.auth.admin.createUser({
  email,
  email_confirm: true,
  user_metadata: { name }
});

if (userError) {
  return res.status(400).json({ error: userError.message });
}

// Create job with user ID
const job = await jobStore.createJob({
  email,
  name,
  website,
  user_id: userData.user.id,
  status: 'pending'
});

res.status(200).json({ success: true, jobId: job.id });
```

### Phase 2: Remove Invitation Flow from Job Processing

1. **Modify Process-Jobs.js**
   - Remove the `inviteUserByEmail()` calls
   - Update the job completion logic to send emails directly

2. **Create Email Service**
   - Implement a service to send custom emails with AI content and auth links
   - Generate sign-in links with `auth.admin.generateLink()`
   - Use React Email (https://react.email) to craft professional, responsive emails
   - Continue using Resend.com as the email delivery service

```javascript
// Example implementation for email sending after job completion
async function sendJobCompletionEmail(job, emailContent) {
  // Generate sign-in link
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: job.email,
    options: {
      redirectTo: `${process.env.SITE_URL || 'https://agent-smith.magloft.com'}/dashboard`
    }
  });
  
  if (linkError) {
    console.error(`Error generating sign-in link: ${linkError.message}`);
    return { error: linkError };
  }
  
  // Send email with AI content and sign-in link using React Email and Resend
  const { data: emailData, error: emailError } = await resend.emails.send({
    from: 'Agent Smith <hello@agent-smith.com>',
    to: job.email,
    subject: 'Your Website Analysis + Account Access',
    react: EmailTemplate({
      name: job.name,
      emailContent: emailContent,
      signInLink: linkData.properties.action_link
    })
  });
  
  return { data: emailData, error: emailError };
}
```

### Phase 3: Clean Up Edge Functions and Authentication Flow

1. **Remove or Simplify Edge Function**
   - Since we're sending emails directly, we can remove the email hook

2. **Update Client-Side Authentication**
   - Refine the session handling in `session-handler.js`
   - Ensure proper redirect handling for magic links

3. **Update Dashboard Authentication**
   - Ensure dashboard routes properly handle authentication
   - Update `checkProtectedRoute()` to reflect new auth flow


## Potential Challenges

1. **Email Deliverability**
   - Need to ensure high deliverability rates with custom emails
   - Proper formatting to avoid spam filters

2. **Rate Limits**
   - Be aware of Supabase rate limits for user creation
   - Monitor Resend.com usage for email sending

3. **Email Template Development**
   - Learning and implementing React Email for email templates
   - Testing across various email clients

Note: Since the project is still in development with no real users, we have full flexibility to make database changes, drop tables, or modify structures as needed without migration concerns.
