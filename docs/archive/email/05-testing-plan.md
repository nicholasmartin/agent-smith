# Testing Plan for Email Authentication and Dashboard

This document outlines a comprehensive testing plan to verify the implementation of email authentication and the user dashboard.

## 1. Authentication Flow Testing

### Form Submission
- **Test**: Submit form with business email on homepage
- **Expected**: Form processes successfully, creates job and Supabase user
- **Verification**: Check Supabase database for new user and profile entries

### Email Delivery
- **Test**: Check if Mailtrap receives the intercepted email
- **Expected**: Email contains both the magic link and the AI-generated content
- **Verification**: Examine email in Mailtrap dashboard

### User Authentication
- **Test**: Click magic link in email
- **Expected**: User is authenticated and redirected to dashboard
- **Verification**: User appears in dashboard with password modal

### Password Setting
- **Test**: Set new password via the modal
- **Expected**: Password is set, modal closes, dashboard accessible
- **Verification**: Check Supabase auth user has password set

### Return Login
- **Test**: Logout and login with email/password
- **Expected**: User can login with credentials and access dashboard
- **Verification**: Successful login without magic link

## 2. Dashboard Functionality Testing

### Navigation
- **Test**: Click all sidebar menu items
- **Expected**: Proper navigation between dashboard sections
- **Verification**: Each section loads correctly

### User Profile
- **Test**: Check user information display in header
- **Expected**: User's name and email are correctly displayed
- **Verification**: Information matches Supabase user data

### Responsive Design
- **Test**: View dashboard on different device sizes
- **Expected**: UI adapts appropriately to screen size
- **Verification**: Check mobile and desktop views

## 3. Error Handling

### Invalid Email
- **Test**: Submit form with personal email (gmail, etc.)
- **Expected**: Form shows error about business email requirement
- **Verification**: No job or user is created

### Authentication Failures
- **Test**: Try accessing dashboard without authentication
- **Expected**: Redirect to login page
- **Verification**: Protected routes require authentication

### Password Validation
- **Test**: Try setting weak password
- **Expected**: Form validation prevents submission
- **Verification**: Error message about password requirements

## 4. Integration Testing

### End-to-End Flow
- **Test**: Complete full flow from form submission to dashboard access
- **Expected**: All steps work together seamlessly
- **Verification**: User journey is smooth without errors

## Testing Environments

1. **Local Development**
   - Test with local Supabase instance
   - Use Mailtrap development environment

2. **Staging/Testing**
   - Test with staging Supabase project
   - Verify with test domain before production

3. **Production**
   - Final verification in production environment
   - Monitor logs for any issues

## Test Tracking

Document testing results in a spreadsheet with:
- Test case ID and description
- Pass/Fail status
- Date tested
- Tester name
- Any issues found
- Resolution steps
