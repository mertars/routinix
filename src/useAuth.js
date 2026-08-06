import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";
import logger from "./utils/logger";

// Uygulama genelinde oturum durumunu yöneten hook. supabase.auth.onAuthStateChange
// ile giriş/çıkış/token-yenileme olaylarını dinler; başlangıçta mevcut oturumu
// bir kez getirir. Döner: { session, user, authReady } + giriş/kayıt/çıkış aksiyonları.
export default function useAuth() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    // .catch() KRİTİK: internet kesikken/Supabase'e ulaşılamazken bu promise
    // REJECT olabilir — yakalanmazsa `authReady` asla true olmaz ve uygulama
    // sonsuza kadar "oturum kontrol ediliyor" durumunda takılı kalırdı.
    // Ağ hatasında en güvenli geri dönüş: oturumsuz kabul edip devam etmek
    // (kullanıcı misafir/anonim akışa düşer, sayfa asla donmaz).
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setAuthReady(true);
      })
      .catch((err) => {
        if (!mounted) return;
        logger.error("AUTH", "Oturum getirilemedi (ağ hatası olabilir)", { error: err?.message });
        setSession(null);
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

  // SERTLEŞTİRİLMİŞ çıkış — canlıda "çıkış yapamıyorum, misafir modunda
  // sıkışıyorum" bildirimi üzerine: supabase.auth.signOut() ağ hatasıyla
  // reddederse (ya da React state'i herhangi bir sebeple beklenen şekilde
  // güncellenmezse) kullanıcı GÖRÜNMEZ bir şekilde eski oturumda kalabilirdi
  // — hiçbir hata mesajı YOKTU, "hiçbir şey olmuyor" hissi tam olarak buydu.
  // Artık: (1) supabase.auth.signOut() denenir, (2) SONUCU NE OLURSA OLSUN
  // supabase-js'in kendi sakladığı oturum anahtarı (varsayılan biçim
  // "sb-<proje-ref>-auth-token") localStorage'dan DOĞRUDAN silinir — bu,
  // ağ isteği tamamen başarısız olsa bile tarayıcıyı GERÇEKTEN oturumsuz
  // bırakan bir yedek katmandır, (3) sayfa "/"e SERT yönlendirilir
  // (window.location.href) — herhangi bir bayat React state'i (bu hook'un
  // KENDİSİ dahil) tam bir sayfa yüklemesiyle tamamen SIFIRLANIR, "eski
  // oturum bir şekilde hafızada kalmaya devam ediyor" ihtimalini YAPISAL
  // olarak ortadan kaldırır.
  //
  // NOT: Bu fonksiyon hiçbir koşulda signInAnonymously() ÇAĞIRMAZ — anonim/
  // misafir oturum YALNIZCA SharedTemplateView.jsx'in kendi akışında,
  // paylaşılan bir şablon linkine (/t/[id]) gelindiğinde başlatılır (bkz. o
  // dosyadaki AYNI notun tekrarı). Çıkış akışı bu ikisini birbirine ASLA
  // karıştırmaz.
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) logger.error("AUTH", "Çıkış yapılamadı (yedek temizlik yine de uygulanıyor)", { error: error.message });
    } catch (err) {
      logger.error("AUTH", "Çıkış isteği tamamen başarısız oldu (ağ hatası olabilir, yedek temizlik yine de uygulanıyor)", { error: err?.message });
    }
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))
        .forEach((k) => localStorage.removeItem(k));
    } catch (err) {
      logger.warn("AUTH", "localStorage yedek temizliği yapılamadı (gizli tarama modu olabilir)", { error: err?.message });
    }
    window.location.href = "/";
  };

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

  const isAnonymous = session?.user?.is_anonymous === true;

  // Google OAuth ile giriş — Supabase, kullanıcıyı Google onay ekranına
  // yönlendirir; dönüşte onAuthStateChange oturumu otomatik yakalar.
  // redirectTo, uygulamanın çalıştığı origin olsun ki callback doğru yere dönsün.
  //
  // ANONİMKEN DE (misafir "Giriş Yap" ya da "Hesabını Kaydet" fark etmeksizin)
  // AYNI fonksiyon kullanılır — BİLEREK `supabase.auth.linkIdentity()`
  // (anonim uid'e Google kimliği "bağlama", veri kaybı olmadan yükseltme)
  // KULLANILMIYOR: bu API, Supabase Dashboard → Authentication → Settings
  // → "Allow manual linking" AÇIK olmasını gerektiriyor ve bu projede KAPALI
  // — canlıda tam olarak "Manual linking is disabled" hatasıyla doğrulandı.
  // Kapalı bir sunucu ayarına bağımlı, sessizce başarısız olabilecek bir
  // "akıllı" yol yerine, HER ZAMAN çalışan sade OAuth girişi tercih edildi —
  // bedeli: anonimken Google ile "yükseltme" yapan kullanıcı YENİ bir hesaba
  // geçer, o anki misafir oturumunun planları otomatik taşınmaz (email/şifre
  // yükseltme yolu — upgradeAnonymousAccount — bu kısıtlamaya TABİ DEĞİL,
  // farklı bir Supabase API'si kullanır, veri kaybı olmadan çalışmaya devam eder).
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
  };
}
