# Agent Smith Email Authentication & Dashboard

## Project Overview

This document series outlines the implementation plan for adding Supabase authentication and user dashboard to Agent Smith, replacing the Slack notification system with direct email delivery.

## New User Flow

1. **User submits webform**
   - Enters name and business email in the existing form on the homepage

2. **Agent Smith processes the request**
   - Validates business email domain
   - Creates a job in Supabase
   - Scrapes the website using Firecrawl
   - Generates personalized email with OpenAI

3. **Supabase Authentication**
   - Creates new Supabase auth user
   - Creates corresponding profile entry
   - Generates magic link for verification

4. **Email Delivery**
   - Edge function intercepts Supabase's magic link email
   - Combines generated content with authentication link
   - Sends unified email via Mailtrap

5. **User Authentication**
   - User clicks magic link
   - Verification completes in Supabase
   - Redirected to dashboard with password-setting modal
   - After setting password, full dashboard access granted

## Benefits Over Previous Flow

- **Enhanced User Experience**: Delivers results directly to the user rather than to a Slack channel
- **User Retention**: Creates user accounts that allow ongoing engagement
- **Data Privacy**: Ensures content is only visible to the intended recipient
- **Self-Service**: Users can return to view past results and submit new requests

## Technical Components

1. **Backend Modifications**
   - Update to emailProcessor.js
   - New database relationships
   - Supabase edge function

2. **Authentication System**
   - Supabase Auth configuration
   - Password management
   - Session handling

3. **User Dashboard**
   - TailAdmin-based responsive interface
   - Job history and results viewing
   - Profile management
   - New request submission

## Implementation Documents

The implementation plan is divided into these documents:

1. **Overview**: This document
2. **Backend Changes**: Necessary modifications to existing backend code
3. **Authentication Setup**: Supabase Auth configuration
4. **User Interface**: Dashboard implementation with TailAdmin
5. **Testing Plan**: Verification procedures

Follow these documents in sequence for a complete implementation.
