# Backend Changes for Email Authentication

This document outlines the necessary modifications to the backend code for integrating Supabase authentication and email delivery.

## 1. Modify Email Processor

Update `src/emailProcessor.js` to create Supabase users and prepare for email authentication:

```javascript
// Add these imports at the top if not already present
const supabase = require('./supabaseClient');

// Modify the processSignup function to create a Supabase user
async function processSignup(email, name, apiKeyId, companyId, fromWebsite = false) {
  try {
    console.log(`[EmailProcessor] Processing signup for ${email} from ${fromWebsite ? 'website form' : 'API'}`);
    
    // Step 1: Check if it's a business domain (existing code)
    const { isDomainFree, domain } = domainChecker.checkDomain(email);
    
    if (isDomainFree) {
      console.log(`Skipping free email provider: ${email}`);
      return { status: 'skipped', reason: 'free email provider' };
    }
    
    // Step 2: Create a Supabase Auth user (NEW)
    // Only create user for website form submissions to avoid creating users for API calls
    let userId = null;
    if (fromWebsite) {
      try {
        // Create user with magic link but don't auto-confirm
        // This allows our edge function to intercept the confirmation email
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          email_confirm: false,
          user_metadata: { name },
          app_metadata: { source: 'agent_smith' }
        });
        
        if (authError) throw authError;
        
        // Store the user ID for profile creation
        userId = authData.user.id;
        console.log(`[EmailProcessor] Created Supabase user with ID: ${userId}`);
        
        // Create/update user profile
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            name,
            account_completed: false,
            updated_at: new Date()
          });
          
        if (profileError) {
          console.error(`[EmailProcessor] Error creating profile: ${profileError.message}`);
        }
      } catch (error) {
        // Log auth error but continue with job processing
        console.error(`[EmailProcessor] Auth user creation error: ${error.message}`);
      }
    }
    
    // Step 3: Create a job record with user ID if available (existing code with modifications)
    console.log(`Creating job record for ${name} (${email}) from domain ${domain}`);
    
    const job = await jobStore.createJob({
      email, 
      name, 
      domain, 
      apiKeyId,
      companyId, 
      fromWebsite,
      userId // Add the user ID to link job with user
    });
    
    console.log(`[EmailProcessor] Job created with ID: ${job.id}`);
    
    // Continue with existing code for scraping...
    console.log(`Starting scrape job for domain: ${domain}`);
    const jobInfo = await webScraper.startScrapeJob(domain);
    
    // Update the job record with the scrape job ID
    await jobStore.updateJobWithScrapeId(job.id, jobInfo.jobId);
    
    console.log(`Scrape job started with ID: ${jobInfo.jobId} for ${email}`);
    
    return {
      status: 'processing',
      jobId: job.id,
      scrapeJobId: jobInfo.jobId,
      email,
      domain,
      userId // Include user ID in response if created
    };
  } catch (error) {
    console.error(`Error starting processing for ${email}:`, error);
    throw error;
  }
}
```

## 2. Modify Job Store

Update `src/jobStore.js` to support the user ID field:

```javascript
// Modify the createJob function to accept userId
async function createJob({ email, name, domain, apiKeyId, companyId, fromWebsite, userId }) {
  try {
    // Insert job with user_id if provided
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        email,
        name,
        domain,
        status: 'pending',
        api_key_id: apiKeyId,
        company_id: companyId,
        source: fromWebsite ? 'website' : 'api',
        user_id: userId || null // Store user ID if available
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating job:', error);
    throw error;
  }
}
```

## 3. Update Jobs Table Schema

Create a new Supabase migration to add the user_id column to the jobs table:

```sql
-- Migration: Add user_id to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);

-- Add Row Level Security (RLS) policies for user access
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view own jobs" 
  ON public.jobs 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Admin access for service role
CREATE POLICY "Service role has full access to jobs" 
  ON public.jobs 
  USING (auth.role() = 'service_role');
```

## 4. Remove Slack Notification

Modify the `checkJobStatus` function in `src/emailProcessor.js` to remove Slack notifications:

```javascript
// In the checkJobStatus function, remove or comment out this code:
// await slackNotifier.sendToSlack(job.name, job.email, job.domain, emailDraft, websiteData);

// The email notification will now happen through the Supabase Edge Function instead
```

## 5. Add Endpoint for Returning Users

Add a new endpoint to `server.js` to handle authenticated user requests:

```javascript
// Add to server.js
const { createServerSupabaseClient } = require('@supabase/auth-helpers-nextjs');

// User dashboard endpoints with authentication
app.get('/api/user/jobs', async (req, res) => {
  // Create Supabase client with context from request
  const supabaseServerClient = createServerSupabaseClient({ req, res });
  
  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseServerClient.auth.getUser();
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Get user's jobs
    const { data: jobs, error: jobsError } = await supabaseServerClient
      .from('jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
      
    if (jobsError) {
      return res.status(500).json({ error: 'Error retrieving jobs' });
    }
    
    return res.status(200).json({ jobs });
  } catch (error) {
    console.error('Error in user jobs endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
```


