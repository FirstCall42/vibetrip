import { createClient } from '@supabase/supabase-js';
import { loginAction } from '../actions';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in both fields.');
      return;
    }

    setLoading(true);
    setError('');

    const res = await loginAction(email, password);
    setLoading(false);

    if (res.success) {
      router.push('/');
      router.refresh();
    } else {
      setError(res.error || 'Invalid credentials');
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      try {
        const client = createClient(supabaseUrl, supabaseAnonKey);
        const { error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`
          }
        });
        if (error) setError(error.message);
      } catch (err) {
        setError(err.message);
      }
    } else {
      // Local mock login for testing ease
      setLoading(true);
      const res = await loginAction('google-mock@family.com', 'google-mock-pass');
      setLoading(false);
      if (res.success) {
        router.push('/');
        router.refresh();
      }
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '24px',
      position: 'relative'
    }}>
      {/* Background decoration blur blobs */}
      <div style={{
        position: 'absolute',
        top: '25%',
        left: '25%',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'rgba(99, 102, 241, 0.12)',
        filter: 'blur(80px)',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '25%',
        right: '25%',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'rgba(6, 182, 212, 0.1)',
        filter: 'blur(80px)',
        zIndex: 0
      }} />

      <div className="glass animate-fade-in" style={{ 
        padding: '40px', 
        width: '100%', 
        maxWidth: '420px', 
        zIndex: 1,
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ 
            fontSize: '2rem', 
            fontWeight: 800, 
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent-cyan) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontFamily: 'var(--font-family-title)',
            display: 'inline-block',
            marginBottom: '8px'
          }}>
            VibeTrip
          </Link>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>Sign in to manage itineraries</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Coordinate family trips, flights, and events.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="name@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px', textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <Link href="/" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'underline' }}>
            ← Back to home
          </Link>
        </div>

        {/* Tip for testing convenience */}
        <div style={{ 
          marginTop: '32px', 
          padding: '12px', 
          borderRadius: 'var(--radius-sm)', 
          background: 'rgba(255, 255, 255, 0.02)', 
          border: '1px dashed var(--border-color)',
          fontSize: '0.8rem',
          color: 'var(--text-muted)'
        }}>
          💡 <strong>Local Mode Tip:</strong> Any email and password will be accepted for testing purposes.
        </div>
      </div>
    </div>
  );
}
