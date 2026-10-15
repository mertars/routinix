import { useState } from "react";
import { Trash2 } from "lucide-react";
import Sheet from "./Sheet";
import { Bubble, COLOR_KEYS, ICON_KEYS, Icon } from "./icons";
import { Segmented } from "./common";
import { useKesem } from "../state/store";

// Kategori / alt kategori düzenleyici — ekleme sayfasından ve yönetim
// sayfasından AYNI bileşen kullanılır.
export function CategoryEditor({ initial, onClose, onSaved }) {
  const { saveCategory, deleteCategory, catById } = useKesem();
  const editing = !!initial.id;
  const parent = initial.parentId ? catById(initial.parentId) : null;
  const [name, setName] = useState(initial.name || "");
  const [icon, setIcon] = useState(initial.icon || parent?.icon || "tag");
  const [color, setColor] = useState(initial.color || parent?.color || "rose");
  const [kind] = useState(initial.kind || "expense");
  const valid = name.trim().length > 0;

  const save = async () => {
    if (!valid) return;
    const rec = await saveCategory({ id: initial.id, name: name.trim().slice(0, 28), icon, color, kind, parentId: initial.parentId || null });
    if (rec) {
      onSaved?.(rec);
      onClose();
    }
  };
  const remove = async () => {
    onClose();
    await deleteCategory(initial.id);
  };

  return (
    <Sheet open onClose={onClose} title={editing ? (parent ? "Alt kategoriyi düzenle" : "Kategoriyi düzenle") : parent ? `Yeni alt kategori · ${parent.name}` : "Yeni kategori"} size="sm">
      <div className="k-form">
        <div className="k-preview-row">
          <Bubble icon={icon} color={color} size={56} />
          <input className="k-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Kategori adı" maxLength={28} autoFocus={!editing} aria-label="Kategori adı" />
        </div>
        <div className="k-label">İkon</div>
        <div className="k-icon-grid">
          {ICON_KEYS.map((k) => (
            <button key={k} type="button" className={icon === k ? "on" : ""} style={{ "--c": `var(--kc-${color})` }} onClick={() => setIcon(k)} aria-label={k} aria-pressed={icon === k}>
              <Icon name={k} size={20} />
            </button>
          ))}
        </div>
        <div className="k-label">Renk</div>
        <div className="k-color-row">
          {COLOR_KEYS.map((c) => (
            <button key={c} type="button" className={color === c ? "on" : ""} style={{ "--c": `var(--kc-${c})` }} onClick={() => setColor(c)} aria-label={c} aria-pressed={color === c} />
          ))}
        </div>
        <div className="k-form-actions">
          {editing && (
            <button type="button" className="k-btn danger-ghost" onClick={remove}>
              <Trash2 size={16} /> Sil
            </button>
          )}
          <button type="button" className="k-btn primary grow" disabled={!valid} onClick={save}>
            Kaydet
          </button>
        </div>
      </div>
    </Sheet>
  );
}

const ACC_TYPES = [
  { value: "cash", label: "Nakit" },
  { value: "card", label: "Kart" },
  { value: "other", label: "Diğer" },
];

export function AccountEditor({ initial, onClose, onSaved }) {
  const { saveAccount, deleteAccount } = useKesem();
  const editing = !!initial.id;
  const [name, setName] = useState(initial.name || "");
  const [type, setType] = useState(initial.type || "card");
  const [color, setColor] = useState(initial.color || "indigo");
  const valid = name.trim().length > 0;
  const iconFor = type === "cash" ? "cash" : type === "card" ? "card" : "wallet";

  const save = async () => {
    if (!valid) return;
    const rec = await saveAccount({ id: initial.id, name: name.trim().slice(0, 32), type, color });
    if (rec) {
      onSaved?.(rec);
      onClose();
    }
  };
  return (
    <Sheet open onClose={onClose} title={editing ? "Ödeme yöntemini düzenle" : "Yeni ödeme yöntemi"} size="sm">
      <div className="k-form">
        <div className="k-preview-row">
          <Bubble icon={iconFor} color={color} size={56} />
          <input className="k-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Akbank Kredi Kartı" maxLength={32} autoFocus={!editing} aria-label="Ad" />
        </div>
        <div className="k-label">Tür</div>
        <Segmented value={type} onChange={setType} options={ACC_TYPES} label="Ödeme türü" />
        <div className="k-label">Renk</div>
        <div className="k-color-row">
          {COLOR_KEYS.map((c) => (
            <button key={c} type="button" className={color === c ? "on" : ""} style={{ "--c": `var(--kc-${c})` }} onClick={() => setColor(c)} aria-label={c} aria-pressed={color === c} />
          ))}
        </div>
        <div className="k-form-actions">
          {editing && (
            <button
              type="button"
              className="k-btn danger-ghost"
              onClick={async () => {
                onClose();
                await deleteAccount(initial.id);
              }}
            >
              <Trash2 size={16} /> Sil
            </button>
          )}
          <button type="button" className="k-btn primary grow" disabled={!valid} onClick={save}>
            Kaydet
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export function TagEditor({ initial, onClose }) {
  const { saveTag, deleteTag } = useKesem();
  const [name, setName] = useState(initial.name || "");
  const editing = !!initial.id;
  return (
    <Sheet open onClose={onClose} title={editing ? "Etiketi düzenle" : "Yeni etiket"} size="sm">
      <div className="k-form">
        <input className="k-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Etiket adı" maxLength={24} autoFocus aria-label="Etiket adı" />
        <div className="k-form-actions">
          {editing && (
            <button
              type="button"
              className="k-btn danger-ghost"
              onClick={async () => {
                onClose();
                await deleteTag(initial.id);
              }}
            >
              <Trash2 size={16} /> Sil
            </button>
          )}
          <button
            type="button"
            className="k-btn primary grow"
            disabled={!name.trim()}
            onClick={async () => {
              const clean = name.trim().replace(/^#/, "");
              if (await saveTag({ id: initial.id, name: clean })) onClose();
            }}
          >
            Kaydet
          </button>
        </div>
      </div>
    </Sheet>
  );
}
