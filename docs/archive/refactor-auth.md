# Authentication Refactoring Plan

## Overview

This document outlines the plan to refactor the Agent Smith authentication system from the current problematic implementation to a standard Supabase email+password authentication flow with a separate "trials" table for lead collection.

## Motivation

The current authentication system has several issues:
- Inconsistent user states when creating users without passwords first
- Problems with the "add password later" pattern
- Authentication errors and redirect loops
- Complex session management

By switching to a standard Supabase authentication flow and separating lead collection from user authentication, we'll achieve:
- More reliable authentication
- Cleaner separation of concerns
- Better user experience
- Simplified implementation

## Complete End-to-End Flow

This section outlines the complete flow of events from initial webform submission to user registration and dashboard access, integrating with existing functionality.

### 1. Initial Webform Submission

1. User submits webform with first name, last name, and email
2. System creates a new record in the `trials` table
3. System creates a new job record in the `jobs` table
4. Job is queued for processing

### 2. Email and Website Processing

1. Background worker picks up the job
2. System checks email domain validity
3. System scrapes the website for relevant information
4. System processes the website content and generates personalized email content
5. Job status is updated

### 3. Email Delivery

1. System generates a personalized email with:
   - AI-generated content based on website analysis
   - Link to signup page with pre-populated query parameters (first name, last name, email)
2. Email is sent to the trial user
3. `last_email_sent_at` is updated in the trials table

### 4. User Registration

1. User clicks the signup link in the email
2. User arrives at signup page with pre-populated fields
3. User completes the form and submits
4. Supabase creates a new authenticated user and profile
5. Supabase sends verification email
6. System updates the trial record's `has_registered` flag (via trigger or API)

### 5. Email Verification and Login

1. User clicks verification link in email
2. Account is verified in Supabase
3. User is automatically logged in
4. User is redirected to dashboard

### 6. Dashboard Access

1. System checks authentication status
2. If authenticated, user can access dashboard and features
3. If not authenticated, user is redirected to login page

## Implementation Plan

### 1. Create Trials Table

Create a new "trials" table in Supabase to store information about visitors who submit the webform.

**Table Structure:**
```sql
CREATE TABLE public.trials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  has_registered BOOLEAN DEFAULT false,
  job_id UUID REFERENCES public.jobs(id),
  last_email_sent_at TIMESTAMP WITH TIME ZONE
);

-- Add index for email lookups
CREATE INDEX trials_email_idx ON public.trials(email);
```

### 2. Update Webform Submission Process

Modify the webform submission process to:
1. Store visitor information in the trials table (first name, last name, email)
2. Generate and send an email with a link to the signup page that includes pre-populated data
3. Remove the creation of partial Supabase auth users

**Changes Required:**
- Update homepage webform to collect first name and last name separately
- Update `src/routes/api.js` to handle webform submissions
- Modify `src/emailDelivery.js` to send emails with signup links that include query parameters
- Update email templates in `src/emailService.js`

### 3. Create Traditional Signup Page

Create a standard signup page that uses Supabase's email+password authentication.

**Page Requirements:**
- Fields: First Name, Last Name, Email, Password
- Pre-populate fields from URL query parameters if they exists
- Client-side validation
- Error handling
- Email verification notice

**Implementation:**
- Create `public/signup.html` with the signup form
- Create `public/js/signup.js` for form handling and Supabase integration
  - Include logic to parse URL parameters and pre-fill form fields
- Update `server.js` to serve the signup page

### 4. Implement Email Verification Flow

Ensure proper email verification flow:
1. User registers with email+password
2. Supabase sends verification email
3. User clicks verification link
4. Account is verified
5. User is logged in and redirected to dashboard

**Implementation:**
- Configure Supabase email templates
- Create verification success page or handler
- Implement redirect to dashboard after verification

### 5. Update Trial Record After Registration

Update the trial record when a user registers with the same email:

**Implementation:**
- Create a database trigger or function to update `has_registered` flag
- Alternatively, update via API when user completes registration

### 6. Clean Up Legacy Authentication Code

Remove or refactor files related to the old authentication system:

**Files to Remove:**
- `src/auth/passwordAuth.js` (Replace with standard Supabase auth)
- `src/routes/auth/create-password.js`
- `public/create-password.html`
- `public/js/create-password.js`
- Any magic link related code

**Files to Update:**
- `src/middleware/auth.js` (Simplify to use standard Supabase auth)
- `server.js` (Remove old auth routes)
- `src/emailDelivery.js` (Remove password creation logic)
- `src/emailService.js` (Update email templates)

### 7. Update Dashboard Access

Ensure the dashboard properly checks for authenticated users:

**Implementation:**
- Update `src/routes/dashboard.js` to use standard Supabase auth checks
- Ensure proper session handling in `public/js/auth.js`

## Testing Plan

1. **Trial Submission:**
   - Submit webform with test email
   - Verify data is stored in trials table
   - Verify email is sent with signup link

2. **User Registration:**
   - Click signup link from trial email
   - Verify form is pre-populated with first name, last name, and email
   - Complete registration
   - Verify user is created in Supabase auth
   - Verify verification email is sent

3. **Email Verification:**
   - Click verification link
   - Verify user is verified
   - Verify user is redirected to dashboard

4. **Login Flow:**
   - Test login with verified credentials
   - Verify successful redirect to dashboard
   - Test login with unverified credentials
   - Verify appropriate error message

5. **Trial Update:**
   - Verify trial record is updated when user registers
   - Test with same and different emails

## Migration Considerations

- No data migration is required as we're in development
- Database tables can be created, altered, or dropped as needed
- Focus on optimizing the data structure for the new authentication flow

## Timeline

1. **Phase 1 (Days 1-2):**
   - Create trials table
   - Update webform submission process
   - Create signup page

2. **Phase 2 (Days 3-4):**
   - Implement email verification flow
   - Update trial record after registration
   - Initial testing

3. **Phase 3 (Days 5-7):**
   - Clean up legacy authentication code
   - Update dashboard access
   - Final testing and documentation

## Conclusion

This refactoring will significantly improve the reliability and maintainability of the Agent Smith authentication system by leveraging Supabase's standard authentication features and properly separating lead collection from user authentication.
