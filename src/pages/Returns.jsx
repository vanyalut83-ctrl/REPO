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

function PhotoSquare({ urls }) {
  const rowRef = useRef(null);
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    el.scrollLeft = 0;
  }, [urls?.length, urls?.[0]]);

  return (
    <div className="pMedia" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className="pMediaRow" ref={rowRef}>
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

export default function Returns() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);

  // viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrls, setViewerUrls] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  function openViewer(urls, start = 0) {
    setViewerUrls(urls);
    setViewerIndex(start);
    setViewerOpen(true);
  }

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const { data, error } = await db
        .from("item_events")
        .select("id, qty, created_at, status, meta, items(id, title, color, size, sku, photo_paths)")
        .eq("type", "ship")
        .eq("status", "return_waiting")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRows(data ?? []);
    } catch (e) {
      setErr(e?.message ?? "Помилка завантаження");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((x) => {
      const it = x.items;
      const m = x.meta || {};
      return `${it?.title ?? ""} ${m.full_name ?? ""} ${m.ttn ?? ""} ${m.ttn_return ?? ""} ${m.phone ?? ""} ${m.color ?? it?.color ?? ""} ${m.size ?? it?.size ?? ""}`
        .toLowerCase()
        .includes(s);
    });
  }, [rows, q]);

  function urlsFor(ev) {
    const it = ev.items;
    const m = ev.meta || {};

    const itemUrls = (it?.photo_paths ?? [])
      .map((p) => normalizeItemPhotoPath(it.id, p))
      .filter(Boolean)
      .map(getPublicPhotoUrl);

    const shipPaths =
      Array.isArray(m.ship_photo_paths) ? m.ship_photo_paths :
      Array.isArray(m.photo_paths) ? m.photo_paths : [];

    const shipUrls = shipPaths.map(getPublicPhotoUrl);

    return uniq([...itemUrls, ...shipUrls]);
  }

  async function markReturnReceived(id) {
    setBusyId(id);
    setErr("");
    try {
      const { error } = await db.rpc("return_received", { p_ship_event_id: id });
      if (error) throw error;
      await load();
      if (active?.id === id) {
        setOpen(false);
        setActive(null);
      }
    } catch (e) {
      setErr(e?.message ?? "Помилка");
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
          placeholder="Пошук: товар / ПІБ / ТТН..."
          style={{ flex: "1 1 260px" }}
        />
        <button className="btnSecondary" type="button" onClick={load}>Оновити</button>
      </div>

      {err ? <div className="errorBox">{err}</div> : null}
      {loading ? <p style={{ marginTop: 10 }}>Завантаження...</p> : null}

      <div className="premiumGrid" style={{ marginTop: 14 }}>
        {filtered.map((ev) => {
          const it = ev.items;
          const m = ev.meta || {};
          const urls = urlsFor(ev);

          const title = `${it?.title ?? "Товар"}${m.color || it?.color ? ` • ${m.color ?? it?.color}` : ""}${m.size || it?.size ? ` • ${m.size ?? it?.size}` : ""}`;

          return (
            <div className="pCard pCardClickable" key={ev.id} onClick={() => { setActive(ev); setOpen(true); }}>
              <div className="pBadges">
                <div className="pBadge left">Повернення</div>
                <div className="pBadge right warn">x{ev.qty}</div>
              </div>

              <PhotoSquare urls={urls} />

              <div className="pBody compact">
                <div className="pTitle">{title}</div>
                <div className="pSub">
                  <span><b>{m.full_name || "—"}</b></span>
                  <span style={{ marginLeft: 8 }}>ТТН: <b>{m.ttn_return || "—"}</b></span>
                </div>

                <div className="pFooter" style={{ marginTop: 10 }}>
                  <button
                    className="btn"
                    type="button"
                    onClick={(e) => { e.stopPropagation(); markReturnReceived(ev.id); }}
                    disabled={busyId === ev.id}
                  >
                    {busyId === ev.id ? "..." : "Отримано повернення"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={open}
        onClose={() => { setOpen(false); setActive(null); }}
        title="Повернення"
        subtitle={active ? new Date(active.created_at).toLocaleString() : ""}
        footer={
          active ? (
            <div className="modalFooterSplit">
              <button className="btnSecondary" type="button" onClick={() => { setOpen(false); setActive(null); }}>
                Закрити
              </button>
              <button className="btn" type="button" onClick={() => markReturnReceived(active.id)} disabled={busyId === active.id}>
                {busyId === active.id ? "..." : "Отримано повернення"}
              </button>
            </div>
          ) : null
        }
      >
        {active ? (
          <>
            <div className="detailBlock">
              <div className="detailBlockTitle">{active.items?.title || "Товар"}</div>
              <div className="detailLine"><b>ПІБ:</b> {active.meta?.full_name || "—"}</div>
              <div className="detailLine"><b>Телефон:</b> {active.meta?.phone || "—"}</div>
              <div className="detailLine"><b>ТТН (відправка):</b> {active.meta?.ttn || "—"}</div>
              <div className="detailLine"><b>ТТН (повернення):</b> {active.meta?.ttn_return || "—"}</div>
              <div className="detailLine"><b>Колір:</b> {active.meta?.color ?? active.items?.color ?? "—"}</div>
              <div className="detailLine"><b>Розмір:</b> {active.meta?.size ?? active.items?.size ?? "—"}</div>
              <div className="detailLine"><b>К-сть:</b> {active.qty}</div>
            </div>

            {(() => {
              const urls = urlsFor(active);
              return (
                <div className="detailBlock">
                  <div className="detailBlockTitle">Фото (клік — відкрити)</div>
                  {urls.length ? (
                    <div className="detailPhotos">
                      {urls.map((u, idx) => (
                        <img
                          key={u}
                          src={u}
                          alt=""
                          className="detailPhoto"
                          loading="lazy"
                          style={{ cursor: "pointer" }}
                          onClick={() => openViewer(urls, idx)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: "rgba(11,18,32,.55)" }}>Нема фото</div>
                  )}
                </div>
              );
            })()}
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