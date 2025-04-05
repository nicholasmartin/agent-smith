Development Document: Agent Smith MVP
Project Overview
Build an API service that receives new signup information, researches business domains via web scraping, and generates personalized email drafts using AI, then posts these to a Slack channel.
Tech Stack

Backend: Node.js with Express
Deployment: Vercel
Web Scraping: Firecrawl API
AI Generation: OpenAI API
Notification: Slack Webhook
Authentication: Simple API key validation

Core Components

MVP System ArchitectureDiagram: @docs/system-architecture.mermaid

Implementation Guide
1. Project Setup: @docs/project-setup.sh

2. Core Implementation
Email Processing Workflow: @src/email-processor.js
Domain Checker: @src/domain-checker.js
Website Scraper: @src/web-scraper.js
Email Generator: @src/email-generator.js
Slack Notifier: @src/slack-notifier.js

4. Vercel Deployment
We will use Windsurf built-in functionality for this

Additional Setup Requirements

Dependencies:
bashCopynpm install serverless-http --save

Project Structure:
agent-smith/
├── .env
├── package.json
├── server.js
├── src/
│   ├── domainChecker.js
│   ├── emailGenerator.js
│   ├── emailProcessor.js
│   ├── slackNotifier.js
│   └── webScraper.js
└── public/
    └── index.html


Deployment Instructions

Local development:
bashCopynpm install
node server.js

Testing The API
Invoke-WebRequest -Uri "https://agent-smith.magloft.com/api/process-signup" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "X-API-Key" = "em4il_p3rs0n_ag3nt_hj49dh4kl0s74jh31"
  } `
  -Body '{"email":"shawn@pastryartsmag.com","name":"Shawn Wenner"}'


Invoke-WebRequest -Uri "https://agent-smith.magloft.com/api/jobs" `
  -Method GET `
  -Headers @{
    "X-API-Key" = "em4il_p3rs0n_ag3nt_hj49dh4kl0s74jh31"
  } `


API Authentication
The API uses a simple API key validation to prevent abuse. Clients must include the API key in the X-API-Key header with each request.

Error Handling
For web scraping failures, the system will create a Slack notification to inform the team about the failure. This ensures that the team is aware of any issues with the web scraping process and can take appropriate action.