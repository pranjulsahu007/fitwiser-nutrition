import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fitwiser.supabase.primedepthlabs.com';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudmpva2hnZ2ZibnJ5Y2NxY210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMDIwODIsImV4cCI6MjA2MDU3ODA4Mn0.9nFCHT30dC95oa3abteWn81mXNacEnN8pO-CwBuFa4A';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
