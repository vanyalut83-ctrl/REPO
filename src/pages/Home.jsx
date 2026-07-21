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

function statusLabel(st) {
  if (st === "waiting") return { text: "Очікування", tone: "blue" };
  if (st === "in_transit") return { text: "В дорозі", tone: "amber" };
  return { text: st || "—", tone: "gray" };
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");

  const [stats, setStats] = useState({
    stock_value: 0,
    potential_profit: 0,
    units_in_stock: 0,
    positions_count: 0,
    open_shipments: 0,
    shipments_all_time: 0,
  });

  const [shipments, setShipments] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function loadStats() {
    // dashboard_stats
    const { data: d1, error: e1 } = await db.from("dashboard_stats").select("*").single();
    if (!e1 && d1) {
      setStats((s) => ({
        ...s,
        stock_value: d1.stock_value ?? 0,
        potential_profit: d1.potential_profit ?? 0,
        units_in_stock: d1.units_in_stock ?? 0,
        positions_count: d1.positions_count ?? 0,
      }));
    }

    // shipment_stats
    const { data: d2, error: e2 } = await db.from("shipment_stats").select("*").single();
    if (!e2 && d2) {
      setStats((s) => ({
        ...s,
        open_shipments: d2.open_shipments ?? 0,
        shipments_all_time: d2.shipments_all_time ?? 0,
      }));
    }
  }

  async function loadShipments() {
    const { data, error } = await db
      .from("item_events")
      .select(
        "id, qty, created_at, status, meta, items(id, title, sku, size, color, photo_paths)"
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
      const hay = `${m.full_name ?? ""} ${m.phone ?? ""} ${it?.title ?? ""} ${it?.sku ?? ""} ${color} ${size} ${m.city ?? ""} ${m.branch ?? ""}`
        .toLowerCase();
      return hay.includes(s);
    });
  }, [shipments, q]);

  async function startTransit(id) {
    setErr("");
    setBusyId(id);
    try {
      const { error } = await db.rpc("shipment_mark_in_transit", { p_ship_event_id: id });
      if (error) throw error;

      // локально оновимо
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
      // після отримання ця доставка зникне з Home (бо status=received)
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
      await loadAll();
    } catch (e) {
      setErr(e?.message ?? "Помилка: Відмова");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      {/* TOP: 2 big blocks */}
      <div className="homeTop2">
        <div className="homeMetric">
          <div className="homeMetricLabel">Вартість складу</div>
          <div className="homeMetricValue">₴ {money(stats.stock_value)}</div>
          <div className="homeMetricHint">Сума (шт * собівартість)</div>
        </div>

        <div className="homeMetric">
          <div className="homeMetricLabel">Можливий прибуток</div>
          <div className="homeMetricValue">₴ {money(stats.potential_profit)}</div>
          <div className="homeMetricHint">Сума (шт * (ціна - собів.))</div>
        </div>
      </div>

      {/* SECOND ROW: info chips */}
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
          placeholder="Пошук: ПІБ / телефон / колір / розмір / товар..."
          style={{ flex: "1 1 260px" }}
        />
        <button className="btnSecondary" type="button" onClick={loadAll}>
          Оновити
        </button>
      </div>

      {err ? <div className="errorBox">{err}</div> : null}
      {loading ? <p style={{ marginTop: 10 }}>Завантаження...</p> : null}

      {/* SHIPMENT TILES */}
      <div className="shipTiles">
        {filtered.map((ev) => {
          const it = ev.items;
          const m = ev.meta || {};

          const color = m.color ?? it?.color ?? "—";
          const size = m.size ?? it?.size ?? "—";

          const st = statusLabel(ev.status);
          const isOpen = openId === ev.id;

          // фото: спочатку зі складу, потім відправлення
          const itemUrls = (it?.photo_paths ?? [])
            .map((p) => normalizeItemPhotoPath(it.id, p))
            .filter(Boolean)
            .map(getPublicPhotoUrl);

          const shipPaths = Array.isArray(m.photo_paths) ? m.photo_paths : [];
          const shipUrls = shipPaths.map(getPublicPhotoUrl);

          const urls = uniq([...itemUrls, ...shipUrls]);

          return (
            <div key={ev.id} className={`shipTile ${isOpen ? "open" : ""}`}>
              <button
                type="button"
                className="shipTileHead"
                onClick={() => setOpenId((prev) => (prev === ev.id ? null : ev.id))}
              >
                <div className="shipTileLeft">
                  <div className={`shipPill ${st.tone}`}>{st.text}</div>
                  <div className="shipName">{m.full_name || "—"}</div>
                  <div className="shipPhone">{m.phone || ""}</div>
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

              {isOpen ? (
                <div className="shipTileBody">
                  <div className="shipFullInfo">
                    <div className="shipFullTitle">
                      {it?.title || "Товар"} {it?.sku ? `• SKU-${it.sku}` : ""}
                    </div>

                    <div className="shipFullGrid">
                      <div><b>Місто:</b> {m.city || "—"}</div>
                      <div><b>Відділення:</b> {m.branch || "—"}</div>
                      <div><b>Дата/час:</b> {new Date(ev.created_at).toLocaleString()}</div>
                    </div>

                    <div className="shipActionsRow">
                      {ev.status === "waiting" ? (
                        <button
                          className="btn"
                          type="button"
                          onClick={() => startTransit(ev.id)}
                          disabled={busyId === ev.id}
                        >
                          {busyId === ev.id ? "..." : "Відправлено"}
                        </button>
                      ) : (
                        <>
                          <button
                            className="shipBtnDanger"
                            type="button"
                            onClick={() => markRefused(ev.id)}
                            disabled={busyId === ev.id}
                          >
                            Відмова
                          </button>
                          <button
                            className="shipBtnSuccess"
                            type="button"
                            onClick={() => markReceived(ev.id)}
                            disabled={busyId === ev.id}
                          >
                            Отримано
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="shipPhotosCol">
                    {urls.length ? (
                      urls.map((u) => (
                        <img key={u} className="shipPhotoFull" src={u} alt="" loading="lazy" />
                      ))
                    ) : (
                      <div className="shipNoPhotos">Нема фото</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}