import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";

// Uygulama genelinde oturum durumunu yöneten hook. supabase.auth.onAuthStateChange
// ile giriş/çıkış/token-yenileme olaylarını dinler; başlangıçta mevcut oturumu
// bir kez getirir. Döner: { session, user, authReady } + giriş/kayıt/çıkış aksiyonları.
export default function useAuth() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password });
  const signUp = (email, password) => supabase.auth.signUp({ email, password });
  const signOut = () => supabase.auth.signOut();

  // Google OAuth ile giriş — Supabase, kullanıcıyı Google onay ekranına
  // yönlendirir; dönüşte onAuthStateChange oturumu otomatik yakalar.
  // redirectTo, uygulamanın çalıştığı origin olsun ki callback doğru yere dönsün.
  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });

  return {
    session,
    user: session?.user || null,
    authReady,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
  };
}
