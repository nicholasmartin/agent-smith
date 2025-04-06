Development Document: Agent Smith MVP
Project Overview
Build an API service that receives new signup information, researches business domains via web scraping, and generates personalized email drafts using AI, then posts these to a Slack channel.
Tech Stack

Backend: Node.js with Express
Deployment: Vercel
Database: Supabase (PostgreSQL)
Web Scraping: Firecrawl API
AI Generation: OpenAI API
Notification: Slack Webhook
Authentication: Simple API key validation

flowchart TD
    A[Company API Call] --> B[Express Server]
    B --> C{Check Email Domain}
    C -->|Free Domain| D[Ignore]
    C -->|Business Domain| E[Create Job in Supabase]
    E --> F[Firecrawl Scraper]
    F --> G[OpenAI API]
    G --> H[Update Job Status]
    H --> I[Slack Webhook]

Core Components

1. Email Processor (emailProcessor.js): Orchestrates the workflow
2. Domain Checker (domainChecker.js): Validates if email is from a business domain
3. Job Store (jobStore.js): Manages job persistence in Supabase
4. Web Scraper (webScraper.js): Uses Firecrawl API to extract website data
5. Email Generator (emailGenerator.js): Uses OpenAI to generate personalized emails
6. Slack Notifier (slackNotifier.js): Sends notifications to Slack

MVP System ArchitectureDiagram: @docs/system-architecture.mermaid

Implementation Guide
1. Project Setup: @docs/project-setup.sh

2. Core Implementation
   - Email Processing Workflow: src/emailProcessor.js
   - Domain Checker: src/domainChecker.js
   - Job Store: src/jobStore.js
   - Website Scraper: src/webScraper.js
   - Email Generator: src/emailGenerator.js
   - Slack Notifier: src/slackNotifier.js

3. Database Setup
   - Supabase migrations in supabase/migrations/
   - Jobs table for tracking processing status
   - Companies and prompt templates for multi-tenant support

4. Vercel Deployment
   - Deploy as serverless functions
   - Configure environment variables for API keys

Additional Setup Requirements

Dependencies:
```bash
npm install serverless-http @supabase/supabase-js --save
```

Project Structure:
```
agent-smith/
├── .env
├── package.json
├── server.js
├── src/
│   ├── domainChecker.js
│   ├── emailGenerator.js
│   ├── emailProcessor.js
│   ├── jobStore.js
│   ├── slackNotifier.js
│   ├── supabaseClient.js
│   └── webScraper.js
├── supabase/
│   └── migrations/
│       ├── 20250405094700_create_jobs_table.sql
│       └── [additional migration files]
└── public/
    ├── index.html
    ├── dashboard.html
    ├── new-signup.html
    └── css/
        ├── base.css
        ├── components.css
        ├── layout.css
        └── main.css
```

Environment Variables:
```
OPENAI_API_KEY=your_openai_api_key
FIRECRAWL_API_KEY=your_firecrawl_api_key
SLACK_WEBHOOK_URL=your_slack_webhook_url
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
API_KEY=your_api_key_for_authentication
```


Deployment Instructions

Local development:
```bash
npm install
node server.js
```

API Endpoints
- `POST /api/process-signup`: Main endpoint to process new signups
- `GET /api/jobs`: Lists all active jobs
- `GET /api/job-status/:jobId`: Checks status of a specific job
- `GET /api/test-connectivity`: Tests connectivity to external services
- `GET /api/test-firecrawl`: Tests the Firecrawl SDK

Database Schema

**Jobs Table**
```sql
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  scrape_job_id TEXT,
  scrape_result JSONB,
  email_draft JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0
);
```

Multi-Tenant Support

See the detailed implementation guide in [multi-tenant-prompt-implementation.md](./multi-tenant-prompt-implementation.md) for adding support for multiple companies with custom email templates.


DO NOT CHANGE BELOW!!!!!

Testing The API
Invoke-WebRequest -Uri "https://agent-smith.magloft.com/api/process-signup" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "X-API-Key" = "em4il_p3rs0n_ag3nt_hj49dh4kl0s74jh31"
  } `
  -Body '{"email":"markus.luethi@e-publish.ch","name":"Markus Luethi"}'


Invoke-WebRequest -Uri "https://agent-smith.magloft.com/api/jobs" `
  -Method GET `
  -Headers @{
    "X-API-Key" = "em4il_p3rs0n_ag3nt_hj49dh4kl0s74jh31"
  } `

