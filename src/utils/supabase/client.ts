import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log("DEBUG Supabase URL:", supabaseUrl);
console.log("DEBUG Anon Key exists:", !!supabaseAnonKey);

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
