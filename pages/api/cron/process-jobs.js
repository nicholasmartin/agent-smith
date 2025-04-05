/**
 * Vercel API route handler for the cron job
 * This file is required for Vercel to recognize the cron endpoint
 */
const processJobs = require('../../../api/cron/process-jobs');

export default async function handler(req, res) {
  // Verify the request is from Vercel Cron (in production)
  // In development, allow all requests
  if (process.env.VERCEL_ENV === 'production') {
    const authHeader = req.headers.authorization || '';
    
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  
  // Process jobs
  return processJobs(req, res);
}
