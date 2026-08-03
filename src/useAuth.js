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

  // Sessizce, GİRİŞ EKRANI GÖSTERMEDEN bir anonim oturum başlatır — Nexus'ta
  // paylaşılan bir şablon linkine (bkz. SharedTemplateView.jsx) tıklayan,
  // oturumu olmayan bir ziyaretçi için. Supabase'in `is_anonymous: true`
  // GERÇEK bir auth.users satırı oluşturur — plans/routines/tasks'taki
  // "auth.uid() = user_id" RLS politikaları bu kullanıcı için de AYNEN
  // çalışır, ayrı bir kod yolu/şema gerekmez.
  //
  // ÖN KOŞUL (bu dosyada AÇILAMAZ): Supabase Dashboard → Authentication →
  // Providers → "Allow anonymous sign-ins" açık olmalı; kapalıysa bu çağrı
  // hata döner.
  const signInAnonymously = () => supabase.auth.signInAnonymously();

  // Anonim bir oturumu KALICI bir hesaba YÜKSELTİR — `signUp` ile YENİ bir
  // kullanıcı oluşturmaz, AYNI auth.uid()'yi email/şifreyle günceller. Bu
  // sayede anonimken oluşturulan plans/routines/tasks satırları (hepsi bu
  // uid'e bağlı) hiçbir taşıma/kopyalama işlemi olmadan otomatik olarak
  // kalıcı hesaba "ait" olur — "veri kaybı olmadan hesap birleştirme" tam
  // olarak bunun sayesinde sıfır ek kod ile sağlanır.
  const upgradeAnonymousAccount = (email, password) => supabase.auth.updateUser({ email, password });

  // Google ile "hesap yükseltme" — DİKKAT: normal signInWithOAuth burada
  // KULLANILAMAZ, çünkü o YENİ bir oturum/uid oluşturur ve mevcut anonim
  // uid'e bağlı plans/routines/tasks'ı SESSİZCE YETİM bırakırdı.
  // `linkIdentity`, AYNI anonim uid'e bir Google kimliği bağlar — upgradeAnonymousAccount
  // (email/şifre) ile TAM AYNI "veri kaybı yok" garantisini Google için sağlar.
  const linkGoogleIdentity = () =>
    supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });

  const isAnonymous = session?.user?.is_anonymous === true;

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
    isAnonymous,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    signInAnonymously,
    upgradeAnonymousAccount,
    linkGoogleIdentity,
  };
}
