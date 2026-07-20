// src/pages/History.jsx
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

function typeLabel(row) {
  if (row.type === "ship") {
    // waiting / in_transit / received / refused (може бути null у старих)
    const st = row.status || "waiting";
    if (st === "waiting") return { text: "Очікування", tone: "blue" };
    if (st === "in_transit") return { text: "В дорозі", tone: "amber" };
    if (st === "received") return { text: "Отримано", tone: "green" };
    if (st === "refused") return { text: "Відмова", tone: "red" };
    return { text: st, tone: "gray" };
  }
  if (row.type === "delivered") return { text: "Отримано", tone: "green" };
  if (row.type === "return") return { text: "Повернено/Відмова", tone: "red" };
  return { text: row.type, tone: "gray" };
}

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString("uk-UA", { maximumFractionDigits: 2 });
}

function startOfDayISO(dateStr) {
  // dateStr: YYYY-MM-DD
  const d = new Date(dateStr + "T00:00:00");
  return d.toISOString();
}
function endOfDayISO(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1); // < next day
  return d.toISOString();
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
  const [type, setType] = useState("all"); // all | ship | delivered | return
  const [dateFrom, setDateFrom] = useState(""); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState(""); // YYYY-MM-DD

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      let query = db
        .from("history_feed")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);

      if (type !== "all") query = query.eq("type", type);
      if (dateFrom) query = query.gte("created_at", startOfDayISO(dateFrom));
      if (dateTo) query = query.lt("created_at", endOfDayISO(dateTo));

      const { data, error } = await query;
      if (error) throw error;

      setRows(data ?? []);
    } catch (e) {
      setErr(e?.message ?? "Помилка завантаження історії");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((r) => {
      const hay = `${r.title ?? ""} ${r.sku ?? ""} ${r.size ?? ""} ${r.full_name ?? ""} ${r.phone ?? ""} ${r.city ?? ""} ${r.branch ?? ""}`
        .toLowerCase();
      return hay.includes(s);
    });
  }, [rows, q]);

  function openRow(r) {
    setActive(r);
    setOpen(true);
  }

  const activeUrls = useMemo(() => {
    if (!active) return [];
    const itemUrls = (active.item_photo_paths ?? [])
      .map((p) => normalizeItemPhotoPath(active.item_id, p))
      .filter(Boolean)
      .map(getPublicPhotoUrl);

    const shipPaths = Array.isArray(active.ship_photo_paths)
      ? active.ship_photo_paths
      : [];

    const shipUrls = shipPaths.map(getPublicPhotoUrl);

    // як ти хотів: спочатку фото товару зі складу, а потім фото, додані при доставці
    return uniq([...itemUrls, ...shipUrls]);
  }, [active]);

  return (
    <section>
      <div className="histTop">
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Пошук: товар / ПІБ / телефон / місто..."
          style={{ flex: "1 1 240px" }}
        />

        <select className="input" value={type} onChange={(e) => setType(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="all">Всі</option>
          <option value="ship">Відправлення</option>
          <option value="delivered">Отримано</option>
          <option value="return">Повернено</option>
        </select>

        <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />

        <button className="btnSecondary" type="button" onClick={load}>
          Застосувати
        </button>
      </div>

      {err ? <div className="errorBox">{err}</div> : null}
      {loading ? <p style={{ marginTop: 10 }}>Завантаження...</p> : null}

      <div className="histGrid">
        {filtered.map((r) => {
          const badge = typeLabel(r);
          const dt = new Date(r.created_at);

          return (
            <button key={r.event_id} className="histCard" type="button" onClick={() => openRow(r)}>
              <div className="histHead">
                <div className={`histBadge ${badge.tone}`}>{badge.text}</div>
                <div className="histTime">{dt.toLocaleString()}</div>
              </div>

              <div className="histTitle">
                {r.title} {r.size ? `• ${r.size}` : ""} {r.sku ? `• SKU-${r.sku}` : ""}
              </div>

              <div className="histRow">
                <span>К-сть</span>
                <b>{r.qty}</b>
              </div>

              <div className="histRow">
                <span>Ціна</span>
                <b>₴ {money(r.sale_price)}</b>
              </div>

              {r.type !== "ship" ? (
                <>
                  <div className="histRow">
                    <span>Сума</span>
                    <b>₴ {money(r.amount)}</b>
                  </div>
                  <div className="histRow">
                    <span>Прибуток</span>
                    <b style={{ color: Number(r.profit) >= 0 ? "#067647" : "#991B1B" }}>
                      ₴ {money(r.profit)}
                    </b>
                  </div>
                </>
              ) : null}

              {(r.full_name || r.phone) ? (
                <div className="histMini">
                  <div><b>Отримувач:</b> {r.full_name || "—"}</div>
                  <div><b>Тел:</b> {r.phone || "—"}</div>
                  <div><b>Місто:</b> {r.city || "—"}{r.branch ? `, відд. ${r.branch}` : ""}</div>
                </div>
              ) : (
                <div className="histMini" style={{ color: "rgba(11,18,32,.55)" }}>
                  Нема даних отримувача
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">Деталі</div>
            <div className="modalSubtitle">
              {active ? new Date(active.created_at).toLocaleString() : ""}
            </div>
          </div>
          <button className="iconBtn" type="button" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>

        <div className="modalBody">
          {active ? (
            <>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div className={`histBadge ${typeLabel(active).tone}`}>{typeLabel(active).text}</div>
                <div style={{ fontWeight: 900 }}>
                  {active.title} {active.size ? `• ${active.size}` : ""} {active.sku ? `• SKU-${active.sku}` : ""}
                </div>
              </div>

              <div className="detailGrid">
                <div><span>К-сть</span><b>{active.qty}</b></div>
                <div><span>Собівартість</span><b>₴ {money(active.cost)}</b></div>
                <div><span>Ціна</span><b>₴ {money(active.sale_price)}</b></div>
                <div><span>Сума</span><b>₴ {money(active.amount)}</b></div>
                <div><span>Прибуток</span><b style={{ color: Number(active.profit) >= 0 ? "#067647" : "#991B1B" }}>₴ {money(active.profit)}</b></div>
              </div>

              <div className="detailBlock">
                <div className="detailBlockTitle">Доставка</div>
                <div className="detailLine"><b>Отримувач:</b> {active.full_name || "—"}</div>
                <div className="detailLine"><b>Телефон:</b> {active.phone || "—"}</div>
                <div className="detailLine"><b>Місто:</b> {active.city || "—"}</div>
                <div className="detailLine"><b>Відділення:</b> {active.branch || "—"}</div>
              </div>

              <div className="detailBlock">
                <div className="detailBlockTitle">Фото</div>
                {activeUrls.length ? (
                  <div className="detailPhotos">
                    {activeUrls.map((u) => (
                      <img key={u} src={u} alt="" className="detailPhoto" loading="lazy" />
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "rgba(11,18,32,.55)" }}>Нема фото</div>
                )}
              </div>
            </>
          ) : null}
        </div>

        <div className="modalFooter">
          <button className="btn" type="button" onClick={() => setOpen(false)}>
            Закрити
          </button>
        </div>
      </Modal>
    </section>
  );
}