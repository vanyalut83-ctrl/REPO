import { useEffect, useMemo, useState } from "react";
import { db } from "../services/supabase";
import { getPublicPhotoUrl } from "../services/photos";

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

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [openActionsId, setOpenActionsId] = useState(null);

  const [shipments, setShipments] = useState([]);

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

  useEffect(() => {
    load();
  }, []);

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

      <div className="shipHomeGrid">
        {filtered.map((x) => {
          const it = x.items;
          const m = x.meta || {};
          const photo = it?.photo_paths?.[0] ? getPublicPhotoUrl(it.photo_paths[0]) : null;

          const open = openActionsId === x.id;

          return (
            <div className="shipHomeCard" key={x.id}>
              <div className="shipHomeTop">
                <div className="shipHomeTitle">
                  <span className="shipHomeIcon"><IconTruck /></span>
                  <span>{it?.title ?? "Товар"}{it?.size ? ` • ${it.size}` : ""}</span>
                </div>
                <div className="shipHomeQty">x{x.qty}</div>
              </div>

              <div className="shipHomeRow">
                <div className="shipHomePhoto">
                  {photo ? <img src={photo} alt="" /> : <div className="shipHomeNoPhoto">Нема фото</div>}
                </div>

                <div className="shipHomeInfo">
                  <div><b>ПІБ:</b> {m.full_name}</div>
                  <div><b>Тел:</b> {m.phone}</div>
                  <div><b>Місто:</b> {m.city}</div>
                  <div><b>Відділення:</b> {m.branch}</div>
                </div>
              </div>

              <div className="shipHomeFooter">
                {!open ? (
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setOpenActionsId(x.id)}
                    title="Статус"
                  >
                    Відправлено
                  </button>
                ) : (
                  <div className="shipHomeActions">
                    <button className="btnDanger" type="button" onClick={() => markRefused(x.id)}>
                      <IconX /> Відмова
                    </button>
                    <button className="btnSuccess" type="button" onClick={() => markReceived(x.id)}>
                      <IconCheck /> Отримано
                    </button>
                  </div>
                )}

                <div className="shipHomeTime">
                  {new Date(x.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}