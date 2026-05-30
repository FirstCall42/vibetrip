import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/db';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export const dynamic = 'force-dynamic';

export async function GET() {
  const health = {
    supabaseConfigured: isSupabaseConfigured,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: Boolean(supabaseUrl),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(supabaseAnonKey)
    },
    timestamp: new Date().toISOString()
  };

  if (!isSupabaseConfigured) {
    return NextResponse.json({
      ...health,
      status: 'local-mode',
      message: 'Supabase is not configured. The app is running in local fallback mode.'
    });
  }

  try {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await client.from('itineraries').select('id').limit(1);

    if (error) {
      return NextResponse.json({
        ...health,
        status: 'failed',
        message: 'Supabase request failed.',
        error: {
          code: error.code,
          details: error.details,
          hint: error.hint,
          message: error.message
        }
      }, { status: 502 });
    }

    return NextResponse.json({
      ...health,
      status: 'ok',
      message: 'Supabase connectivity confirmed.',
      sampleCount: Array.isArray(data) ? data.length : null
    });
  } catch (error) {
    return NextResponse.json({
      ...health,
      status: 'failed',
      message: 'Supabase health check threw an exception.',
      error: {
        message: error?.message ?? 'Unknown error'
      }
    }, { status: 502 });
  }
}
