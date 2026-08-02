// src/pages/Home.jsx
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
function toNumber(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
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
          <button className="iconBtn" type="button" onClick={onClose}>
            ✕
          </button>
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
        <div className="viewerCount">
          {urls?.length ? `${idx + 1} / ${urls.length}` : ""}
        </div>
        <button className="viewerClose" type="button" onClick={onClose}>
          Закрити
        </button>
      </div>
      <div
        className="viewerRow"
        ref={rowRef}
        onScroll={onScroll}
        onClick={(e) => e.stopPropagation()}
      >
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

  // edit mode
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({
    full_name: "",
    phone: "",
    ttn: "",
    city: "",
    branch: "",
    delivery_cost_total: "",
  });

  // refusal modal (ttn_return)
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [ttnReturn, setTtnReturn] = useState("");

  function openViewer(urls, start = 0) {
    setViewerUrls(urls);
    setViewerIndex(start);
    setViewerOpen(true);
  }

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
      .select(
        "id, qty, cost, sale_price, created_at, status, meta, items(id, title, sku, size, color, photo_paths)"
      )
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

  useEffect(() => {
    loadAll();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return shipments;
    return shipments.filter((ev) => {
      const it = ev.items;
      const m = ev.meta || {};
      const color = m.color ?? it?.color ?? "";
      const size = m.size ?? it?.size ?? "";
      const hay = `${m.full_name ?? ""} ${m.phone ?? ""} ${m.ttn ?? ""} ${m.ttn_return ?? ""} ${color} ${size} ${it?.title ?? ""} ${it?.sku ?? ""}`
        .toLowerCase();
      return hay.includes(s);
    });
  }, [shipments, q]);

  function openShipment(ev) {
    setActive(ev);
    setEditMode(false);

    const m = ev.meta || {};
    setDraft({
      full_name: m.full_name ?? "",
      phone: m.phone ?? "",
      ttn: m.ttn ?? "",
      city: m.city ?? "",
      branch: m.branch ?? "",
      delivery_cost_total: m.delivery_cost_total ? String(m.delivery_cost_total) : "",
    });

    setOpen(true);
  }

  async function startTransit(id) {
    setErr("");
    setBusyId(id);
    try {
      const { error } = await db.rpc("shipment_mark_in_transit", {
        p_ship_event_id: id,
      });
      if (error) throw error;

      setShipments((prev) =>
        prev.map((x) => (x.id === id ? { ...x, status: "in_transit" } : x))
      );
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
      const { error } = await db.rpc("shipment_received", {
        p_ship_event_id: id,
      });
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

  function openRefuseModal() {
    setTtnReturn("");
    setRefuseOpen(true);
  }

  async function confirmRefuse() {
    if (!active) return;
    setErr("");
    setBusyId(active.id);

    try {
      // ВАЖЛИВО: треба RPC shipment_refused_ttn(p_ship_event_id uuid, p_ttn_return text)
      const { error } = await db.rpc("shipment_refused_ttn", {
        p_ship_event_id: active.id,
        p_ttn_return: String(ttnReturn ?? "").trim(),
      });
      if (error) throw error;

      // після відмови status -> return_waiting, тому з Home зникне
      setRefuseOpen(false);
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

    const shipPaths = Array.isArray(m.ship_photo_paths)
      ? m.ship_photo_paths
      : Array.isArray(m.photo_paths)
        ? m.photo_paths
        : [];

    const shipUrls = shipPaths.map(getPublicPhotoUrl);

    return uniq([...itemUrls, ...shipUrls]);
  }, [active]);

  const calc = useMemo(() => {
    if (!active) return null;

    const qty = Number(active.qty || 0);
    const sale = Number(active.sale_price || 0);
    const shipCost = Number(active.cost || 0);

    const revenue = sale * qty;
    const costTotal = shipCost * qty;
    const profit = (sale - shipCost) * qty;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return { qty, sale, shipCost, revenue, costTotal, profit, margin };
  }, [active]);

  async function saveShipmentEdits() {
    if (!active) return;

    setErr("");
    setBusyId(active.id);

    try {
      const m = active.meta || {};
      const qty = Number(active.qty || 0);

      const baseCost =
        m.base_cost !== undefined && m.base_cost !== null
          ? Number(m.base_cost)
          : Number(active.cost || 0) - Number(m.delivery_cost_per_unit || 0);

      const deliveryRaw = String(draft.delivery_cost_total ?? "").trim();
      const deliveryTotal = deliveryRaw === "" ? null : toNumber(deliveryRaw);
      const extraPerUnit =
        deliveryTotal && deliveryTotal > 0 ? deliveryTotal / Math.max(qty, 1) : 0;

      const newShipCost =
        deliveryTotal && deliveryTotal > 0 ? baseCost + extraPerUnit : baseCost;

      const nextMeta = {
        ...m,
        full_name: draft.full_name?.trim() || null,
        phone: draft.phone?.trim() || null,
        ttn: draft.ttn?.trim() || null,
        city: draft.city?.trim() || null,
        branch: draft.branch?.trim() || null,

        base_cost: baseCost,
        delivery_cost_total: deliveryTotal && deliveryTotal > 0 ? deliveryTotal : null,
        delivery_cost_per_unit: deliveryTotal && deliveryTotal > 0 ? extraPerUnit : null,
      };

      const { error } = await db
        .from("item_events")
        .update({ meta: nextMeta, cost: newShipCost })
        .eq("id", active.id);

      if (error) throw error;

      const updated = { ...active, meta: nextMeta, cost: newShipCost };
      setActive(updated);
      setShipments((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEditMode(false);
    } catch (e) {
      setErr(e?.message ?? "Помилка збереження");
    } finally {
      setBusyId(null);
    }
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
        <div className="homeChip">
          <span>Активні відправлення</span>
          <b>{stats.open_shipments}</b>
        </div>
        <div className="homeChip">
          <span>Товару на складі (шт)</span>
          <b>{stats.units_in_stock}</b>
        </div>
        <div className="homeChip">
          <span>Відправлень за весь час</span>
          <b>{stats.shipments_all_time}</b>
        </div>
      </div>

      <div className="homeTools">
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Пошук: ПІБ / телефон / ТТН..."
          style={{ flex: "1 1 260px" }}
        />
        <button className="btnSecondary" type="button" onClick={loadAll}>
          Оновити
        </button>
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
            <button
              key={ev.id}
              type="button"
              className="shipTileHeadOnly"
              onClick={() => openShipment(ev)}
            >
              <div className="shipTileLeft">
                <div className={`shipPill ${st.tone}`}>{st.text}</div>
                <div className="shipName">{m.full_name || "—"}</div>
                <div className="shipPhone">ТТН: {m.ttn || "—"}</div>
              </div>
              <div className="shipTileRight">
                <div className="shipSpec">
                  <span>Колір:</span> <b>{color}</b>
                </div>
                <div className="shipSpec">
                  <span>Розмір:</span> <b>{size}</b>
                </div>
                <div className="shipSpec">
                  <span>К-сть:</span> <b>{ev.qty}</b>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* DETAILS */}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setActive(null);
          setEditMode(false);
        }}
        title="Відправлення"
        subtitle={active ? new Date(active.created_at).toLocaleString() : ""}
        footer={
          active ? (
            active.status === "waiting" ? (
              <div className="modalFooterSplit">
                <button className="btnSecondary" type="button" onClick={() => setOpen(false)}>
                  Закрити
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => startTransit(active.id)}
                  disabled={busyId === active.id}
                >
                  {busyId === active.id ? "..." : "Відправлено"}
                </button>
              </div>
            ) : (
              <div className="modalFooterSplit">
                <button className="btnSecondary" type="button" onClick={() => setOpen(false)}>
                  Закрити
                </button>
                <div className="modalFooterRight">
                  <button
                    className="shipBtnDanger"
                    type="button"
                    onClick={openRefuseModal}
                    disabled={busyId === active.id}
                  >
                    Відмова
                  </button>
                  <button
                    className="shipBtnSuccess"
                    type="button"
                    onClick={() => markReceived(active.id)}
                    disabled={busyId === active.id}
                  >
                    Отримано
                  </button>
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

              {!editMode ? (
                <>
                  <div className="detailLine"><b>ПІБ:</b> {active.meta?.full_name || "—"}</div>
                  <div className="detailLine"><b>Телефон:</b> {active.meta?.phone || "—"}</div>
                  <div className="detailLine"><b>ТТН:</b> {active.meta?.ttn || "—"}</div>
                  <div className="detailLine"><b>ТТН повернення:</b> {active.meta?.ttn_return || "—"}</div>
                  <div className="detailLine"><b>Місто:</b> {active.meta?.city || "—"}</div>
                  <div className="detailLine"><b>Відділення:</b> {active.meta?.branch || "—"}</div>

                  <button
                    className="btnSecondary"
                    type="button"
                    onClick={() => setEditMode(true)}
                    style={{ marginTop: 10 }}
                  >
                    Редагувати
                  </button>
                </>
              ) : (
                <div className="form" style={{ marginTop: 8 }}>
                  <div className="row2">
                    <label>
                      ПІБ
                      <input
                        className="input"
                        value={draft.full_name}
                        onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                      />
                    </label>
                    <label>
                      Телефон
                      <input
                        className="input"
                        inputMode="tel"
                        value={draft.phone}
                        onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                      />
                    </label>
                  </div>

                  <label>
                    ТТН
                    <input
                      className="input"
                      value={draft.ttn}
                      onChange={(e) => setDraft({ ...draft, ttn: e.target.value })}
                    />
                  </label>

                  <div className="row2">
                    <label>
                      Місто
                      <input
                        className="input"
                        value={draft.city}
                        onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                      />
                    </label>
                    <label>
                      Відділення
                      <input
                        className="input"
                        value={draft.branch}
                        onChange={(e) => setDraft({ ...draft, branch: e.target.value })}
                      />
                    </label>
                  </div>

                  <label>
                    Вартість доставки (₴, опц.)
                    <input
                      className="input"
                      inputMode="decimal"
                      value={draft.delivery_cost_total}
                      onChange={(e) =>
                        setDraft({ ...draft, delivery_cost_total: e.target.value })
                      }
                    />
                  </label>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button className="btnSecondary" type="button" onClick={() => setEditMode(false)}>
                      Скасувати
                    </button>
                    <button className="btn" type="button" onClick={saveShipmentEdits} disabled={busyId === active.id}>
                      {busyId === active.id ? "..." : "Зберегти"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* CALC */}
            {calc ? (
              <div className="detailBlock">
                <div className="detailBlockTitle">Розрахунки</div>
                <div className="detailLine"><b>К-сть:</b> {calc.qty}</div>
                <div className="detailLine"><b>Ціна / шт:</b> ₴ {money(calc.sale)}</div>
                <div className="detailLine"><b>Собівартість / шт (з доставкою):</b> ₴ {money(calc.shipCost)}</div>
                <div className="detailLine"><b>Сума:</b> ₴ {money(calc.revenue)}</div>
                <div className="detailLine"><b>Собівартість (сума):</b> ₴ {money(calc.costTotal)}</div>
                <div className="detailLine">
                  <b>Прибуток:</b>{" "}
                  <span style={{ color: calc.profit >= 0 ? "#067647" : "#991B1B", fontWeight: 950 }}>
                    ₴ {money(calc.profit)}
                  </span>
                </div>
                <div className="detailLine"><b>Маржа:</b> {calc.margin.toFixed(1)}%</div>
                <div className="detailLine">
                  <b>Доставка (сума):</b>{" "}
                  {active.meta?.delivery_cost_total ? `₴ ${money(active.meta.delivery_cost_total)}` : "—"}
                </div>
              </div>
            ) : null}

            {/* PHOTOS */}
            <div className="detailBlock">
              <div className="detailBlockTitle">Фото (клік — відкрити)</div>
              {activeUrls.length ? (
                <div className="detailPhotos">
                  {activeUrls.map((u, idx) => (
                    <img
                      key={u}
                      className="detailPhoto"
                      src={u}
                      alt=""
                      loading="lazy"
                      style={{ cursor: "pointer" }}
                      onClick={() => openViewer(activeUrls, idx)}
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

      {/* REFUSE (RETURN TTN) */}
      <Modal
        open={refuseOpen}
        onClose={() => setRefuseOpen(false)}
        title="Відмова"
        subtitle="Введи ТТН повернення до тебе (опціонально)"
        footer={
          <div className="modalFooterSplit">
            <button className="btnSecondary" type="button" onClick={() => setRefuseOpen(false)} disabled={busyId === active?.id}>
              Скасувати
            </button>
            <button className="shipBtnDanger" type="button" onClick={confirmRefuse} disabled={busyId === active?.id}>
              {busyId === active?.id ? "..." : "Підтвердити відмову"}
            </button>
          </div>
        }
      >
        <label style={{ display: "grid", gap: 6 }}>
          ТТН повернення
          <input
            className="input"
            value={ttnReturn}
            onChange={(e) => setTtnReturn(e.target.value)}
            placeholder="Напр. 20400000000000"
          />
        </label>
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