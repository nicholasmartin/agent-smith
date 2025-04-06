# Multi-Tenant Prompt System Implementation Guide

This document outlines the step-by-step implementation of a multi-tenant prompt system for Agent Smith, allowing different companies to use the service with their own custom email templates and prompts.

## Overview

The implementation will:
- Store company information and prompt templates in Supabase
- Allow for company-specific customization of email prompts
- Support easy onboarding of new companies
- Maintain backward compatibility

## Implementation Steps

### Step 1: Create Supabase Migration Files

Create the following migration file in the `supabase/migrations` directory, using a new timestamp for the filename to ensure it runs after existing migrations:

**20250406030000_create_multi_tenant_tables.sql**
```sql
-- Create extension for UUID generation if it doesn't exist (should already exist from previous migrations)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  description TEXT,
  website TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

-- Create prompt_templates table
CREATE TABLE IF NOT EXISTS public.prompt_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  tone VARCHAR(50) DEFAULT 'conversational',
  style VARCHAR(50) DEFAULT 'formal',
  max_length INTEGER DEFAULT 200,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_companies_api_key ON public.companies(api_key);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_company_id ON public.prompt_templates(company_id, active);

-- Add RLS policies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access
CREATE POLICY "Service role can do all operations on companies"
  ON public.companies
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can do all operations on prompt_templates"
  ON public.prompt_templates
  USING (true)
  WITH CHECK (true);
```

This migration follows the same pattern as your existing job table migration and includes Row Level Security (RLS) policies similar to your current setup.

### Step 2: Review Existing Supabase Client Module

The project already has a Supabase client module at `src/supabaseClient.js`. Review the existing setup:

```javascript
/**
 * Supabase client module for Agent Smith
 * Provides a configured Supabase client for database operations
 */
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
```

Note that the client is exported directly, so you'll need to adjust your imports in the next steps accordingly.

### Step 3: Create Company Manager Module

Create a new file `src/companyManager.js`:

```javascript
// src/companyManager.js
const supabase = require('./supabaseClient');

/**
 * Get company by API key
 */
async function getCompanyByApiKey(apiKey) {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('api_key', apiKey)
    .eq('active', true)
    .single();
  
  if (error) {
    throw new Error(`Error fetching company: ${error.message}`);
  }
  
  return data;
}

/**
 * Get active prompt template for company
 */
async function getCompanyPromptTemplate(companyId) {
  const { data, error } = await supabase
    .from('prompt_templates')
    .select('*')
    .eq('company_id', companyId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error) {
    throw new Error(`Error fetching prompt template: ${error.message}`);
  }
  
  return data;
}

module.exports = {
  getCompanyByApiKey,
  getCompanyPromptTemplate
};
```

### Step 4: Update Email Generator

Modify `src/emailGenerator.js` to support company-specific prompts:

