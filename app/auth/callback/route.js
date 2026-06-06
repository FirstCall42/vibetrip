import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (code && supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      
      // Exchange the code for a secure session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (!error && data.session) {
        const cookieStore = await cookies();
        cookieStore.set('supabase-access-token', data.session.access_token, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax', // Use 'lax' to ensure the cookie is readable on external OAuth redirects
          maxAge: 60 * 60 * 24 * 7 // 1 week
        });
        
        return NextResponse.redirect(`${origin}/`);
      }
      
      // Fallback: If code exchange failed (e.g. code already consumed by double request),
      // check if we already have the token cookie set from the successful parallel request.
      const cookieStore = await cookies();
      if (cookieStore.get('supabase-access-token')?.value) {
        return NextResponse.redirect(`${origin}/`);
      }
      
      if (error) {
        console.error("OAuth code exchange error:", error.message);
      }
    } catch (err) {
      console.error("OAuth callback exception:", err);
    }
  }

  // Redirect to login page on failure
  return NextResponse.redirect(`${origin}/login?error=oauth-failed`);
}
