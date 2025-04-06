-- Seed initial company (MagLoft)
INSERT INTO public.companies (name, slug, api_key, description, website, active)
VALUES (
  'MagLoft',
  'magloft',
  'ml_123456789',
  'MagLoft specializes in software solutions for print and digital publishers. We provide complete solutions for pdf to html conversions, mobile app and web app solutions, custom development and integration services.',
  'https://www.magloft.com',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Get the company ID for MagLoft
DO $$
DECLARE
  magloft_id UUID;
BEGIN
  SELECT id INTO magloft_id FROM public.companies WHERE slug = 'magloft';
  
  -- Seed default prompt template for MagLoft
  INSERT INTO public.prompt_templates (company_id, name, template, tone, style, max_length, active)
  VALUES (
    magloft_id,
    'Default Welcome Email',
    'Create a personalized email for a new free trial signup with the following information:\n\nName: ${name}\nEmail: ${email}\nCompany domain: ${domain}\nCompany name: ${companyName}\n\nWebsite summary: ${websiteSummary}\n\nWebsite content: ${websiteContent}\n\nServices offered: ${services}\n\nInstructions:\n1. Write a brief, personalized email welcoming them to the free trial\n2. Reference their company name and business\n3. Mention how our product might help their specific needs based on their website\n4. Keep in mind that our company (${ourCompanyName}) ${ourCompanyDescription}\n5. Keep it under ${maxLength} words and ${tone} in tone\n6. Use a ${style} style\n7. Include a question for the new free trial at the end to try and get a reply.\n\nFormat your response as a JSON object with ''subject'' and ''body'' fields.',
    'conversational',
    'professional',
    200,
    true
  )
  ON CONFLICT DO NOTHING;
END;
$$;