```javascript
// src/emailGenerator.js
const openai = require('./openaiClient');
const { getCompanyByApiKey, getCompanyPromptTemplate } = require('./companyManager');

/**
 * Generate personalized email based on website data
 */
async function generateEmail(name, email, domain, websiteData, apiKey = null) {
  try {
    // Default company info (fallback for backward compatibility)
    let companyInfo = {
      name: 'MagLoft',
      description: 'MagLoft specializes in software solutions for print and digital publishers. We provide complete solutions for pdf to html conversions, mobile app and web app solutions, custom development and integration services.'
    };
    
    let promptSettings = {
      tone: 'conversational',
      style: 'formal',
      maxLength: 200
    };

    // If API key is provided, get company-specific information
    if (apiKey) {
      try {
        const company = await getCompanyByApiKey(apiKey);
        const promptTemplate = await getCompanyPromptTemplate(company.id);
        
        companyInfo = {
          name: company.name,
          description: company.description || companyInfo.description
        };
        
        promptSettings = {
          tone: promptTemplate.tone || promptSettings.tone,
          style: promptTemplate.style || promptSettings.style,
          maxLength: promptTemplate.max_length || promptSettings.maxLength,
          template: promptTemplate.template
        };
      } catch (error) {
        console.error('Error fetching company information:', error);
        // Fall back to default if company lookup fails
      }
    }

    // Use company-specific template if available, otherwise use default template
    const prompt = promptSettings.template 
      ? processCustomTemplate(promptSettings.template, name, email, domain, websiteData, companyInfo, promptSettings)
      : createDefaultPrompt(name, email, domain, websiteData, companyInfo, promptSettings);
    
    const completion = await openai.createCompletion({
      model: "gpt-3.5-turbo-instruct",
      prompt: prompt,
      max_tokens: 500,
      temperature: 0.7,
    });

    const response = JSON.parse(completion.data.choices[0].text.trim());
    return response;
  } catch (error) {
    console.error('Error generating email:', error);
    return {
      subject: `Welcome to ${companyInfo.name}, ${name}!`,
      body: `Hi ${name},\n\nThank you for signing up for our free trial. I noticed you're from ${websiteData.companyName || domain}.\n\nI'd love to learn more about your needs and show you how our product can help your business. Would you be available for a quick call this week?\n\nBest regards,\nThe Team`
    };
  }
}

/**
 * Process custom prompt template with variables
 */
function processCustomTemplate(template, name, email, domain, websiteData, companyInfo, promptSettings) {
  // Replace template variables with actual values
  return template
    .replace(/\${name}/g, name)
    .replace(/\${email}/g, email)
    .replace(/\${domain}/g, domain)
    .replace(/\${companyName}/g, websiteData.companyName || domain)
    .replace(/\${websiteSummary}/g, websiteData.summary || 'Not available')
    .replace(/\${websiteContent}/g, websiteData.pageText ? websiteData.pageText.substring(0, 1000) + '...' : 'Not available')
    .replace(/\${services}/g, websiteData.services && websiteData.services.length > 0 ? websiteData.services.join(', ') : 'Not specified')
    .replace(/\${ourCompanyName}/g, companyInfo.name)
    .replace(/\${ourCompanyDescription}/g, companyInfo.description)
    .replace(/\${tone}/g, promptSettings.tone)
    .replace(/\${style}/g, promptSettings.style)
    .replace(/\${maxLength}/g, promptSettings.maxLength);
}

/**
 * Create default prompt for OpenAI based on website data
 */
function createDefaultPrompt(name, email, domain, websiteData, companyInfo, promptSettings) {
  return `
Create a personalized email for a new free trial signup with the following information:

Name: ${name}
Email: ${email}
Company domain: ${domain}
Company name: ${websiteData.companyName || domain}

Website summary: ${websiteData.summary || 'Not available'}

Website content: ${websiteData.pageText ? websiteData.pageText.substring(0, 1000) + '...' : 'Not available'}

Services offered: ${websiteData.services && websiteData.services.length > 0 ? websiteData.services.join(', ') : 'Not specified'}

Instructions:
1. Write a brief, personalized email welcoming them to the free trial
2. Reference their company name and business
3. Mention how our product might help their specific needs based on their website
4. Keep in mind that our company (${companyInfo.name}) ${companyInfo.description}
5. Keep it under ${promptSettings.maxLength} words and ${promptSettings.tone} in tone
6. Use a ${promptSettings.style} style
7. Include a question for the new free trial at the end to try and get a reply.

Format your response as a JSON object with 'subject' and 'body' fields.
`;
}

module.exports = {
  generateEmail
};
```

### Step 5: Update Email Processor

Modify `src/emailProcessor.js` to pass the API key to the email generator:

```javascript
// src/emailProcessor.js
// Find the processSignup function and update it to accept and pass along the API key

async function processSignup(signupData, apiKey = null) {
  // Existing code...
  
  // Update this line to pass the API key
  const emailDraft = await emailGenerator.generateEmail(name, email, domain, websiteData, apiKey);
  
  // Rest of the function...
}

// Make sure the API key parameter is added to the exported function
module.exports = {
  processSignup
};
```

