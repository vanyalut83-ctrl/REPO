import { useEffect, useMemo, useState } from "react";
import { createItem, listItems } from "../services/items";

export default function Stock() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // форма (мінімум)
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    size: "",
    cost: "0",
    sale_price: "0",
    qty_in_stock: "0",
    qty_in_delivery: "0",
  });

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await listItems();
      setItems(data);
    } catch (e) {
      setErr(e.message ?? "Помилка завантаження");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) =>
      `${x.title ?? ""} ${x.size ?? ""} ${x.sku ?? ""}`.toLowerCase().includes(s)
    );
  }, [items, q]);

  async function onCreate(e) {
    e.preventDefault();
    setErr("");

    try {
      const payload = {
        title: form.title.trim(),
        size: form.size.trim() || null,
        cost: Number(form.cost || 0),
        sale_price: Number(form.sale_price || 0),
        qty_in_stock: Number(form.qty_in_stock || 0),
        qty_in_delivery: Number(form.qty_in_delivery || 0),
      };

      if (!payload.title) throw new Error("Вкажи назву товару");

      await createItem(payload);
      setOpen(false);
      setForm({
        title: "",
        size: "",
        cost: "0",
        sale_price: "0",
        qty_in_stock: "0",
        qty_in_delivery: "0",
      });
      await load();
    } catch (e2) {
      setErr(e2.message ?? "Помилка створення");
    }
  }

  return (
    <section>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Пошук: назва / розмір / sku"
          className="input"
          style={{ flex: "1 1 260px" }}
        />
        <button className="btn" onClick={() => setOpen(true)}>+ Додати товар</button>
        <button className="btnSecondary" onClick={load}>Оновити</button>
      </div>

      {err ? <p style={{ color: "#ffb4b4" }}>{err}</p> : null}
      {loading ? <p>Завантаження...</p> : null}

      {/* Desktop table */}
      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Товар</th>
              <th>Розмір</th>
              <th>Собівартість</th>
              <th>Ціна</th>
              <th>В наявності</th>
              <th>В доставці</th>
              <th>Отримано</th>
              <th>Повернено</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((x) => (
              <tr key={x.id}>
                <td>{x.title}</td>
                <td>{x.size ?? "-"}</td>
                <td>{x.cost}</td>
                <td>{x.sale_price}</td>
                <td>{x.qty_in_stock}</td>
                <td>{x.qty_in_delivery}</td>
                <td>{x.qty_delivered_total}</td>
                <td>{x.qty_returned_total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="cards">
        {filtered.map((x) => (
          <div className="card" key={x.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{x.title}</div>
                <div style={{ opacity: 0.8 }}>Розмір: {x.size ?? "-"}</div>
              </div>
              <div style={{ textAlign: "right", opacity: 0.9 }}>
                <div>Ціна: {x.sale_price}</div>
                <div>Собівартість: {x.cost}</div>
              </div>
            </div>

            <div className="miniGrid">
              <div><span>В наявності</span><b>{x.qty_in_stock}</b></div>
              <div><span>В доставці</span><b>{x.qty_in_delivery}</b></div>
              <div><span>Отримано</span><b>{x.qty_delivered_total}</b></div>
              <div><span>Повернено</span><b>{x.qty_returned_total}</b></div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {open ? (
        <div className="modalOverlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <h3 style={{ margin: 0 }}>Новий товар</h3>
              <button className="iconBtn" onClick={() => setOpen(false)}>✕</button>
            </div>

            <form onSubmit={onCreate} className="form">
              <label>
                Назва
                <input className="input" value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>

              <label>
                Розмір (text)
                <input className="input" value={form.size}
                  onChange={(e) => setForm({ ...form, size: e.target.value })} />
              </label>

              <div className="row2">
                <label>
                  Собівартість
                  <input className="input" inputMode="decimal" value={form.cost}
                    onChange={(e) => setForm({ ...form, cost: e.target.value })} />
                </label>
                <label>
                  Ціна продажу
                  <input className="input" inputMode="decimal" value={form.sale_price}
                    onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
                </label>
              </div>

              <div className="row2">
                <label>
                  В наявності (шт)
                  <input className="input" inputMode="numeric" value={form.qty_in_stock}
                    onChange={(e) => setForm({ ...form, qty_in_stock: e.target.value })} />
                </label>
                <label>
                  В доставці (шт)
                  <input className="input" inputMode="numeric" value={form.qty_in_delivery}
                    onChange={(e) => setForm({ ...form, qty_in_delivery: e.target.value })} />
                </label>
              </div>

              <button className="btn" type="submit">Створити</button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}