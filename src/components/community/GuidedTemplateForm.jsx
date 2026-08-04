import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Check, ClipboardList, Zap, Timer } from "lucide-react";
import { categoryOf } from "../../constants";
import { fetchUserPlans, fetchPlanDetail } from "../../services/planService";
import { PRESET_COVERS, coverForCategory } from "../../data/presetCovers";
import CoverPattern from "./CoverPattern";
import { TAG_GROUPS, normalizeTag } from "../../data/communityTags";
import { formatTemplateStory } from "../../utils/formatTemplateStory";
import { createTemplate } from "../../services/communityService";
import logger from "../../utils/logger";

const STEPS = ["Planını Seç", "Kapak & Etiketler", "Hayatınıza Katkısı", "Süreç", "Artı & Eksi", "Tavsiyeler", "Önizleme"];

function StepShell({ title, children }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-[16px] font-bold text-[var(--text-primary)]">{title}</h3>
      {children}
    </div>
  );
}

function TextField({ label, placeholder, value, onChange, rows = 8 }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3.5 py-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-cyan-500/50 transition-colors resize-none"
      />
    </label>
  );
}

function focusHoursLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} dk`;
  return m > 0 ? `${h} sa ${m} dk` : `${h} sa`;
}

// "Nexus'ta Paylaş" — REHBERLİ akış artık sıfırdan görev/rutin YAZDIRMAZ:
// kullanıcı kendi aktif/tamamlanmış planlarından birini SEÇER, o planın
// TÜM rutinleri/görevleri otomatik olarak şablon yapısına aktarılır (bkz.
// aşağıdaki Adım 0 + communityService.createTemplate'e geçen previewRoutines/
// templateTasks). Kullanıcı yalnızca hikaye sorularını yanıtlar + etiket/
// kapak seçer. Neon-glass estetik: BackgroundScene ile uyumlu mor/cyan/
// zümrüt ambient ışık (bkz. CommunityHub.jsx NexusBackground).
export default function GuidedTemplateForm({ open, authorProfileId, userId, onClose, onCreated }) {
  const [step, setStep] = useState(0);
  const [myPlans, setMyPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [selectedPlanDetail, setSelectedPlanDetail] = useState(null); // { plan, routines, tasks }
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [title, setTitle] = useState("");
  const [coverId, setCoverId] = useState(null);
  const [tags, setTags] = useState([]);
  const [customTag, setCustomTag] = useState("");
  const [impact, setImpact] = useState("");
  const [process, setProcess] = useState("");
  const [prosCons, setProsCons] = useState("");
  const [tips, setTips] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoadingPlans(true);
    fetchUserPlans(userId)
      .then((rows) => !cancelled && setMyPlans(rows))
      .catch((err) => logger.error("COMMUNITY_FORM", "Planlar getirilemedi", { error: err?.message }))
      .finally(() => !cancelled && setLoadingPlans(false));
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  if (!open) return null;

  const category = selectedPlanDetail?.plan?.mode || "general";
  const totalDays = selectedPlanDetail?.plan?.total_days || myPlans.find((p) => p.id === selectedPlanId)?.total_days || 7;
  const effectiveCover = coverId ? PRESET_COVERS.find((c) => c.id === coverId) : coverForCategory(category);
  const totalRoutines = selectedPlanDetail?.routines?.length || 0;
  const totalFocusMin = (selectedPlanDetail?.tasks || []).reduce((n, t) => n + (t.duration_min || 0), 0);

  const handlePickPlan = async (planId) => {
    setSelectedPlanId(planId);
    setLoadingDetail(true);
    setError("");
    try {
      const detail = await fetchPlanDetail(planId);
      setSelectedPlanDetail(detail);
      setTitle(detail.plan.title || "");
    } catch (err) {
      logger.error("COMMUNITY_FORM", "Plan detayı getirilemedi", { planId, error: err?.message });
      setError("Plan detayı getirilemedi, tekrar dener misin?");
    } finally {
      setLoadingDetail(false);
    }
  };

  const toggleTag = (t) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const addCustomTag = () => {
    const norm = normalizeTag(customTag);
    if (norm && !tags.includes(norm)) setTags((prev) => [...prev, norm]);
    setCustomTag("");
  };

  const canProceed = () => {
    if (step === 0) return !!selectedPlanDetail && title.trim().length >= 4;
    return true;
  };

  const handleSubmit = async () => {
    if (submitting || !selectedPlanDetail) return;
    setSubmitting(true);
    setError("");
    try {
      const story = { impact, process, prosCons, tips, markdown: formatTemplateStory({ impact, process, prosCons, tips }) };
      const previewRoutines = selectedPlanDetail.routines.map((r) => ({ content: r.content, frequency: r.frequency || "weekly" }));
      const templateTasks = selectedPlanDetail.tasks.map((t) => ({
        day_number: t.day_number,
        week_number: t.week_number,
        title: t.title,
        detail: t.detail,
        duration_min: t.duration_min,
        priority: t.priority,
      }));
      const created = await createTemplate({
        authorProfileId,
        title,
        category,
        coverUrl: effectiveCover.id,
        goal: selectedPlanDetail.plan.summary || selectedPlanDetail.plan.title,
        totalDays,
        tags,
        story,
        previewRoutines,
        templateTasks,
      });
      onCreated?.(created);
    } catch (err) {
      logger.error("COMMUNITY_FORM", "Şablon paylaşılamadı", { error: err?.message });
      setError(err?.message || "Şablon paylaşılırken bir sorun oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg max-h-[85vh] rounded-2xl border border-[var(--border-default)] bg-[rgba(var(--glass-rgb),0.95)] shadow-2xl flex flex-col">
        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-[var(--border-default)] flex items-center justify-between">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
              Adım {step + 1}/{STEPS.length}
            </p>
            <h2 className="text-[15px] font-bold text-[var(--text-primary)]">{STEPS[step]}</h2>
          </div>
          <button onClick={onClose} aria-label="Kapat" className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="shrink-0 h-[3px] bg-white/5">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: "linear-gradient(90deg, #22D3EE, #B26BFF)" }}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-6 py-5">
          {step === 0 && (
            <StepShell title="Aktif veya Tamamlanan Planlarından Birini Seç">
              {loadingPlans ? (
                <p className="text-[12.5px] text-[var(--text-muted)]">Planların yükleniyor...</p>
              ) : myPlans.length === 0 ? (
                <p className="text-[12.5px] text-[var(--text-muted)]">Henüz kayıtlı bir planın yok — önce bir plan oluşturman gerekiyor.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {myPlans.map((p) => {
                    const cat = categoryOf(p.mode);
                    const active = selectedPlanId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handlePickPlan(p.id)}
                        className={`text-left rounded-xl px-4 py-3 border transition-colors duration-200 flex items-center gap-3 ${
                          active ? "border-cyan-500/50 bg-cyan-500/10" : "border-[var(--border-default)] bg-[rgba(var(--overlay-rgb),0.03)] hover:border-[var(--border-strong)]"
                        }`}
                      >
                        <span className="text-[18px] shrink-0">{cat.emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold text-[var(--text-primary)] truncate">{p.title || "İsimsiz Plan"}</span>
                          <span className="block text-[10.5px] text-[var(--text-muted)]">
                            {cat.label} · {p.total_days || "?"} gün
                          </span>
                        </span>
                        {active && loadingDetail && <span className="text-[10.5px] text-cyan-400 shrink-0">Yükleniyor...</span>}
                        {active && !loadingDetail && <Check className="w-4 h-4 shrink-0 text-cyan-400" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedPlanDetail && (
                <div className="flex flex-col gap-3 mt-2">
                  <TextField label="Şablon Başlığı" placeholder="Şablona vereceğin başlık" value={title} onChange={setTitle} rows={2} />
                  <div className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[rgba(var(--overlay-rgb),0.03)] px-4 py-3">
                    <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--text-secondary)]">
                      <ClipboardList className="w-3.5 h-3.5 text-cyan-400" /> {totalRoutines} Rutin
                    </span>
                    <span className="w-px h-4 bg-white/10" />
                    <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--text-secondary)]">
                      <Timer className="w-3.5 h-3.5 text-cyan-400" /> {focusHoursLabel(totalFocusMin)} Odak
                    </span>
                    <span className="w-px h-4 bg-white/10" />
                    <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--text-secondary)]">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" /> {selectedPlanDetail.tasks.length} Görev
                    </span>
                  </div>
                </div>
              )}
              {error && <p className="text-[12px] font-medium text-red-400 mt-2">{error}</p>}
            </StepShell>
          )}

          {step === 1 && (
            <StepShell title="Kapak & Etiketler">
              <div className="grid grid-cols-5 gap-2">
                {PRESET_COVERS.map((c) => {
                  const active = effectiveCover.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setCoverId(c.id)}
                      aria-label={c.label}
                      className="aspect-square rounded-lg overflow-hidden"
                      style={{ outline: active ? "2px solid #22D3EE" : "none", outlineOffset: 2 }}
                    >
                      {/* Aynı CoverPattern (gerçek fotoğraf + onError'da bu id'nin
                          kendi mesh-gradient'ine düşüş) — kart/detay/önizlemede
                          kullanılanla AYNI bileşen. Önceki sürüm burada doğrudan
                          `c.style` (yalnızca CSS gradient) çiziyordu; bu yüzden
                          seçici hâlâ eski "bulanık mor/yeşil kutular" görünümündeydi
                          — fotoğraf sistemine hiç bağlanmamıştı. */}
                      <CoverPattern coverId={c.id} className="w-full h-full" />
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2.5 mt-2">
                {TAG_GROUPS.map((g) => (
                  <div key={g.key}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--text-faint)] mb-1.5">{g.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {g.tags.map((t) => {
                        const active = tags.includes(t);
                        return (
                          <button
                            key={t}
                            onClick={() => toggleTag(t)}
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors duration-200 ${
                              active ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300" : "border-[var(--border-default)] text-[var(--text-secondary)]"
                            }`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-1">
                  <input
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomTag())}
                    placeholder="Özel etiket ekle..."
                    className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-cyan-500/50"
                  />
                  <button onClick={addCustomTag} className="text-[11px] font-bold px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 text-black">
                    Ekle
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tags.map((t) => (
                      <span key={t} onClick={() => toggleTag(t)} className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-[var(--text-primary)] cursor-pointer">
                        {t} ✕
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </StepShell>
          )}

          {step === 2 && (
            <StepShell title="Hayatınıza Katkısı">
              <TextField label="Bu şablon hayatınızı nasıl değiştirdi?" placeholder="Örn: Sabah 06:00'da kalkma disiplini sağladı, günlük odak süremi 2 saat artırdı..." value={impact} onChange={setImpact} />
            </StepShell>
          )}

          {step === 3 && (
            <StepShell title="Süreç Nasıl İlerledi?">
              <TextField label="Uygularken süreç nasıl geçti?" placeholder="Örn: İlk 3 gün zorlandım fakat 1. haftadan sonra ritim oturdu..." value={process} onChange={setProcess} />
            </StepShell>
          )}

          {step === 4 && (
            <StepShell title="Artıları & Eksileri">
              <TextField label="Bu şablonun güçlü ve zayıf yanları neler?" placeholder="Örn: +Çok hızlı sonuç veriyor, -Sosyal hayatta biraz disiplin gerektiriyor..." value={prosCons} onChange={setProsCons} />
            </StepShell>
          )}

          {step === 5 && (
            <StepShell title="Tavsiyeler & Püf Noktaları">
              <TextField label="Uygulayacaklara ne tavsiye edersiniz?" placeholder="Örn: Su takibini aksatmayın, akşam rutinlerini atlamayın..." value={tips} onChange={setTips} />
            </StepShell>
          )}

          {step === 6 && (
            <StepShell title="Önizleme">
              <div className="rounded-xl overflow-hidden border border-[var(--border-default)]">
                <CoverPattern coverId={effectiveCover.id} className="w-full h-24" />
                <div className="p-4 bg-[rgba(var(--overlay-rgb),0.04)]">
                  <h4 className="text-[14px] font-bold text-[var(--text-primary)]">{title || "(başlıksız)"}</h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    {categoryOf(category).emoji} {categoryOf(category).label} · {totalDays} gün · ⚡ {totalRoutines} Rutin · ⏱️ {focusHoursLabel(totalFocusMin)} Odak
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tags.map((t) => (
                      <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[var(--border-default)] text-[var(--text-muted)]">
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mt-3 whitespace-pre-line line-clamp-6">{formatTemplateStory({ impact, process, prosCons, tips })}</p>
                </div>
              </div>
              {error && <p className="text-[12px] font-medium text-red-400 mt-3">{error}</p>}
            </StepShell>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-[var(--border-default)] flex items-center justify-between gap-3">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="flex items-center gap-1 text-[12px] font-semibold text-[var(--text-muted)] disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" /> Geri
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => canProceed() && setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              disabled={!canProceed()}
              className="flex items-center gap-1 rounded-full px-5 py-2.5 text-[12.5px] font-bold text-black disabled:opacity-30 transition-all active:scale-95"
              style={{ background: "linear-gradient(90deg, #22D3EE, #B26BFF)" }}
            >
              İleri <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[12.5px] font-bold text-black disabled:opacity-50 transition-all active:scale-95"
              style={{ background: "linear-gradient(90deg, #22D3EE, #B26BFF)" }}
            >
              <Check className="w-4 h-4" /> {submitting ? "Paylaşılıyor..." : "Nexus'ta Paylaş"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
