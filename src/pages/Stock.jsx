// src/pages/Stock.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { createItem, listItems } from "../services/items";
import {
  appendItemPhotoPath,
  getPublicPhotoUrl,
  uploadItemPhoto,
} from "../services/photos";

function toNumber(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function toInt(v) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export default function Stock() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(true);
  const [busyCreate, setBusyCreate] = useState(false);
  const [err, setErr] = useState("");

  const [open, setOpen] = useState(false);

  // форма
  const [form, setForm] = useState({
    title: "",
    size: "",
    sku: "",
    note: "",
    cost: "0",
    sale_price: "0",
    qty_in_stock: "0",
    qty_in_delivery: "0",
  });

  // фото: тримаємо і File, і локальний preview url
  const [photos, setPhotos] = useState([]); // [{ file: File, url: string }]
  const fileInputRef = useRef(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await listItems();
      setItems(data);
    } catch (e) {
      setErr(e?.message ?? "Помилка завантаження");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // очищення objectURL, щоб не текла пам'ять
  useEffect(() => {
    return () => {
      for (const p of photos) URL.revokeObjectURL(p.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) =>
      `${x.title ?? ""} ${x.size ?? ""} ${x.sku ?? ""}`
        .toLowerCase()
        .includes(s)
    );
  }, [items, q]);

  function resetCreateState() {
    setForm({
      title: "",
      size: "",
      sku: "",
      note: "",
      cost: "0",
      sale_price: "0",
      qty_in_stock: "0",
      qty_in_delivery: "0",
    });

    // revoke preview urls
    setPhotos((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.url);
      return [];
    });
  }

  function openCreate() {
    setErr("");
    resetCreateState();
    setOpen(true);
  }

  function closeCreate() {
    setOpen(false);
  }

  // OLX-like: один input accept="image/*" => на iPhone/Android з’явиться системний вибір:
  // Камера / Фото / Файли (залежить від пристрою)
  function pickPhotos() {
    fileInputRef.current?.click();
  }

  function onFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    // дозволимо повторно вибирати ті ж файли
    e.target.value = "";

    if (!files.length) return;

    setPhotos((prev) => {
      const next = [...prev];
      for (const f of files) {
        if (!f.type?.startsWith("image/")) continue;
        const url = URL.createObjectURL(f);
        next.push({ file: f, url });
      }
      return next;
    });
  }

  function removePhoto(idx) {
    setPhotos((prev) => {
      const copy = [...prev];
      const item = copy[idx];
      if (item) URL.revokeObjectURL(item.url);
      copy.splice(idx, 1);
      return copy;
    });
  }

  async function onCreate(e) {
    e.preventDefault();
    setErr("");

    const title = form.title.trim();
    if (!title) {
      setErr("Вкажи назву товару");
      return;
    }

    const payload = {
      title,
      size: form.size.trim() || null,
      sku: form.sku.trim() || null,
      note: form.note.trim() || null,

      cost: toNumber(form.cost),
      sale_price: toNumber(form.sale_price),

      qty_in_stock: toInt(form.qty_in_stock),
      qty_in_delivery: toInt(form.qty_in_delivery),
      // qty_delivered_total / qty_returned_total — хай лишаються дефолтні 0 в БД
    };

    setBusyCreate(true);
    try {
      const created = await createItem(payload);

      // upload фото (якщо є)
      for (const p of photos) {
        const path = await uploadItemPhoto({ itemId: created.id, file: p.file });
        await appendItemPhotoPath(created.id, path);
      }

      closeCreate();
      resetCreateState();
      await load();
    } catch (e2) {
      setErr(e2?.message ?? "Помилка створення");
    } finally {
      setBusyCreate(false);
    }
  }

  // превʼю картки (як буде виглядати в списку)
  const preview = useMemo(() => {
    return {
      title: form.title || "Назва товару",
      size: form.size || "-",
      sale_price: toNumber(form.sale_price),
      cost: toNumber(form.cost),
      qty_in_stock: toInt(form.qty_in_stock),
      qty_in_delivery: toInt(form.qty_in_delivery),
      // delivered/returned в превʼю як 0
      qty_delivered_total: 0,
      qty_returned_total: 0,
      previewUrl: photos?.[0]?.url || null,
      photosCount: photos.length,
    };
  }, [form, photos]);

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
        <button className="btn" onClick={openCreate} type="button">
          + Додати товар
        </button>
        <button className="btnSecondary" onClick={load} type="button">
          Оновити
        </button>
      </div>

      {err ? <p style={{ color: "#b42318", marginTop: 10 }}>{err}</p> : null}
      {loading ? <p style={{ marginTop: 10 }}>Завантаження...</p> : null}

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
                <td style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {x.photo_paths?.[0] ? (
                    <img
                      src={getPublicPhotoUrl(x.photo_paths[0])}
                      alt=""
                      style={{
                        width: 42,
                        height: 42,
                        objectFit: "cover",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "#fff",
                        flex: "0 0 auto",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "rgba(15,23,42,.03)",
                        flex: "0 0 auto",
                      }}
                    />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {x.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {x.sku ? `SKU: ${x.sku}` : ""}
                    </div>
                  </div>
                </td>
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
            <div style={{ display: "flex", gap: 12 }}>
              {x.photo_paths?.[0] ? (
                <img
                  src={getPublicPhotoUrl(x.photo_paths[0])}
                  alt=""
                  style={{
                    width: 72,
                    height: 72,
                    objectFit: "cover",
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    background: "#fff",
                    flex: "0 0 auto",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    background: "rgba(15,23,42,.03)",
                    flex: "0 0 auto",
                  }}
                />
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>
                  {x.title}
                </div>
                <div style={{ color: "var(--muted)", marginTop: 4 }}>
                  Розмір: {x.size ?? "-"}
                </div>
                {x.sku ? (
                  <div style={{ color: "var(--muted)" }}>SKU: {x.sku}</div>
                ) : null}
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800 }}>₴ {x.sale_price}</div>
                <div style={{ color: "var(--muted)" }}>собів. ₴ {x.cost}</div>
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

      {/* hidden input: відкриває iOS/Android chooser (як OLX) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onFilesSelected}
        style={{ display: "none" }}
      />

      {/* Modal create */}
      {open ? (
        <div className="modalOverlay" onClick={closeCreate}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Додати товар</h3>
              <button className="iconBtn" onClick={closeCreate} type="button" aria-label="Close">
                ✕
              </button>
            </div>

            {/* PREVIEW (OLX-style card) */}
            <div
              style={{
                marginTop: 12,
                border: "1px solid var(--border)",
                borderRadius: 16,
                background: "var(--panel)",
                boxShadow: "var(--shadow)",
                padding: 12,
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {preview.previewUrl ? (
                  <img
                    src={preview.previewUrl}
                    alt=""
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: 16,
                      objectFit: "cover",
                      border: "1px solid var(--border)",
                      background: "#fff",
                      flex: "0 0 auto",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: 16,
                      border: "1px dashed var(--border)",
                      background: "rgba(15,23,42,.02)",
                      flex: "0 0 auto",
                      display: "grid",
                      placeItems: "center",
                      color: "var(--muted)",
                      fontSize: 12,
                      textAlign: "center",
                      padding: 8,
                    }}
                  >
                    Нема фото
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {preview.title}
                  </div>
                  <div style={{ color: "var(--muted)", marginTop: 4 }}>Розмір: {preview.size}</div>
                  <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800 }}>₴ {preview.sale_price}</div>
                    <div style={{ color: "var(--muted)" }}>собів. ₴ {preview.cost}</div>
                    <div style={{ color: "var(--muted)" }}>
                      фото: {preview.photosCount}
                    </div>
                  </div>
                </div>
              </div>

              <div className="miniGrid" style={{ marginTop: 12 }}>
                <div><span>В наявності</span><b>{preview.qty_in_stock}</b></div>
                <div><span>В доставці</span><b>{preview.qty_in_delivery}</b></div>
                <div><span>Отримано</span><b>{preview.qty_delivered_total}</b></div>
                <div><span>Повернено</span><b>{preview.qty_returned_total}</b></div>
              </div>
            </div>

            <form onSubmit={onCreate} className="form" style={{ marginTop: 12 }}>
              <label>
                Назва
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>

              <div className="row2">
                <label>
                  Розмір (text)
                  <input
                    className="input"
                    value={form.size}
                    onChange={(e) => setForm({ ...form, size: e.target.value })}
                  />
                </label>

                <label>
                  SKU (опц.)
                  <input
                    className="input"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                </label>
              </div>

              <label>
                Нотатка (опц.)
                <input
                  className="input"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </label>

              <div className="row2">
                <label>
                  Собівартість (за 1 шт)
                  <input
                    className="input"
                    inputMode="decimal"
                    value={form.cost}
                    onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  />
                </label>

                <label>
                  Ціна продажу (за 1 шт)
                  <input
                    className="input"
                    inputMode="decimal"
                    value={form.sale_price}
                    onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                  />
                </label>
              </div>

              <div className="row2">
                <label>
                  В наявності (шт)
                  <input
                    className="input"
                    inputMode="numeric"
                    value={form.qty_in_stock}
                    onChange={(e) => setForm({ ...form, qty_in_stock: e.target.value })}
                  />
                </label>

                <label>
                  В доставці (шт)
                  <input
                    className="input"
                    inputMode="numeric"
                    value={form.qty_in_delivery}
                    onChange={(e) => setForm({ ...form, qty_in_delivery: e.target.value })}
                  />
                </label>
              </div>

              {/* Фото: OLX-like chooser */}
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="btnSecondary" type="button" onClick={pickPhotos}>
                    Додати фото
                  </button>
                  <div style={{ alignSelf: "center", color: "var(--muted)", fontSize: 13 }}>
                    На iPhone/Android з’явиться системний вибір (камера/галерея)
                  </div>
                </div>

                {photos.length ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {photos.map((p, idx) => (
                      <div key={p.url} style={{ position: "relative" }}>
                        <img
                          src={p.url}
                          alt=""
                          style={{
                            width: "100%",
                            aspectRatio: "1 / 1",
                            objectFit: "cover",
                            borderRadius: 14,
                            border: "1px solid var(--border)",
                            background: "#fff",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          title="Видалити"
                          style={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            border: "1px solid var(--border)",
                            background: "rgba(255,255,255,.9)",
                            borderRadius: 10,
                            padding: "4px 8px",
                            cursor: "pointer",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button className="btnSecondary" type="button" onClick={closeCreate} disabled={busyCreate}>
                  Скасувати
                </button>
                <button className="btn" type="submit" disabled={busyCreate}>
                  {busyCreate ? "Зберігаю..." : "Створити"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}