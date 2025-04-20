-- Create debug_logs table for client-side authentication debugging
CREATE TABLE IF NOT EXISTS debug_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT,
  message TEXT,
  url TEXT,
  server_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  timestamp TEXT,
  ip_address TEXT,
  user_agent TEXT,
  hash_params JSONB,
  extra_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE debug_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to insert
CREATE POLICY "Service role can insert debug logs"
  ON debug_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create policy to allow authenticated users to view their own logs
CREATE POLICY "Users can view their own logs"
  ON debug_logs
  FOR SELECT
  TO authenticated
  USING (ip_address = (SELECT ip_address FROM debug_logs WHERE id = debug_logs.id));

-- Create stored procedure to create the table if it doesn't exist
CREATE OR REPLACE FUNCTION create_debug_logs_table()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'debug_logs'
  ) THEN
    -- Create the table
    CREATE TABLE public.debug_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      type TEXT,
      message TEXT,
      url TEXT,
      server_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      timestamp TEXT,
      ip_address TEXT,
      user_agent TEXT,
      hash_params JSONB,
      extra_data JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Add RLS policies
    ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;
    
    -- Create policy to allow service role to insert
    CREATE POLICY "Service role can insert debug logs"
      ON public.debug_logs
      FOR INSERT
      TO service_role
      WITH CHECK (true);
    
    -- Create policy to allow authenticated users to view their own logs
    CREATE POLICY "Users can view their own logs"
      ON public.debug_logs
      FOR SELECT
      TO authenticated
      USING (ip_address = (SELECT ip_address FROM public.debug_logs WHERE id = public.debug_logs.id));
  END IF;
END;
$$;