### Step 6: Update API Routes

Update your API routes to extract and pass the API key:

```javascript
// In server.js or your API routes file
app.post('/api/process-signup', async (req, res) => {
  try {
    // Extract API key from headers
    const apiKey = req.headers['x-api-key'];
    
    // Validate the request...
    
    // Pass API key to the processor
    const result = await emailProcessor.processSignup(req.body, apiKey);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Step 7: Install Required Dependencies

If not already installed, add Supabase client:

```bash
npm install @supabase/supabase-js
```

### Step 8: Verify Environment Variables

Verify that your `.env` file has the correct Supabase credentials:

```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

These should already be set up in your environment since you're using Supabase with the existing jobs table.

### Step 9: Seed the Database with a Migration

Create another migration file to seed the database with a sample company and prompt template:

**20250406030100_seed_initial_company.sql**
```sql
-- Seed initial company (MagLoft)
INSERT INTO public.companies (name, slug, api_key, description, website, active)
VALUES (
  'MagLoft',
  'magloft',
  'ml_123456789',
  'MagLoft specializes in software solutions for print and digital publishers. We provide complete solutions for pdf to html conversions, mobile app and web app solutions, custom development and integration services.',
  'https://www.magloft.com',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Get the company ID for MagLoft
DO $$
DECLARE
  magloft_id UUID;
BEGIN
  SELECT id INTO magloft_id FROM public.companies WHERE slug = 'magloft';
  
  -- Seed default prompt template for MagLoft
  INSERT INTO public.prompt_templates (company_id, name, template, tone, style, max_length, active)
  VALUES (
    magloft_id,
    'Default Welcome Email',
    'Create a personalized email for a new free trial signup with the following information:\n\nName: ${name}\nEmail: ${email}\nCompany domain: ${domain}\nCompany name: ${companyName}\n\nWebsite summary: ${websiteSummary}\n\nWebsite content: ${websiteContent}\n\nServices offered: ${services}\n\nInstructions:\n1. Write a brief, personalized email welcoming them to the free trial\n2. Reference their company name and business\n3. Mention how our product might help their specific needs based on their website\n4. Keep in mind that our company (${ourCompanyName}) ${ourCompanyDescription}\n5. Keep it under ${maxLength} words and ${tone} in tone\n6. Use a ${style} style\n7. Include a question for the new free trial at the end to try and get a reply.\n\nFormat your response as a JSON object with ''subject'' and ''body'' fields.',
    'conversational',
    'professional',
    200,
    true
  )
  ON CONFLICT DO NOTHING;
END;
$$;
```

This migration follows the standard approach for database seeds, using SQL to insert initial data instead of manually inserting data through the Supabase dashboard.

### Step 10: Test the Implementation

Test your implementation by sending a request with and without an API key to verify both scenarios work correctly.

## Example Usage

Once implemented, you can use the system in the following ways:

1. **For existing MagLoft functionality** - The system will continue to work as before if no API key is provided.

2. **For new companies** - Add the company to the database, create their prompt template, and instruct them to include their API key in the `x-api-key` header when making requests.

## Variables Available in Custom Templates

The following variables can be used in custom prompt templates:

- `${name}` - The user's name
- `${email}` - The user's email
- `${domain}` - The company's domain
- `${companyName}` - The company's name (from website data)
- `${websiteSummary}` - Summary of the website
- `${websiteContent}` - Extracted content from the website
- `${services}` - Services offered by the company
- `${ourCompanyName}` - Name of our company (the tenant)
- `${ourCompanyDescription}` - Description of our company (the tenant)
- `${tone}` - The tone to use (e.g., conversational)
- `${style}` - The style to use (e.g., formal)
- `${maxLength}` - Maximum length of the email

## Future Enhancements

Potential future enhancements to consider:

1. Add a web UI for company and prompt template management
2. Implement version control for prompt templates 
3. Add support for multiple active templates per company
4. Allow A/B testing of different prompt templates
5. Add analytics for email performance by template
