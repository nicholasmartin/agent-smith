# Agent Smith User Account Lifecycle & Authentication

This document outlines the intended flow for user signups, account creation, and subsequent logins, addressing potential complexities with magic links and password-based authentication.

## 1. Initial Signup (Web Form)

- **Trigger:** A new user submits the signup form on the website with their name and company email.
- **Client-Side:** The browser sends the `name` and `email` to the `/api/website-signup` backend endpoint. *No Supabase authentication (like `signInWithOtp`) is initiated directly by the client.*
- **Backend:**
    - The `/api/website-signup` endpoint receives the request.
    - It creates a job record in the `jobs` table.
    - It initiates the web scraping process for the user's company domain.
    - **Crucially, it does NOT attempt to create a Supabase Auth user at this stage.**
- **Job Processing:**
    - Once scraping is complete, the backend job processor (`checkJobStatus`):
        - Generates the personalized email content.
        - **Creates the Supabase Auth user** using `supabase.auth.admin.createUser`.
        - **Generates a Magic Link** using `supabase.auth.admin.generateLink` (this doesn't send an email itself).
        - Stores the email draft and the magic link URL in the `jobs` record.
- **Email Sending:**
    - A separate process (`processCompletedJobs`) picks up the completed job.
    - It sends a **single, combined email** containing the personalized content and the generated magic link. The link currently invites the user to access their results/dashboard.

## 2. First Visit to Dashboard & Password Creation (Proposed)

- **Trigger:** The user clicks the magic link from the email for the first time.
- **Authentication:** Supabase authenticates the user via the magic link token and redirects them to `/dashboard`.
- **On Dashboard Load:**
    - Client-side JavaScript checks if the user has previously set a password (this requires adding a flag like `has_set_password` to the `profiles` table, initially `false`).
    - If `has_set_password` is `false`, the UI prompts the user to create a password for their account for easier future access.
    - Upon successful password creation, the backend updates the user's password in Supabase Auth and sets `has_set_password` to `true` in their profile.

## 3. Subsequent Logins

- Users with a password can log in via a standard email/password form (to be added).
- Users can *always* request a new magic link if they prefer or forget their password.

## 4. Handling Returning Users via Web Form (Potential Issue & Solution)

- **Scenario:** A user who has previously signed up (and potentially set a password) submits the web form *again* with the same email address.
- **Current Behavior (Post Client-Side Fix):**
    - The backend `/api/website-signup` is called.
    - The job processing eventually calls `supabase.auth.admin.createUser`, which will fail with a "User already exists" error (as detected earlier).
    - The process *should* continue (assuming the error is handled to fetch the existing user ID).
    - A *new* magic link will be generated via `generateLink`.
    - The user receives the combined email with the new magic link.
- **Potential Problem:** The email phrasing ("Click here to access your results" or similar implying first-time access) might be confusing for a returning user who already has an account and potentially a password.
- **Proposed Solution:**
    1.  **Backend Check:** When processing a job (`checkJobStatus` or `processCompletedJobs`), *before* sending the email, check if the user associated with the job email already exists in `auth.users`.
    2.  **Profile Check:** If the user exists, query their `profiles` table to check the `has_set_password` flag (or determine if a password exists directly via Supabase Auth if possible, though profile flag is easier).
    3.  **Conditional Email Content:**
        - If the user is new OR exists but `has_set_password` is `false`, send the standard email with the magic link inviting them to access their results/dashboard.
        - If the user exists AND `has_set_password` is `true`, modify the email content. Instead of emphasizing the magic link for first-time access, the email could say something like: "We've processed your new request! You can view the results in your dashboard. Log in using your password or click this link for quick access: [Magic Link]". This acknowledges their existing account while still providing the convenience of the magic link.

## Summary

By deferring user creation to the backend, implementing password setup on the first dashboard visit, and adding checks to customize the email content for returning users, we can create a smoother and less confusing experience.
