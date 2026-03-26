import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  checkSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to ensure profile exists
const ensureProfileExists = async (user: User) => {
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!existingProfile) {
    await supabase.from('profiles').insert({
      id: user.id,
      email: user.email || '',
      first_name: user.user_metadata?.first_name || '',
      last_name: user.user_metadata?.last_name || '',
      plan: 'free'
    });
  }
};

const SUBSCRIPTION_CHECK_INTERVAL = 60_000; // 1 minute

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkSubscription = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) {
        console.error('[Auth] Subscription check failed:', error.message);
        return;
      }
      // Subscription status loaded
    } catch (err) {
      console.error('[Auth] Subscription check error:', err);
    }
  }, []);

  // Start periodic subscription check
  const startSubscriptionPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(checkSubscription, SUBSCRIPTION_CHECK_INTERVAL);
  }, [checkSubscription]);

  const stopSubscriptionPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          // Ensure profile exists (deferred to avoid deadlock)
          setTimeout(() => ensureProfileExists(session.user), 0);
          // Check subscription on sign-in
          setTimeout(() => {
            checkSubscription();
            startSubscriptionPolling();
          }, 500);
        }

        if (event === 'SIGNED_OUT') {
          stopSubscriptionPolling();
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        setTimeout(() => ensureProfileExists(session.user), 0);
        // Check subscription on initial load
        setTimeout(() => {
          checkSubscription();
          startSubscriptionPolling();
        }, 1000);
      }
    });

    return () => {
      subscription.unsubscribe();
      stopSubscriptionPolling();
    };
  }, [checkSubscription, startSubscriptionPolling, stopSubscriptionPolling]);

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
        }
      }
    });

    // Send welcome email after successful signup
    if (!error && data?.user) {
      supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'welcome-email',
          recipientEmail: email,
          idempotencyKey: `welcome-${data.user.id}`,
          templateData: { name: firstName },
        },
      }).catch(() => {}); // best-effort, don't block signup
    }
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signInWithGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    return { error: result.error ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signOut, checkSubscription }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
