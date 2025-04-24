/**
 * Client-side Logging API Endpoint
 * Stores client-side logs in Supabase for debugging authentication issues
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase credentials missing');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

module.exports = async (req, res) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const logData = req.body;
    
    // Add server timestamp and IP
    const logEntry = {
      ...logData,
      server_timestamp: new Date().toISOString(),
      ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      user_agent: req.headers['user-agent']
    };
    
    // Log to console for immediate visibility in Vercel logs
    console.log('[CLIENT LOG]', JSON.stringify(logEntry, null, 2));
    
    // Get Supabase client
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase client initialization failed' });
    }
    
    // Store log in Supabase
    const { data, error } = await supabase
      .from('debug_logs')
      .insert([logEntry]);
    
    if (error) {
      console.error('Error storing log in Supabase:', error);
      
      // If the table doesn't exist, try to create it
      if (error.code === '42P01') { // PostgreSQL code for undefined_table
        console.log('Attempting to create debug_logs table...');
        
        try {
          // Create the debug_logs table
          const { error: createError } = await supabase.rpc('create_debug_logs_table');
          
          if (createError) {
            console.error('Failed to create debug_logs table:', createError);
            return res.status(500).json({ error: 'Failed to create logs table' });
          }
          
          // Try inserting again
          const { error: retryError } = await supabase
            .from('debug_logs')
            .insert([logEntry]);
          
          if (retryError) {
            console.error('Error on retry:', retryError);
            return res.status(500).json({ error: 'Failed to save log after table creation' });
          }
        } catch (createTableError) {
          console.error('Error in table creation process:', createTableError);
          return res.status(500).json({ error: 'Table creation process failed' });
        }
      } else {
        return res.status(500).json({ error: 'Failed to store log in database' });
      }
    }
    
    // Log was successfully saved
    return res.status(200).json({ 
      success: true, 
      message: 'Log saved successfully to Supabase',
      timestamp: logEntry.server_timestamp
    });
  } catch (error) {
    console.error('Error in client logging process:', error);
    return res.status(500).json({ error: 'Failed to process log' });
  }
};
