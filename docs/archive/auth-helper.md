# Supabase Auth Helper Migration Guide

## Overview

This document outlines the necessary changes to migrate from the deprecated `createServerSupabaseClient` function to the recommended `createPagesServerClient` function in the Agent Smith application. 

According to server logs, this warning appears:
> Please utilize the `createPagesServerClient` function instead of the deprecated `createServerSupabaseClient` function. Learn more: https://supabase.com/docs/guides/auth/auth-helpers/nextjs-pages

## Background

Agent Smith's authentication system was previously refactored (as documented in `auth-refactor.md`) to implement server-side authentication middleware and improve the magic link authentication flow. This refactor introduced the use of Supabase's authentication helpers, including the now-deprecated `createServerSupabaseClient` function.

## Affected Files

The following files in the Agent Smith codebase currently use the deprecated function:

1. `api/auth/callback.js` - Handles authentication callbacks including magic link verification
2. `src/middleware/auth.js` - Provides server-side authentication middleware

## Required Changes

### 1. Update Package Dependencies

First, ensure the Supabase auth helpers package is updated to the latest version:

```bash
npm install @supabase/auth-helpers-nextjs@latest
```

### 2. Update Import Statements

In each affected file, update the import statement from:

```javascript
const { createServerSupabaseClient } = require('@supabase/auth-helpers-nextjs');
```

To:

```javascript
const { createPagesServerClient } = require('@supabase/auth-helpers-nextjs');
```

### 3. Update Function Calls

Replace all instances of `createServerSupabaseClient` with `createPagesServerClient`. The function signature and parameters remain the same:

```javascript
// Before
const supabase = createServerSupabaseClient({ req, res });

// After
const supabase = createPagesServerClient({ req, res });
```

### 4. File-Specific Updates

#### api/auth/callback.js

The auth callback handler is used to process authentication tokens and establish user sessions:

```javascript
// Line 13: Replace import
const { createPagesServerClient } = require('@supabase/auth-helpers-nextjs');

// Line 18: Replace function call
const supabase = createPagesServerClient({ req, res });
```

#### src/middleware/auth.js

This middleware provides authentication across the application and is imported in server.js:

```javascript
// Line 9: Replace import
const { createPagesServerClient } = require('@supabase/auth-helpers-nextjs');

// Line 17: Replace function call
const supabase = createPagesServerClient({ req, res });
```

### 5. Verify Process-Jobs Cron Job

Although the warning message mentions `process-jobs.js`, direct usage of `createServerSupabaseClient` was not found in either:
- `api/cron/process-jobs.js`
- `pages/api/cron/process-jobs.js`

This could indicate that:
1. The function is being used indirectly through another imported module
2. The warning is related to a dependency used by these files
3. The warning might be triggered by auth middleware applied to the cron endpoints

After updating the identified instances, monitor logs to see if the warning persists for the cron job. If it does, examine any middleware or imported modules used in the cron job that might still reference the deprecated function.

## Authentication Flow Impact

This migration should not impact the existing authentication flow:

1. **Server Middleware**: The `authMiddleware` function will continue to create a Supabase client and attach it to the request
2. **Protected Routes**: The `protectedRouteMiddleware` will still verify authentication status
3. **Magic Link Processing**: The auth callback handler will still process magic links and establish sessions
4. **Dashboard Access**: Users should still be able to access the dashboard after authentication

## Testing After Migration

After making these changes, thoroughly test the following functionality:

1. **Authentication Flows**:
   - Magic link login
   - User session persistence
   - Email invitation link authentication

2. **Protected Routes**:
   - Dashboard access after authentication
   - API endpoints that require authentication
   - Proper redirection for unauthenticated users

3. **System Functions**:
   - Cron job execution and authentication
   - Email sending with authentication links
   - User profile access

## Compatibility Notes

- The `createPagesServerClient` function maintains the same API interface as `createServerSupabaseClient`
- No changes to how the client is used after initialization should be necessary
- This change is part of Supabase's effort to provide clearer naming conventions for their auth helpers

## References

- [Supabase Auth Helpers Documentation](https://supabase.com/docs/guides/auth/auth-helpers/nextjs-pages)
- [Supabase NextJS Integration](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [Agent Smith Auth Refactor Document](./auth-refactor.md)
