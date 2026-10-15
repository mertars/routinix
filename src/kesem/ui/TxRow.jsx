import { Paperclip } from "lucide-react";
import { Amt } from "./Amt";
import { Bubble } from "./icons";
import { useKesem } from "../state/store";
import { formatMoney } from "../model/money";
import { formatTime } from "../model/dates";

// Liste satırı — hem Ana Sayfa hem Harcamalar hem Silinenler'de.
export default function TxRow({ tx, onClick, active, showDay = false, trailing }) {
  const { catById, accById } = useKesem();
  const sub = tx.subcategoryId ? catById(tx.subcategoryId) : null;
  const cat = catById(tx.categoryId);
  const acc = accById(tx.accountId);
  const income = tx.kind === "income";
  const title = tx.merchant || sub?.name || cat.name;
  const meta = [sub && tx.merchant ? sub.name : tx.merchant ? cat.name : sub ? cat.name : null, acc.name, formatTime(tx.occurredAt)].filter(Boolean).join(" · ");
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className={`k-tx ${active ? "active" : ""}`} onClick={onClick} {...(onClick ? { "aria-current": active ? "true" : undefined } : {})}>
      <Bubble icon={cat.icon} color={cat.color} size={42} />
      <span className="k-tx-main">
        <span className="k-tx-title">{title}</span>
        <span className="k-tx-meta">
          {tx.receiptId && <Paperclip size={12} aria-label="Fişli" />}
          {showDay ? `${meta}` : meta}
        </span>
      </span>
      <span className={`k-tx-amt ${income ? "income" : ""}`}><Amt>{formatMoney(income ? tx.amountMinor : -tx.amountMinor, tx.currency, { sign: income })}</Amt></span>
      {trailing}
    </Tag>
  );
}
