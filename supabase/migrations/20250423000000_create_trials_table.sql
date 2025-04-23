-- Create trials table for lead collection
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

-- Create trigger to update trials when user registers
CREATE OR REPLACE FUNCTION public.update_trial_on_registration()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the trial record when a user registers with the same email
  UPDATE public.trials
  SET has_registered = true
  WHERE email = NEW.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table
CREATE TRIGGER update_trial_after_user_creation
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.update_trial_on_registration();

-- Add RLS policies for trials table
ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;

-- Allow service role to access all trials
CREATE POLICY "Service role can access all trials"
ON public.trials
FOR ALL
TO service_role
USING (true);

-- Allow authenticated users to view their own trial
CREATE POLICY "Users can view their own trial"
ON public.trials
FOR SELECT
TO authenticated
USING (email = auth.jwt() ->> 'email');
