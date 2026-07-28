import { useState } from "react";
import { CATEGORIES } from "../constants";

// İki adımlı plan silme modalı:
//   1) "Hangi planı silmek istiyorsunuz?" — kayıtlı planları listeler.
//   2) Bir plan seçilince "Bu planı silmek istediğinize emin misiniz?" onayı.
// Onaylanınca onDelete(planId) tetiklenir.
export default function DeletePlanModal({ open, plans, onDelete, onClose }) {
  const [pending, setPending] = useState(null); // seçilen plan (onay bekleyen)

  if (!open) return null;

  const close = () => {
    setPending(null);
    onClose();
  };

  const confirmDelete = () => {
    if (pending) onDelete(pending.id);
    setPending(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-6" onClick={close}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[360px] rounded-3xl overflow-hidden animate-[fadeIn_0.2s_ease]"
        style={{
          background: "rgba(15,20,27,0.92)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          border: "1px solid rgba(244,64,107,0.22)",
          boxShadow: "0 24px 60px -20px rgba(0,0,0,0.7), inset 0 1px 20px -12px rgba(244,64,107,0.5)",
        }}
      >
        <div className="neon-strip" />

        {/* ADIM 2: onay */}
        {pending ? (
          <div className="p-6">
            <h2 className="text-[16.5px] font-bold text-[#ECF2F4] mb-2 text-balance">
              Bu planı silmek istediğinize emin misiniz?
            </h2>
            <p className="text-[13px] text-[#8695A3] leading-relaxed mb-5">
              <b style={{ color: "#ECF2F4" }}>"{pending.title || "Plan"}"</b> ve ona ait tüm rutin/görevler kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setPending(null)}
                className="flex-1 rounded-xl py-2.5 text-[13.5px] font-semibold border"
                style={{ borderColor: "#232C36", color: "#C5D0D8" }}
              >
                Geri
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-xl py-2.5 text-[13.5px] font-semibold"
                style={{ background: "#F0827A", color: "#0A0E13" }}
              >
                Evet, Sil
              </button>
            </div>
          </div>
        ) : (
          /* ADIM 1: plan seçimi */
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-[16.5px] font-bold text-[#ECF2F4] text-balance">Hangi planı silmek istiyorsunuz?</h2>
              <button
                onClick={close}
                aria-label="Kapat"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8695A3] hover:text-[#ECF2F4] transition-colors shrink-0"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                ✕
              </button>
            </div>

            {plans.length === 0 ? (
              <p className="text-[13px] text-[#8695A3] leading-relaxed py-4 text-center">Silinecek kayıtlı planın yok.</p>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-[340px] overflow-y-auto no-scrollbar">
                {plans.map((p) => {
                  const cat = CATEGORIES[p.mode] || CATEGORIES.general;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPending(p)}
                      className="w-full text-left rounded-2xl border p-3.5 flex items-center gap-3 transition-colors hover:bg-[#161D25] card-glow"
                      style={{ borderColor: "#232C36", background: "#12181F" }}
                    >
                      <span className="text-lg shrink-0">{cat.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-semibold text-[#ECF2F4] truncate">{p.title || "Plan"}</div>
                        <div className="text-[11.5px] text-[#8695A3] truncate">{cat.label}</div>
                      </div>
                      <span className="text-[14px] shrink-0" style={{ color: "#FF6E92" }}>🗑️</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
