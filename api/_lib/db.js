import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ueycuefilgpkjuojpwnv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVleWN1ZWZpbGdwa2p1b2pwd252Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYyOTk1MywiZXhwIjoyMDk3MjA1OTUzfQ.zNy1rlcJNah6z4keF0zYIxpZ5LoT2IE58pQLfJTtpeg';

export const supabase = createClient(supabaseUrl, supabaseKey);

export function makeUsernameFromEmail(email) {
  const base = (email.split('@')[0] || 'player')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 20) || 'player';
  return base + Math.floor(Math.random() * 10000); 
}
