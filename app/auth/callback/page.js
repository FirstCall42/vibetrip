'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { setSessionCookieAction } from '../../actions';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Verifying authentication credentials...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const processAuth = async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        // Local mode fallback
        setStatus('Syncing local mock profile...');
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 1000);
        return;
      }

      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Supabase client automatically handles exchanging the code/token in the URL.
        // We set up a state listener to catch the active session.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
            setStatus('Securing session cookies...');
            
            // Set the HTTP-only cookie on the server-side
            const res = await setSessionCookieAction(session.access_token);
            if (res.success) {
              setStatus('Authentication complete! Redirecting...');
              // Unsubscribe and redirect
              subscription.unsubscribe();
              router.push('/');
              router.refresh();
            } else {
              setError('Failed to establish server session. Please try logging in again.');
            }
          }
        });

        // Fallback: If no event fires after 8 seconds, check current session directly
        const timer = setTimeout(async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await setSessionCookieAction(session.access_token);
            subscription.unsubscribe();
            router.push('/');
            router.refresh();
          } else {
            setError('Authentication session timed out or was rejected by Google.');
            subscription.unsubscribe();
          }
        }, 8000);

        return () => {
          clearTimeout(timer);
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error("OAuth client callback error:", err);
        setError(err.message || 'An unexpected authentication error occurred.');
      }
    };

    processAuth();
  }, [router]);

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '24px',
      position: 'relative'
    }}>
      <div className="glass" style={{ padding: '40px', maxWidth: '440px', width: '100%', textAlign: 'center' }}>
        {!error ? (
          <>
            {/* Spinning Indicator */}
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--border-color)',
              borderTop: '3px solid var(--primary)',
              borderRadius: '50%',
              margin: '0 auto 24px auto',
              animation: 'spin 1s linear infinite'
            }} />
            <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Verifying Account</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{status}</p>
          </>
        ) : (
          <>
            <span style={{ fontSize: '3rem', marginBottom: '16px', display: 'block' }}>⚠️</span>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '12px', color: 'var(--danger)' }}>Login Failed</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '24px' }}>{error}</p>
            <button onClick={() => router.push('/login')} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Back to Login Screen
            </button>
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
