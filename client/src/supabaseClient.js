import { createClient } from '@supabase/supabase-js';

// Same Supabase project — using anon key for client-side OAuth
export const supabase = createClient(
  'https://ueycuefilgpkjuojpwnv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVleWN1ZWZpbGdwa2p1b2pwd252Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQwMzIxMTgsImV4cCI6MjA0OTYwODExOH0.gRNfPMdMB0EHf8bwGKiWFqOxkW1QxlHIDc0IilX6u6k'
);
