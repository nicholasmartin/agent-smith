# Agent Smith Entry Point Refactoring Plan

## Current Issues

After a comprehensive review of the Agent Smith codebase, we've identified several architectural issues that are likely contributing to authentication problems:

1. **Duplicate Magic Link Generation**:
   - Magic links are generated in multiple places (emailProcessor.js and process-jobs.js)
   - Different environment variables are used for the redirect URL (`PUBLIC_URL` vs `SITE_URL`)
   - Inconsistent parameters across different code paths

2. **Mixed Entry Points**:
   - Web form submissions and API requests share significant code paths
   - User creation logic is not clearly separated from content generation
   - Authentication flows are applied inconsistently

3. **Authentication Redirection Issues**:
   - Redirect URLs may be inconsistent between different generation points
   - Session establishment timing issues are possible
   - Callback handling may not match the generated link parameters

## Fundamental Distinction

There is a fundamental distinction between the two entry points that should be maintained throughout the codebase:

1. **Website Form Submissions** (`/api/website-signup`):
   - Are potential new users of Agent Smith
   - Require authentication (Supabase user creation)
   - Need access to the dashboard
   - Require magic links for passwordless login

2. **API Submissions** (`/api/process-signup`):
   - Are NOT potential new users of Agent Smith
   - Do NOT require user creation in Supabase
   - Do NOT need dashboard access
   - Should generate content only, no authentication

## Refactoring Plan

### 1. Separate Entry Points

Create clear, separate handlers for each entry point that don't share core logic:

```
- api/
  - website-signup.js         # Web form entry point with auth
  - process-signup.js         # API entry point without auth
```

### 2. Core Processing Pipeline

Create a shared core processing pipeline that both entry points can use:

```javascript
// src/jobProcessor.js
async function processJob(job) {
  // Shared logic for domain checking, scraping, content generation
  // No authentication or user creation here
}
```

### 3. Centralized Authentication

Move all authentication logic to a dedicated module:

```javascript
// src/auth/userManager.js
async function createUserWithMagicLink(email, name, options = {}) {
  // Single place for user creation, profile setup, and magic link generation
}
```

### 4. Clean Delivery Logic

Separate delivery mechanisms based on job type:

```javascript
// src/delivery/emailService.js
async function sendWebsiteUserEmail(job, content, magicLink) {
  // Send combined content + auth email
}

async function sendApiResultEmail(job, content) {
  // Send content-only email
}
```

### 5. Consistent Job Model

Update the job model to clearly indicate the source:

```javascript
// src/jobStore.js
async function createJob(data) {
  const jobData = {
    ...data,
    source: data.fromWebsite ? 'website' : 'api',
    requires_auth: data.fromWebsite, // Only website submissions need auth
  };
  // Create the job with clear indicators
}
```

## Implementation Steps

1. **Add Source Distinction**: Update job schema to include explicit source and auth flags
2. **Refactor Email Service**: Create a centralized email service with distinct methods
3. **Centralize Auth Logic**: Move all auth to a single module with consistent URL handling
4. **Update Entry Points**: Clearly separate website and API request handling
5. **Clean Process-Jobs**: Remove authentication logic from the job processor
6. **Add Logging**: Implement detailed logging for authentication flows

## Authentication URLs

Define a single, consistent URL for magic links:

```javascript
// src/config/urls.js
const DASHBOARD_URL = 'https://agent-smith.magloft.com/dashboard';

module.exports = {
  DASHBOARD_URL,
  getMagicLinkUrl: () => DASHBOARD_URL
};
```

## Testing Plan

Once refactored, test both entry points separately:

1. **Website Form Test**:
   - Submit form on homepage
   - Verify user creation in Supabase
   - Check magic link in email points to dashboard
   - Verify login and dashboard access

2. **API Test**:
   - Send API request with valid credentials
   - Verify NO user creation in Supabase
   - Check content generation and email delivery
   - Ensure no authentication components in email

## Expected Benefits

This refactoring will:
1. Fix the current authentication redirect issues
2. Make the codebase more maintainable
3. Allow easier debugging of auth problems
4. Establish clear separation between different service functions
5. Enable easier evolution of each pathway independently

By enforcing this clear separation, we ensure that Agent Smith can reliably serve both direct users and API integrations without confusing the distinct requirements of each path.
