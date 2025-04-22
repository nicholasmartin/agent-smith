# Refactoring Supabase Session Handling

## Overview

This document outlines the high-level steps and rationale for refactoring the Supabase authentication and session management flow in the Agent Smith application. The goal is to consolidate session handling, resolve conflicts, and ensure a seamless authentication experience for users, especially when using magic links from invitation or welcome emails.

---

## Why Refactor Session Handling?

- **Multiple Session Handlers:** The current implementation uses both `session-handler.js` (dashboard-specific) and `supabase-client.js` (global), leading to potential conflicts and race conditions.
- **Magic Link Issues:** Users experience errors (e.g., "One-time token not found") or get redirected to the login page after clicking verification links.
- **Session Persistence:** Inconsistent session establishment causes protected routes to fail authentication checks.

---

## Refactor Objectives

1. **Single Source of Truth:** Unify all session management logic into one place, using Supabase's built-in functions.
2. **Robust Magic Link Handling:** Ensure magic link tokens are processed correctly, establishing the session reliably.
3. **Consistent Protected Route Checks:** Always check authentication state after the session is established.
4. **Clean URL Handling:** Remove sensitive tokens from the URL after processing for better security and UX.

---

## High-Level Steps

### 1. Remove Redundant Session Handlers
- **Delete or deprecate** `session-handler.js`.
- **Move all session logic** into `supabase-client.js` or a new unified module.

### 2. Centralize Session Initialization
- On every page load, check for authentication parameters (e.g., `access_token`, `refresh_token`) in the URL hash.
- If present, use `supabase.auth.setSession()` to establish the session.
- Wait for the session to be established before checking protected routes.

**Example:**
```js
// Pseudocode for unified session handler
const hashParams = new URLSearchParams(window.location.hash.substring(1));
if (hashParams.has('access_token') && hashParams.has('refresh_token')) {
  await supabase.auth.setSession({
    access_token: hashParams.get('access_token'),
    refresh_token: hashParams.get('refresh_token'),
  });
}
```

### 3. Improve Protected Route Enforcement
- After session establishment, check if the user is authenticated before accessing protected pages (like `/dashboard`).
- Redirect unauthenticated users to the login page.

**Example:**
```js
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  window.location.href = '/login.html';
}
```

### 4. Clean Up the URL
- After processing authentication tokens, remove them from the URL to prevent exposure and maintain a clean browser history.

**Example:**
```js
window.history.replaceState({}, document.title, window.location.pathname);
```

### 5. Add Logging and Error Handling
- Log key events (e.g., session established, errors) for easier debugging.
- Handle failures gracefully, providing user feedback if authentication fails.

---

## Additional Considerations

- **Token Expiry:** Make sure to handle expired or invalid tokens by prompting the user to request a new magic link.
- **Redirects:** Use the `redirect_to` parameter in magic links to send users to the intended page after authentication.
- **Testing:** Test the flow end-to-end, including edge cases like expired tokens and direct dashboard access.

---

## Summary

By consolidating session handling and improving magic link processing, we can:
- Eliminate race conditions and redundant logic
- Ensure users are authenticated seamlessly after clicking email links
- Provide a secure, user-friendly authentication experience

**Next Steps:**
- Implement the above changes in the codebase
- Remove legacy session handling files
- Thoroughly test the new flow

For more details, refer to the relevant code and migration files.
