import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseKey);

export function makeUsernameFromEmail(email) {
  const base = (email.split('@')[0] || 'player')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 20) || 'player';
  return base + Math.floor(Math.random() * 10000); 
}
