import { createClient } from "@supabase/supabase-js";

const secretKey = process.env.SUPABASE_SECRET_KEY!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Warn if secret key is the same as publishable key
if (secretKey && publishableKey && secretKey === publishableKey) {
  console.warn(
    "\n⚠️  WARNING: SUPABASE_SECRET_KEY is identical to NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!\n" +
    "   The secret key is a DIFFERENT key found in Supabase Dashboard > Settings > API.\n" +
    "   Without the correct key, all database writes will fail due to RLS policies.\n"
  );
}

// Secret key client — bypasses RLS, use only in API routes
export const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  secretKey
);
