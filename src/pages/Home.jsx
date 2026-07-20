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
  for (const x of arr) {
    if (!x) continue;
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

function IconTruck({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 7h11v10H3V7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M14 10h4l3 3v4h-7v-7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M17 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}
function IconCheck({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconX({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
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
      if (slide?.scrollIntoView) slide.scrollIntoView({ behavior: "instant", inline: "start" });
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

function PhotoBoxSquare({ urls, onOpenViewer }) {
  return (
    <div
      className="pMedia"
      role="button"
      onClick={urls?.length ? onOpenViewer : undefined}
      style={{ cursor: urls?.length ? "pointer" : "default" }}
    >
      <div className="pMediaRow">
        {urls?.length ? (
          urls.map((u) => (
            <div className="pMediaSlide" key={u}>
              <img className="pMediaImg" src={u} alt="" />
            </div>
          ))
        ) : (
          <div className="pMediaEmpty">
            <div className="pMediaIcon" />
          </div>
        )}
      </div>
    </div>
  );
}

function ShipmentCard({ ev, onStartTransit, onRefused, onReceived, onOpenViewer, busy }) {
  const it = ev.items;
  const meta = ev.meta || {};

  // Фото: спочатку зі складу, потім (в кінці) фото додані при відправленні
  const itemUrls = (it?.photo_paths ?? [])
    .map((p) => normalizeItemPhotoPath(it.id, p))
    .filter(Boolean)
    .map(getPublicPhotoUrl);

  const shipUrls = (meta.photo_paths ?? []).map(getPublicPhotoUrl);
  const urls = uniq([...itemUrls, ...shipUrls]);

  const status = ev.status; // waiting | in_transit | ...
  const title = `${it?.title ?? "Товар"}${it?.size ? ` • ${it.size}` : ""}`;

  const pill =
    status === "waiting"
      ? { text: "очікування", bg: "rgba(37,99,235,.10)", br: "rgba(37,99,235,.18)", dot: "#2563eb", col: "#1d4ed8" }
      : { text: "в дорозі", bg: "rgba(245,158,11,.12)", br: "rgba(245,158,11,.18)", dot: "#f59e0b", col: "#92400E" };

  return (
    <div className="pCard">
      <div className="pBadges">
        <div className="pBadge left">Відправлення</div>
        <div className="pBadge right warn">x{ev.qty}</div>
      </div>

      <PhotoBoxSquare urls={urls} onOpenViewer={onOpenViewer} />

      <div className="pBody">
        <div className="pTitle" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#1d4ed8", display: "grid", placeItems: "center" }}><IconTruck /></span>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </span>
        </div>

        <div className="pSub">
          {meta.city ? `${meta.city}${meta.branch ? ` • Відд. ${meta.branch}` : ""}` : "—"}
        </div>

        <div className="pInfoRow" style={{ marginTop: 10 }}>
          <div className="pInfo">
            <div className="pInfoLabel">Клієнт</div>
            <div className="pInfoValue" style={{ fontSize: 13 }}>{meta.full_name || "—"}</div>
            <div className="pInfoSmall">{meta.phone || ""}</div>
          </div>

          <div className="pInfo">
            <div className="pInfoLabel">Адреса</div>
            <div className="pInfoValue" style={{ fontSize: 13 }}>{meta.city || "—"}</div>
            <div className="pInfoSmall">{meta.branch ? `Відділення: ${meta.branch}` : ""}</div>
          </div>
        </div>

        <div className="pFooter" style={{ marginTop: 12, alignItems: "center" }}>
          {status === "waiting" ? (
            <button className="shipStatusBtn" type="button" onClick={() => onStartTransit(ev.id)} disabled={busy}>
              Відправлено
            </button>
          ) : (
            <div className="shipActions">
              <button className="shipBtnDanger" type="button" onClick={() => onRefused(ev.id)} disabled={busy}>
                <IconX /> Відмова
              </button>
              <button className="shipBtnSuccess" type="button" onClick={() => onReceived(ev.id)} disabled={busy}>
                <IconCheck /> Отримано
              </button>
            </div>
          )}

          <div className="pStockPill" style={{ background: pill.bg, borderColor: pill.br, color: pill.col }}>
            <span className="dot" style={{ background: pill.dot }} />
            <span>{pill.text}</span>
          </div>
        </div>

        <div className="shipMetaLine">
          <span>{it?.sku ? `SKU-${it.sku}` : ""}</span>
          <span>{new Date(ev.created_at).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  const [shipments, setShipments] = useState([]);

  // viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrls, setViewerUrls] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const { data, error } = await db
        .from("item_events")
        .select("id, qty, created_at, status, meta, items(id, title, size, sku, photo_paths)")
        .eq("type", "ship")
        .in("status", ["waiting", "in_transit"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setShipments(data ?? []);
    } catch (e) {
      setErr(e?.message ?? "Помилка завантаження доставок");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return shipments;
    return shipments.filter((x) => {
      const it = x.items;
      const m = x.meta || {};
      return `${it?.title ?? ""} ${it?.sku ?? ""} ${it?.size ?? ""} ${m.full_name ?? ""} ${m.phone ?? ""} ${m.city ?? ""} ${m.branch ?? ""}`
        .toLowerCase()
        .includes(s);
    });
  }, [shipments, q]);

  function openViewer(urls, start = 0) {
    setViewerUrls(urls);
    setViewerIndex(start);
    setViewerOpen(true);
  }

  async function startTransit(id) {
    setErr("");
    setBusyId(id);
    try {
      const { error } = await db.rpc("shipment_mark_in_transit", { p_ship_event_id: id });
      if (error) throw error;

      // швидко оновимо локально, щоб не чекати повного reload
      setShipments((prev) => prev.map((x) => (x.id === id ? { ...x, status: "in_transit" } : x)));
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
      await load();
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
      await load();
    } catch (e) {
      setErr(e?.message ?? "Помилка: Відмова");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Пошук доставок: ПІБ / телефон / товар / місто..."
          style={{ flex: "1 1 260px" }}
        />
        <button className="btnSecondary" onClick={load} type="button">Оновити</button>
      </div>

      {err ? <div className="errorBox">{err}</div> : null}
      {loading ? <p style={{ marginTop: 10 }}>Завантаження...</p> : null}

      <div className="premiumGrid" style={{ marginTop: 14 }}>
        {filtered.map((ev) => {
          const it = ev.items;
          const meta = ev.meta || {};

          const itemUrls = (it?.photo_paths ?? [])
            .map((p) => normalizeItemPhotoPath(it.id, p))
            .filter(Boolean)
            .map(getPublicPhotoUrl);

          const shipUrls = (meta.photo_paths ?? []).map(getPublicPhotoUrl);
          const urls = uniq([...itemUrls, ...shipUrls]);

          return (
            <ShipmentCard
              key={ev.id}
              ev={ev}
              busy={busyId === ev.id}
              onStartTransit={startTransit}
              onRefused={markRefused}
              onReceived={markReceived}
              onOpenViewer={() => openViewer(urls, 0)}
            />
          );
        })}
      </div>

      <PhotoViewer
        open={viewerOpen}
        urls={viewerUrls}
        startIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
      />
    </section>
  );
}