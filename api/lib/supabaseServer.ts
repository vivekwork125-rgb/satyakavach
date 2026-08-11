import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// Backend uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (no VITE_ prefix).
// VITE_ prefixed variables are Vite build-time replacements - they are UNDEFINED in Node.js.
// The service_role key bypasses RLS, which is safe and necessary for server-side DB operations.
const rawSupabaseUrl = process.env.SUPABASE_URL || '';
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = () => {
  return (
    !!supabaseUrl &&
    !supabaseUrl.includes('placeholder') &&
    !!supabaseServiceRoleKey &&
    !supabaseServiceRoleKey.includes('placeholder')
  );
};

if (!isSupabaseConfigured()) {
  console.log(
    'ℹ️  [Supabase DB] Running in local bypass/offline mode (Placeholder credentials detected in .env).\n' +
    '    To connect a live Supabase database, update SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.'
  );
} else {
  console.log('✅ [Supabase DB] Server credentials loaded successfully.');
}

export const supabaseServer = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceRoleKey || 'placeholder',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      transport: ws,
    },
  }
);



