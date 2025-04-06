-- Seed Agent Smith company
INSERT INTO public.companies (name, slug, api_key, description, website, active)
VALUES (
  'Agent Smith',
  'agent-smith',
  'as_987654321',
  'Agent Smith specializes in AI-powered email personalization that creates meaningful connections with subscribers. We automatically research businesses and craft personalized welcome emails that feel human-written, increasing response rates and making great first impressions.',
  'https://agent-smith.magloft.com',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Get the company ID for Agent Smith
DO $$
DECLARE
  agent_smith_id UUID;
BEGIN
  SELECT id INTO agent_smith_id FROM public.companies WHERE slug = 'agent-smith';
  
  -- Seed default prompt template for Agent Smith
  INSERT INTO public.prompt_templates (company_id, name, template, tone, style, max_length, active)
  VALUES (
    agent_smith_id,
    'Personalized Welcome Email',
    'Create a personalized email for a new free trial signup with the following information:\n\nName: ${name}\nEmail: ${email}\nCompany domain: ${domain}\nCompany name: ${companyName}\n\nWebsite summary: ${websiteSummary}\n\nWebsite content: ${websiteContent}\n\nServices offered: ${services}\n\nInstructions:\n1. Write a brief, personalized email welcoming them to the free trial\n2. Reference their company name and business specifically\n3. Mention how our AI-powered email personalization can help their specific needs based on their website\n4. Keep in mind that our company (${ourCompanyName}) ${ourCompanyDescription}\n5. Emphasize how our service can increase response rates and create meaningful first impressions\n6. Keep it under ${maxLength} words and ${tone} in tone\n7. Use a ${style} style that sounds like it was written by a human, not a robot\n8. Include a specific question related to their business at the end to encourage a reply\n\nFormat your response as a JSON object with ''subject'' and ''body'' fields.',
    'friendly',
    'professional',
    180,
    true
  )
  ON CONFLICT DO NOTHING;
END;
$$;
