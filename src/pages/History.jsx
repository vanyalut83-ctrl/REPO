import { useEffect, useMemo, useState } from "react";
import { db } from "../services/supabase";
import { getPublicPhotoUrl } from "../services/photos";

function normalizeItemPhotoPath(itemId, p) {
  if (!p) return null;
  const s = String(p);
  if (s.includes("/")) return s;
  return `${itemId}/${s}`;
}
function uniq(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr || []) {
    if (!x) continue;
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}
function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString("uk-UA", { maximumFractionDigits: 2 });
}
function startOfDayISO(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toISOString();
}
function endOfDayISO(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}
function badge(row) {
  if (row.type === "delivered") return { text: "Отримано", tone: "green" };
  if (row.type === "return") return { text: "Скасовано/Повернено", tone: "red" };
  return { text: row.type, tone: "gray" };
}

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modal modern" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export default function History() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [type, setType] = useState("all"); // all | delivered | return
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);

  async function load(overrides = {}) {
    setLoading(true);
    setErr("");
    try {
      const t = overrides.type ?? type;
      const df = overrides.dateFrom ?? dateFrom;
      const dt = overrides.dateTo ?? dateTo;

      let query = db
        .from("history_feed")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(400);

      if (t !== "all") query = query.eq("type", t);
      if (df) query = query.gte("created_at", startOfDayISO(df));
      if (dt) query = query.lt("created_at", endOfDayISO(dt));

      const { data, error } = await query;
      if (error) throw error;
      setRows(data ?? []);
    } catch (e) {
      setErr(e?.message ?? "Помилка завантаження історії");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const hay = `${r.title ?? ""} ${r.color ?? ""} ${r.size ?? ""} ${r.sku ?? ""} ${r.full_name ?? ""} ${r.phone ?? ""} ${r.city ?? ""} ${r.branch ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [rows, q]);

  const activeUrls = useMemo(() => {
    if (!active) return [];
    const itemUrls = (active.item_photo_paths ?? [])
      .map((p) => normalizeItemPhotoPath(active.item_id, p))
      .filter(Boolean)
      .map(getPublicPhotoUrl);

    const shipPaths = Array.isArray(active.ship_photo_paths) ? active.ship_photo_paths : [];
    const shipUrls = shipPaths.map(getPublicPhotoUrl);

    return uniq([...itemUrls, ...shipUrls]);
  }, [active]);

  async function resetFilters() {
    setQ("");
    setType("all");
    setDateFrom("");
    setDateTo("");
    await load({ type: "all", dateFrom: "", dateTo: "" });
  }

  return (
    <section>
      <div className="histTop">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук..." style={{ flex: "1 1 240px" }} />

        <select className="input" value={type} onChange={(e) => setType(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="all">Всі</option>
          <option value="delivered">Отримано</option>
          <option value="return">Скасовано/Повернено</option>
        </select>

        <input className="input" type="date" value={dateFrom || ""} onChange={(e) => setDateFrom(e.target.value)} />
        <input className="input" type="date" value={dateTo || ""} onChange={(e) => setDateTo(e.target.value)} />

        <button className="btnSecondary" type="button" onClick={() => load()}>Застосувати</button>
        <button className="btnSecondary" type="button" onClick={resetFilters}>Скинути</button>
      </div>

      {err ? <div className="errorBox">{err}</div> : null}
      {loading ? <p style={{ marginTop: 10 }}>Завантаження...</p> : null}

      <div className="histGrid">
        {filtered.map((r) => {
          const b = badge(r);
          const dt = new Date(r.created_at);
          return (
            <button
              key={r.event_id}
              className="histCard"
              type="button"
              onClick={() => { setActive(r); setOpen(true); }}
            >
              <div className="histHead">
                <div className={`histBadge ${b.tone}`}>{b.text}</div>
                <div className="histTime">{dt.toLocaleString()}</div>
              </div>

              <div className="histTitle">
                {r.title}
                {r.color ? ` • ${r.color}` : ""}
                {r.size ? ` • ${r.size}` : ""}
                {r.sku ? ` • SKU-${r.sku}` : ""}
              </div>

              <div className="histRow"><span>К-сть</span><b>{r.qty}</b></div>
              <div className="histRow"><span>Ціна</span><b>₴ {money(r.sale_price)}</b></div>
              <div className="histRow"><span>Сума</span><b>₴ {money(r.amount)}</b></div>
              <div className="histRow">
                <span>Прибуток</span>
                <b style={{ color: Number(r.profit) >= 0 ? "#067647" : "#991B1B" }}>₴ {money(r.profit)}</b>
              </div>

              <div className="histMini">
                <div><b>Отримувач:</b> {r.full_name || "—"}</div>
                <div><b>Тел:</b> {r.phone || "—"}</div>
                <div><b>Місто:</b> {r.city || "—"}{r.branch ? `, відд. ${r.branch}` : ""}</div>
              </div>
            </button>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">Деталі</div>
            <div className="modalSubtitle">{active ? new Date(active.created_at).toLocaleString() : ""}</div>
          </div>
          <button className="iconBtn" type="button" onClick={() => setOpen(false)}>✕</button>
        </div>

        <div className="modalBody">
          {active ? (
            <>
              <div style={{ fontWeight: 950 }}>
                {active.title}{active.color ? ` • ${active.color}` : ""}{active.size ? ` • ${active.size}` : ""}
              </div>

              <div className="detailPhotos" style={{ marginTop: 12 }}>
                {activeUrls.length ? activeUrls.map((u) => (
                  <img key={u} src={u} alt="" className="detailPhoto" loading="lazy" />
                )) : <div style={{ color: "rgba(11,18,32,.55)" }}>Нема фото</div>}
              </div>

              <div className="detailBlock">
                <div className="detailBlockTitle">Доставка</div>
                <div className="detailLine"><b>Отримувач:</b> {active.full_name || "—"}</div>
                <div className="detailLine"><b>Тел:</b> {active.phone || "—"}</div>
                <div className="detailLine"><b>Місто:</b> {active.city || "—"}</div>
                <div className="detailLine"><b>Відділення:</b> {active.branch || "—"}</div>
              </div>
            </>
          ) : null}
        </div>

        <div className="modalFooter">
          <button className="btn" type="button" onClick={() => setOpen(false)}>Закрити</button>
        </div>
      </Modal>
    </section>
  );
}