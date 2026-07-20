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

function PhotoCarousel({
  photos,
  onAdd,
  onRemove,
  emptyText = "Додати фото",
}) {
  return (
    <div className="photoBox">
      <div className="photoRow">
        {photos.length === 0 ? (
          <button type="button" className="photoAddBig" onClick={onAdd}>
            <div className="photoPlus">＋</div>
            <div className="photoAddText">{emptyText}</div>
            <div className="photoSubText">
              iPhone/Android запропонує варіанти (камера/фото/файли)
            </div>
          </button>
        ) : (
          <>
            {photos.map((p, idx) => (
              <div className="photoSlide" key={p.url}>
                <img className="photoImg" src={p.url} alt="" />
                <button
                  type="button"
                  className="photoRemove"
                  onClick={() => onRemove(idx)}
                  aria-label="Remove photo"
                  title="Видалити"
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Плитка "Додати" після останнього фото */}
            <button type="button" className="photoAddSmall" onClick={onAdd}>
              <div className="photoPlus">＋</div>
              <div className="photoAddText">Додати</div>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PreviewCard({ preview }) {
  return (
    <div className="previewCard">
      <div className="previewTop">
        <div className="previewTitle">{preview.title}</div>
        <div className="previewMeta">
          <span>Розмір: {preview.size}</span>
          {preview.sku ? <span>SKU: {preview.sku}</span> : null}
        </div>

        <div className="previewPriceRow">
          <div className="pill">
            <span>Ціна</span>
            <b>₴ {preview.sale_price}</b>
          </div>
          <div className="pill">
            <span>Собів.</span>
            <b>₴ {preview.cost}</b>
          </div>
          <div className="pill">
            <span>Фото</span>
            <b>{preview.photosCount}</b>
          </div>
        </div>
      </div>

      <div className="previewGrid">
        <div>
          <span>В наявності</span>
          <b>{preview.qty_in_stock}</b>
        </div>
        <div>
          <span>В доставці</span>
          <b>{preview.qty_in_delivery}</b>
        </div>
        <div>
          <span>Отримано</span>
          <b>{preview.qty_delivered_total}</b>
        </div>
        <div>
          <span>Повернено</span>
          <b>{preview.qty_returned_total}</b>
        </div>
      </div>

      {preview.note ? <div className="previewNote">{preview.note}</div> : null}
    </div>
  );
}

export default function Stock() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(true);
  const [busyCreate, setBusyCreate] = useState(false);
  const [err, setErr] = useState("");

  const [open, setOpen] = useState(false);

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

  // Фото: [{file, url}]
  const [photos, setPhotos] = useState([]);
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

  // close modal by Esc
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

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

  // ВАЖЛИВО: один input accept=image/* -> iOS/Android покаже системний chooser (як OLX)
  function pickPhotos() {
    fileInputRef.current?.click();
  }

  function onFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // дозволяє вибрати ті ж файли повторно
    if (!files.length) return;

    setPhotos((prev) => {
      const next = [...prev];
      for (const f of files) {
        if (!f.type?.startsWith("image/")) continue;
        next.push({ file: f, url: URL.createObjectURL(f) });
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

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) =>
      `${x.title ?? ""} ${x.size ?? ""} ${x.sku ?? ""}`
        .toLowerCase()
        .includes(s)
    );
  }, [items, q]);

  const preview = useMemo(() => {
    return {
      title: form.title.trim() || "Назва товару",
      size: (form.size ?? "").trim() || "-",
      sku: (form.sku ?? "").trim() || "",
      note: (form.note ?? "").trim() || "",
      sale_price: toNumber(form.sale_price),
      cost: toNumber(form.cost),
      qty_in_stock: toInt(form.qty_in_stock),
      qty_in_delivery: toInt(form.qty_in_delivery),
      qty_delivered_total: 0,
      qty_returned_total: 0,
      photosCount: photos.length,
    };
  }, [form, photos]);

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
    };

    setBusyCreate(true);
    try {
      const created = await createItem(payload);

      // upload photos
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

  return (
    <section>
      <div className="stockTop">
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

      {err ? <div className="errorBox">{err}</div> : null}
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
                    <div
                      style={{
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
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
                    width: 76,
                    height: 76,
                    objectFit: "cover",
                    borderRadius: 16,
                    border: "1px solid var(--border)",
                    background: "#fff",
                    flex: "0 0 auto",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 16,
                    border: "1px solid var(--border)",
                    background: "rgba(15,23,42,.03)",
                    flex: "0 0 auto",
                  }}
                />
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.2 }}>
                  {x.title}
                </div>
                <div style={{ color: "var(--muted)", marginTop: 4 }}>
                  Розмір: {x.size ?? "-"}
                </div>
                {x.sku ? <div style={{ color: "var(--muted)" }}>SKU: {x.sku}</div> : null}
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 900 }}>₴ {x.sale_price}</div>
                <div style={{ color: "var(--muted)" }}>собів. ₴ {x.cost}</div>
              </div>
            </div>

            <div className="miniGrid">
              <div>
                <span>В наявності</span>
                <b>{x.qty_in_stock}</b>
              </div>
              <div>
                <span>В доставці</span>
                <b>{x.qty_in_delivery}</b>
              </div>
              <div>
                <span>Отримано</span>
                <b>{x.qty_delivered_total}</b>
              </div>
              <div>
                <span>Повернено</span>
                <b>{x.qty_returned_total}</b>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hidden chooser */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onFilesSelected}
        style={{ display: "none" }}
      />

      {/* Create modal */}
      {open ? (
        <div className="modalOverlay" onClick={closeCreate}>
          <div className="modal modern" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <div className="modalTitle">Новий товар</div>
                <div className="modalSubtitle">
                  Спочатку додай фото (за бажанням), потім заповни дані — превʼю оновлюється одразу.
                </div>
              </div>

              <button className="iconBtn" onClick={closeCreate} type="button" aria-label="Close">
                ✕
              </button>
            </div>

            {/* TOP PHOTO BLOCK (OLX-like) */}
            <PhotoCarousel photos={photos} onAdd={pickPhotos} onRemove={removePhoto} />

            {/* PREVIEW */}
            <PreviewCard preview={preview} />

            {/* FORM */}
            <form onSubmit={onCreate} className="form">
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

              <div className="modalActions">
                <button className="btnSecondary" type="button" onClick={closeCreate} disabled={busyCreate}>
                  Скасувати
                </button>
                <button className="btn" type="submit" disabled={busyCreate}>
                  {busyCreate ? "Зберігаю..." : "Створити"}
                </button>
              </div>

              <div className="hint">
                Якщо бачиш помилку про відсутню колонку (наприклад <code>qty_in_stock</code>) — значить в Supabase таблиці
                інші назви полів. Тоді або перейменуємо колонки, або адаптуємо код під твою схему.
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/*
Потрібні CSS-класи (додай в index.css якщо ще нема):
- stockTop, errorBox
- photoBox, photoRow, photoSlide, photoImg, photoAddBig, photoAddSmall, photoPlus, photoAddText, photoSubText, photoRemove
- previewCard, previewTop, previewTitle, previewMeta, previewPriceRow, pill, previewGrid, previewNote
- modal modern: modalHeader, modalTitle, modalSubtitle, modalActions, hint
*/