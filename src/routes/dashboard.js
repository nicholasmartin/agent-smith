/**
 * Dashboard Routes for Agent Smith
 * 
 * This module contains all routes related to the dashboard and protected content.
 */

const express = require('express');
const path = require('path');
const router = express.Router();

// The protectedRouteMiddleware is now applied in server.js
// We don't need to apply it again here

// Main dashboard route
router.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'dashboard.html'));
});

// Nested dashboard routes
router.get('/settings', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'dashboard.html'));
});

router.get('/companies', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'dashboard.html'));
});

// Dynamic company-specific routes
router.get('/:companyId', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'dashboard.html'));
});

router.get('/:companyId/:section', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'dashboard.html'));
});

module.exports = router;
