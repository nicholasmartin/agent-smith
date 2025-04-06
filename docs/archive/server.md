# Serverless Challenges & Background Job Solutions

## Current Challenge

Agent Smith currently faces a fundamental challenge with background processing in Vercel's serverless environment:

1. **Serverless Execution Model**: Functions are ephemeral - they spin up to handle a request and terminate afterward
2. **Timeout Limitations**: Vercel has execution time limits (10-15s on free tier, up to 60s on Pro)
3. **No Persistent Processes**: Background tasks using `setTimeout` or similar methods are lost when the function terminates
4. **Web Scraping Duration**: The Firecrawl extraction process often exceeds these timeout limits

This creates a conflict between our need to perform long-running web scraping operations and the constraints of the serverless platform.

## Solution Options

### 1. Vercel Cron Jobs (Recommended for Simplicity)

- Use Vercel's built-in cron jobs to periodically check and process pending jobs
- Store job information in persistent storage (Vercel KV, database)
- Configure in `vercel.json` with a schedule (e.g., every minute)
- Pros: Native to Vercel, simple to implement
- Cons: Limited scheduling flexibility, minimum 1-minute intervals

### 2. External Queue Service

- Implement a dedicated queue system (AWS SQS, RabbitMQ, Bull+Redis)
- Workers pull jobs from the queue and process them
- Pros: Robust, scalable, handles retries and failures
- Cons: Additional infrastructure, more complex setup

### 3. Webhook-Based Architecture

- Have Firecrawl call back to a webhook when extraction completes
- Requires Firecrawl to support webhooks or building a custom solution
- Pros: Real-time processing, no polling needed
- Cons: Requires webhook support from third-party services

### 4. Hybrid Architecture

- Use serverless for API endpoints and immediate responses
- Deploy separate long-running services (containers/VMs) for background processing
- Pros: Best of both worlds, no timeout constraints for processing
- Cons: More complex infrastructure, higher costs

### 5. Traditional Server Deployment (Simplest Solution)

- Convert the application from serverless to a traditional Node.js Express server
- Deploy to a VM, container, or dedicated hosting (DigitalOcean, AWS EC2, Heroku, etc.)
- Background processes run in the same long-lived process as the API server
- Pros: Simplest conceptually, no architectural changes needed, supports long-running processes
- Cons: Less auto-scaling, requires server management, potentially higher base costs

## Implementation Recommendation

For the current stage of Agent Smith, two approaches stand out:

**Option A: Traditional Server Deployment**
The simplest solution conceptually is to deploy Agent Smith as a traditional Express server on a platform like DigitalOcean, AWS EC2, or Heroku. This approach:
- Requires minimal code changes
- Allows background processes to run naturally
- Eliminates the need for complex job management
- Works with your existing setTimeout-based polling

**Option B: Vercel Cron Jobs**
If staying with Vercel is preferred, the Cron Jobs approach offers a good balance:

1. Store job information in Vercel KV or a database
2. Create a cron endpoint that runs every minute to check pending jobs
3. Process completed jobs and update their status

This solution works within Vercel's constraints while enabling the long-running extraction processes needed for the application.
