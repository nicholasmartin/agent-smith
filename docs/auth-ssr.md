# Supabase SSR Authentication Refactoring Documentation

## Overview

This document outlines the complete refactoring of Agent Smith's authentication system to use Supabase's recommended server-side rendering (SSR) cookie-based approach. The refactoring addressed persistent authentication issues, simplified the architecture, and improved reliability by eliminating client-server session mismatches.

## Key Problems Addressed

1. **Inconsistent Session State**: Previous implementation suffered from mismatches between client-side and server-side auth state
2. **Token Management Complexity**: Manual token extraction, storage, and refresh logic led to bugs and edge cases
3. **Browser Security Policies**: Issues with localStorage/cookies across redirects and different contexts
4. **Authentication Flow Reliability**: Email verification, magic links, and password reset flows were brittle

## Core Architecture Changes

### Before Refactoring
- Mixed authentication approach using both localStorage and cookies
- Manual extraction/management of JWT tokens 
- Custom token refresh logic
- Multiple sources of truth for auth state
- Complex redirect chains through various authentication pages

### After Refactoring
- Single source of truth: Supabase's cookie-based authentication
- Standardized `@supabase/ssr` package for all auth operations
- Consistent client creation on both server and client sides
- Simplified auth flows with proper session persistence
- Bundled dependencies for better reliability and version control

## Implementation Details

### 1. Client-Side Changes

#### Supabase Client Initialization
```javascript
// Previously: Multiple initialization methods and sources of truth
// Now: Centralized creation with @supabase/ssr

// In src/client/supabase-browser.js
import { createBrowserClient } from '@supabase/ssr';

export const supabaseClient = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey
);
```

#### Authentication Pages
- **Login**: Simplified to use cookie-based auth with proper redirects
- **Signup**: Updated to use centralized client with cookie persistence
- **Auth-Callback**: Consolidated token handling for magic links, email verification, and password reset

### 2. Server-Side Changes

#### Authentication Middleware (src/middleware/auth.js)
```javascript
// Previously: Complex token extraction and refresh logic
// Now: Simple cookie-based authentication

function authMiddleware(req, res, next) {
  req.supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies?.[name],
        set: (name, value, options) => {
          res.cookie(name, value, {
            ...options,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
          });
        },
        remove: (name, options) => res.clearCookie(name, options)
      }
    }
  );
  
  next();
}
```

#### Protected Route Middleware
```javascript
// Previously: Complex authentication checks with token refresh
// Now: Simple session check

async function protectedRouteMiddleware(req, res, next) {
  const { data: { session } } = await req.supabase.auth.getSession();
  
  if (!session) {
    return res.redirect('/login.html');
  }
  
  req.user = session.user;
  next();
}
```

### 3. Dependency Management Improvements

- **Bundled Dependencies**: Moved from CDN-loaded scripts to properly bundled JavaScript
- **Webpack Implementation**: Added build process for client-side code
- **Version Control**: Standardized on specific versions for all Supabase packages
- **Removed Redundant Packages**: Eliminated `@supabase/auth-helpers-nextjs` in favor of `@supabase/ssr`

### 4. Files Removed or Significantly Changed

#### Removed Files:
- `public/js/supabase-client.js` (replaced by modular implementation)
- `public/js/config.js` (functionality moved to bundled modules)
- `public/js/auth.js` (functionality incorporated into page bundles)
- `public/js/auth-handler.js` (replaced by auth-callback bundle)
- `src/auth/magicLinkGenerator.js` (no longer needed with SSR approach)
- `src/auth/passwordAuth.js` (replaced by standard Supabase auth)
- `src/routes/auth/create-password.js` (deprecated flow)
- `src/routes/auth/login.js` (authentication now handled client-side)

#### Major Changes:
- `src/middleware/auth.js` (simplified with cookie-based approach)
- All authentication HTML pages (login, signup, auth-callback, dashboard)
- Vercel deployment configuration (added build steps)

## Authentication Flows

### Signup Flow
1. User enters email/password and submits form
2. Supabase client sends signup request
3. Cookies are automatically set by `@supabase/ssr`
4. Email verification is sent if required
5. User confirms email and is redirected to auth-callback
6. Session is established via cookies
7. User is redirected to dashboard

### Login Flow
1. User enters credentials
2. Supabase client authenticates
3. Cookies are automatically set by `@supabase/ssr`
4. User is redirected to dashboard

### Password Reset Flow
1. User requests password reset
2. Email sent with reset link
3. User clicks link and is directed to auth-callback
4. Token parameters are handled automatically
5. User creates new password
6. Session is established via cookies
7. User is redirected to dashboard

## Key Security Considerations

1. **Cookie Security**: All auth cookies are set with proper security parameters:
   - `secure: true` in production
   - `sameSite: lax` to prevent CSRF
   - `httpOnly: true` to prevent JavaScript access

2. **CSRF Protection**: Forms include standard CSRF protections

3. **Environment Variables**: Consistent validation of required env variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Common Issues and Debugging

### Issue: Session Not Persisting
- Check if cookies are being properly set in the browser
- Verify Supabase client is created with correct parameters
- Ensure protected routes are using the middleware correctly

### Issue: Redirects Not Working
- Check auth-callback.html for proper token extraction
- Verify redirect URLs are correctly formatted
- Ensure client-side routing doesn't interfere with authentication

### Issue: Authentication Errors
- Verify environment variables are correctly set
- Check browser console for client-side errors
- Examine server logs for middleware issues

## Testing Checklist

- [ ] User signup with email verification
- [ ] Email verification flow
- [ ] User login with credentials
- [ ] Password reset flow
- [ ] Protected route access
- [ ] Session persistence across page reloads
- [ ] Session persistence across browser restarts
- [ ] API authentication
- [ ] Logout functionality

## References

- [Supabase SSR Documentation](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers)
- [@supabase/ssr Package](https://www.npmjs.com/package/@supabase/ssr)
