import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qnvjokhggfbnryccqcmt.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudmpva2hnZ2ZibnJ5Y2NxY210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMDIwODIsImV4cCI6MjA2MDU3ODA4Mn0.9nFCHT30dC95oa3abteWn81mXNacEnN8pO-CwBuFa4A';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {  
  // Just query a single log and print all its keys
  const { data: logs } = await supabase.from('meal_logs').select('*').limit(1);
  console.log("meal_logs columns:", Object.keys(logs?.[0] || {}));
}
run();
