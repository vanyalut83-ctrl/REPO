import { useEffect, useMemo, useRef, useState } from "react";
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
function statusLabel(st) {
  if (st === "waiting") return { text: "Очікування", tone: "blue" };
  if (st === "in_transit") return { text: "В дорозі", tone: "amber" };
  return { text: st || "—", tone: "gray" };
}

function Modal({ open, onClose, title, subtitle, children, footer }) {
  if (!open) return null;
  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modal modern" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">{title}</div>
            {subtitle ? <div className="modalSubtitle">{subtitle}</div> : null}
          </div>
          <button className="iconBtn" type="button" onClick={onClose}>✕</button>
        </div>
        <div className="modalBody">{children}</div>
        {footer ? <div className="modalFooter">{footer}</div> : null}
      </div>
    </div>
  );
}

function PhotoViewer({ open, urls, startIndex, onClose }) {
  const rowRef = useRef(null);
  const [idx, setIdx] = useState(startIndex ?? 0);

  useEffect(() => {
    if (!open) return;
    setIdx(startIndex ?? 0);
    requestAnimationFrame(() => {
      const el = rowRef.current;
      if (!el) return;
      const slide = el.children[startIndex ?? 0];
      slide?.scrollIntoView?.({ behavior: "instant", inline: "start" });
    });
  }, [open, startIndex, urls?.length]);

  function onScroll() {
    const el = rowRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    setIdx(Math.round(el.scrollLeft / w));
  }

  if (!open) return null;

  return (
    <div className="viewerOverlay" onClick={onClose}>
      <div className="viewerTop" onClick={(e) => e.stopPropagation()}>
        <div className="viewerCount">{urls?.length ? `${idx + 1} / ${urls.length}` : ""}</div>
        <button className="viewerClose" type="button" onClick={onClose}>Закрити</button>
      </div>
      <div className="viewerRow" ref={rowRef} onScroll={onScroll} onClick={(e) => e.stopPropagation()}>
        {urls.map((u) => (
          <div className="viewerSlide" key={u}>
            <img className="viewerImg" src={u} alt="" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  const [stats, setStats] = useState({
    stock_value: 0,
    potential_profit: 0,
    units_in_stock: 0,
    open_shipments: 0,
    shipments_all_time: 0,
  });

  const [shipments, setShipments] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);

  // viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrls, setViewerUrls] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  async function loadStats() {
    const { data: d1 } = await db.from("dashboard_stats").select("*").single();
    const { data: d2 } = await db.from("shipment_stats").select("*").single();

    setStats({
      stock_value: d1?.stock_value ?? 0,
      potential_profit: d1?.potential_profit ?? 0,
      units_in_stock: d1?.units_in_stock ?? 0,
      open_shipments: d2?.open_shipments ?? 0,
      shipments_all_time: d2?.shipments_all_time ?? 0,
    });
  }

  async function loadShipments() {
    const { data, error } = await db
      .from("item_events")
      .select("id, qty, created_at, status, meta, items(id, title, sku, size, color, photo_paths)")
      .eq("type", "ship")
      .in("status", ["waiting", "in_transit"])
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) throw error;
    setShipments(data ?? []);
  }

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      await Promise.all([loadStats(), loadShipments()]);
    } catch (e) {
      setErr(e?.message ?? "Помилка завантаження");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return shipments;
    return shipments.filter((ev) => {
      const it = ev.items;
      const m = ev.meta || {};
      const color = m.color ?? it?.color ?? "";
      const size = m.size ?? it?.size ?? "";
      const hay = `${m.full_name ?? ""} ${m.phone ?? ""} ${color} ${size} ${it?.title ?? ""} ${it?.sku ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [shipments, q]);

  function openShipment(ev) {
    setActive(ev);
    setOpen(true);
  }

  async function startTransit(id) {
    setErr("");
    setBusyId(id);
    try {
      const { error } = await db.rpc("shipment_mark_in_transit", { p_ship_event_id: id });
      if (error) throw error;
      setShipments((prev) => prev.map((x) => (x.id === id ? { ...x, status: "in_transit" } : x)));
      setActive((a) => (a?.id === id ? { ...a, status: "in_transit" } : a));
    } catch (e) {
      setErr(e?.message ?? "Помилка: Відправлено");
    } finally {
      setBusyId(null);
    }
  }

  async function markReceived(id) {
    setErr("");
    setBusyId(id);
    try {
      const { error } = await db.rpc("shipment_received", { p_ship_event_id: id });
      if (error) throw error;
      setOpen(false);
      setActive(null);
      await loadAll();
    } catch (e) {
      setErr(e?.message ?? "Помилка: Отримано");
    } finally {
      setBusyId(null);
    }
  }

  async function markRefused(id) {
    setErr("");
    setBusyId(id);
    try {
      const { error } = await db.rpc("shipment_refused", { p_ship_event_id: id });
      if (error) throw error;
      setOpen(false);
      setActive(null);
      await loadAll();
    } catch (e) {
      setErr(e?.message ?? "Помилка: Відмова");
    } finally {
      setBusyId(null);
    }
  }

  const activeUrls = useMemo(() => {
    if (!active) return [];
    const it = active.items;
    const m = active.meta || {};

    const itemUrls = (it?.photo_paths ?? [])
      .map((p) => normalizeItemPhotoPath(it.id, p))
      .filter(Boolean)
      .map(getPublicPhotoUrl);

    // НОВЕ: читаємо тільки ship_photo_paths (але підтримуємо старе meta.photo_paths якщо було)
    const shipPaths =
      Array.isArray(m.ship_photo_paths) ? m.ship_photo_paths :
      Array.isArray(m.photo_paths) ? m.photo_paths : [];

    const shipUrls = shipPaths.map(getPublicPhotoUrl);

    return uniq([...itemUrls, ...shipUrls]);
  }, [active]);

  function openViewer(urls, start = 0) {
    setViewerUrls(urls);
    setViewerIndex(start);
    setViewerOpen(true);
  }

  return (
    <section>
      <div className="homeTop2">
        <div className="homeMetric">
          <div className="homeMetricLabel">Вартість складу</div>
          <div className="homeMetricValue">₴ {money(stats.stock_value)}</div>
          <div className="homeMetricHint">шт * собівартість</div>
        </div>
        <div className="homeMetric">
          <div className="homeMetricLabel">Можливий прибуток</div>
          <div className="homeMetricValue">₴ {money(stats.potential_profit)}</div>
          <div className="homeMetricHint">шт * (ціна - собів.)</div>
        </div>
      </div>

      <div className="homeTop3">
        <div className="homeChip"><span>Активні відправлення</span><b>{stats.open_shipments}</b></div>
        <div className="homeChip"><span>Товару на складі (шт)</span><b>{stats.units_in_stock}</b></div>
        <div className="homeChip"><span>Відправлень за весь час</span><b>{stats.shipments_all_time}</b></div>
      </div>

      <div className="homeTools">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук: ПІБ / телефон / колір / розмір..." style={{ flex: "1 1 260px" }} />
        <button className="btnSecondary" type="button" onClick={loadAll}>Оновити</button>
      </div>

      {err ? <div className="errorBox">{err}</div> : null}
      {loading ? <p style={{ marginTop: 10 }}>Завантаження...</p> : null}

      <div className="shipTiles">
        {filtered.map((ev) => {
          const it = ev.items;
          const m = ev.meta || {};
          const color = m.color ?? it?.color ?? "—";
          const size = m.size ?? it?.size ?? "—";
          const st = statusLabel(ev.status);

          return (
            <button key={ev.id} type="button" className="shipTileHeadOnly" onClick={() => openShipment(ev)}>
              <div className="shipTileLeft">
                <div className={`shipPill ${st.tone}`}>{st.text}</div>
                <div className="shipName">{m.full_name || "—"}</div>
                <div className="shipPhone">{m.phone || ""}</div>
              </div>
              <div className="shipTileRight">
                <div className="shipSpec"><span>Колір:</span> <b>{color}</b></div>
                <div className="shipSpec"><span>Розмір:</span> <b>{size}</b></div>
                <div className="shipSpec"><span>К-сть:</span> <b>{ev.qty}</b></div>
              </div>
            </button>
          );
        })}
      </div>

      <Modal
        open={open}
        onClose={() => { setOpen(false); setActive(null); }}
        title="Відправлення"
        subtitle={active ? new Date(active.created_at).toLocaleString() : ""}
        footer={
          active ? (
            active.status === "waiting" ? (
              <div className="modalFooterSplit">
                <button className="btnSecondary" type="button" onClick={() => setOpen(false)}>Закрити</button>
                <button className="btn" type="button" onClick={() => startTransit(active.id)} disabled={busyId === active.id}>
                  {busyId === active.id ? "..." : "Відправлено"}
                </button>
              </div>
            ) : (
              <div className="modalFooterSplit">
                <button className="btnSecondary" type="button" onClick={() => setOpen(false)}>Закрити</button>
                <div className="modalFooterRight">
                  <button className="shipBtnDanger" type="button" onClick={() => markRefused(active.id)} disabled={busyId === active.id}>Відмова</button>
                  <button className="shipBtnSuccess" type="button" onClick={() => markReceived(active.id)} disabled={busyId === active.id}>Отримано</button>
                </div>
              </div>
            )
          ) : null
        }
      >
        {active ? (
          <>
            <div className="detailBlock">
              <div className="detailBlockTitle">{active.items?.title || "Товар"}</div>
              <div className="detailLine"><b>ПІБ:</b> {active.meta?.full_name || "—"}</div>
              <div className="detailLine"><b>Тел:</b> {active.meta?.phone || "—"}</div>
              <div className="detailLine"><b>Місто:</b> {active.meta?.city || "—"}</div>
              <div className="detailLine"><b>Відділення:</b> {active.meta?.branch || "—"}</div>
              <div className="detailLine"><b>Колір:</b> {active.meta?.color ?? active.items?.color ?? "—"}</div>
              <div className="detailLine"><b>Розмір:</b> {active.meta?.size ?? active.items?.size ?? "—"}</div>
              <div className="detailLine"><b>К-сть:</b> {active.qty}</div>
            </div>

            <div className="detailBlock">
              <div className="detailBlockTitle">Фото (натисни щоб відкрити)</div>
              {activeUrls.length ? (
                <div className="detailPhotos">
                  {activeUrls.map((u, idx) => (
                    <img
                      key={u}
                      src={u}
                      alt=""
                      className="detailPhoto"
                      loading="lazy"
                      onClick={() => openViewer(activeUrls, idx)}
                      style={{ cursor: "pointer" }}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ color: "rgba(11,18,32,.55)" }}>Нема фото</div>
              )}
            </div>
          </>
        ) : null}
      </Modal>

      <PhotoViewer
        open={viewerOpen}
        urls={viewerUrls}
        startIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
      />
    </section>
  );
}