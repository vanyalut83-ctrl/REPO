import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../services/supabase";
import { getPublicPhotoUrl } from "../services/photos";

function normalizeItemPhotoPath(itemId, p) {
  if (!p) return null;
  const s = String(p);
  if (s.includes("/")) return s;
  return `${itemId}/${s}`;
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
    const next = Math.round(el.scrollLeft / w);
    setIdx(next);
  }

  if (!open) return null;

  return (
    <div className="viewerOverlay" onClick={onClose}>
      <div className="viewerTop" onClick={(e) => e.stopPropagation()}>
        <div className="viewerCount">
          {urls?.length ? `${idx + 1} / ${urls.length}` : ""}
        </div>
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
    <div className="pMedia" role="button" onClick={onOpenViewer} style={{ cursor: urls?.length ? "pointer" : "default" }}>
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

function ShipmentCard({ ev, actionsOpen, onToggleActions, onRefused, onReceived, onOpenViewer }) {
  const it = ev.items;
  const meta = ev.meta || {};

  // 1) фото доставки (meta.photo_paths) 2) якщо нема — фото товару
  const shipUrls = (meta.photo_paths ?? []).map(getPublicPhotoUrl);
  const itemUrls = (it?.photo_paths ?? [])
    .map((p) => normalizeItemPhotoPath(it.id, p))
    .filter(Boolean)
    .map(getPublicPhotoUrl);

  const urls = shipUrls.length ? shipUrls : itemUrls;

  const title = `${it?.title ?? "Товар"}${it?.size ? ` • ${it.size}` : ""}`;

  return (
    <div className="pCard">
      <div className="pBadges">
        <div className="pBadge left">Відправлення</div>
        <div className="pBadge right warn">x{ev.qty}</div>
      </div>

      <PhotoBoxSquare urls={urls} onOpenViewer={urls.length ? onOpenViewer : undefined} />

      <div className="pBody">
        <div className="pTitle" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#1d4ed8", display: "grid", placeItems: "center" }}><IconTruck /></span>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
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
          {!actionsOpen ? (
            <button className="shipStatusBtn" type="button" onClick={onToggleActions}>
              Відправлено
            </button>
          ) : (
            <div className="shipActions">
              <button className="shipBtnDanger" type="button" onClick={onRefused}>
                <IconX /> Відмова
              </button>
              <button className="shipBtnSuccess" type="button" onClick={onReceived}>
                <IconCheck /> Отримано
              </button>
            </div>
          )}

          <div className="pStockPill" style={{ background: "rgba(37,99,235,.10)", borderColor: "rgba(37,99,235,.18)", color: "#1d4ed8" }}>
            <span className="dot" style={{ background: "#2563eb" }} />
            <span>open</span>
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
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  const [shipments, setShipments] = useState([]);
  const [openActionsId, setOpenActionsId] = useState(null);

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
        .eq("status", "open")
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

  async function markReceived(id) {
    setErr("");
    try {
      const { error } = await db.rpc("shipment_received", { p_ship_event_id: id });
      if (error) throw error;
      setOpenActionsId(null);
      await load();
    } catch (e) {
      setErr(e?.message ?? "Помилка: Отримано");
    }
  }

  async function markRefused(id) {
    setErr("");
    try {
      const { error } = await db.rpc("shipment_refused", { p_ship_event_id: id });
      if (error) throw error;
      setOpenActionsId(null);
      await load();
    } catch (e) {
      setErr(e?.message ?? "Помилка: Відмова");
    }
  }

  function openViewer(urls, start = 0) {
    setViewerUrls(urls);
    setViewerIndex(start);
    setViewerOpen(true);
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

          const shipUrls = (meta.photo_paths ?? []).map(getPublicPhotoUrl);
          const itemUrls = (it?.photo_paths ?? [])
            .map((p) => normalizeItemPhotoPath(it.id, p))
            .filter(Boolean)
            .map(getPublicPhotoUrl);

          const urls = shipUrls.length ? shipUrls : itemUrls;

          return (
            <ShipmentCard
              key={ev.id}
              ev={ev}
              actionsOpen={openActionsId === ev.id}
              onToggleActions={() => setOpenActionsId((prev) => (prev === ev.id ? null : ev.id))}
              onRefused={() => markRefused(ev.id)}
              onReceived={() => markReceived(ev.id)}
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