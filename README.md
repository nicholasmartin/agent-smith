# Agent Smith

An API service that receives new signup information, researches business domains via web scraping, and generates personalized email drafts using AI, then posts these to a Slack channel.

## Project Overview

This service automates the process of creating personalized outreach emails for new signups with business email addresses. It filters out free email providers, scrapes the company website to gather information, uses AI to generate a tailored email, and sends the draft to a Slack channel for review.

## Tech Stack

- **Backend**: Node.js with Express
- **Deployment**: Netlify's continuous deployment with Functions
- **Web Scraping**: Firecrawl API
- **AI Generation**: OpenAI API (GPT-4 Mini)
- **Notification**: Slack Webhook
- **Authentication**: Simple API key validation

## Features

- Filters out free email providers (Gmail, Yahoo, etc.)
- Scrapes company websites to gather business information
- Generates personalized email drafts using OpenAI
- Posts email drafts to Slack for review
- API key authentication to prevent abuse
- Error handling with Slack notifications for scraping failures

## Project Structure

```
agent-smith/
├── .env                     # Environment variables
├── netlify.toml             # Netlify configuration
├── package.json             # Project dependencies
├── server.js                # Express server
├── src/                     # Source files
│   ├── domainChecker.js     # Email domain validation
│   ├── emailGenerator.js    # AI email generation
│   ├── emailProcessor.js    # Main workflow orchestration
│   ├── slackNotifier.js     # Slack integration
│   └── webScraper.js        # Website scraping
├── netlify/                 # Netlify serverless functions
│   └── functions/
│       └── server.js        # Serverless function wrapper
└── public/                  # Static files
    └── index.html           # Simple landing page
```

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure environment variables in `.env`:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `FIRECRAWL_API_KEY`: Your Firecrawl API key
   - `SLACK_WEBHOOK_URL`: Your Slack webhook URL
   - `API_KEY`: Your chosen API key for authentication
   - `PORT`: Server port (default: 3000)

4. Start the server:
   ```
   npm start
   ```

## API Usage

### Process a new signup

**Endpoint**: `POST /api/process-signup`

**Headers**:
```
Content-Type: application/json
X-API-Key: your-api-key-here
```

**Request Body**:
```json
{
  "email": "john@acmecorp.com",
  "name": "John Smith"
}
```

**Response**:
```json
{
  "message": "Signup received and being processed",
  "email": "john@acmecorp.com",
  "name": "John Smith"
}
```

## Deployment

This project is configured for deployment on Netlify:

1. Connect your repository to Netlify
2. Configure environment variables in Netlify's dashboard
3. Deploy using Netlify's continuous deployment

## Local Development

For local development:
```
npm install
npm start
```

The server will run on http://localhost:3000 by default.
