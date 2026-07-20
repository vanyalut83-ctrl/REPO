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

function PhotoCarousel({ photos, onAdd, onRemove }) {
  return (
    <div className="photoBox">
      <div className="photoRow">
        {photos.length === 0 ? (
          <button type="button" className="photoAddBig" onClick={onAdd}>
            <div className="photoPlus">＋</div>
            <div className="photoAddText">Додати фото</div>
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

  // photos: [{file, url}]
  const [photos, setPhotos] = useState([]);
  const fileInputRef = useRef(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await listItems();
      setItems(data ?? []);
    } catch (e) {
      setErr(e?.message ?? "Помилка завантаження");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") closeCreate();
    }
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function revokeAllPreviews(prev) {
    for (const p of prev) {
      try {
        URL.revokeObjectURL(p.url);
      } catch {
        // ignore
      }
    }
  }

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
      revokeAllPreviews(prev);
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
    // щоб не лишались objectURL
    resetCreateState();
  }

  // Один input accept=image/* => системний chooser як OLX (камера/фото/файли)
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
      if (item) {
        try {
          URL.revokeObjectURL(item.url);
        } catch {
          // ignore
        }
      }
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

      for (const p of photos) {
        const path = await uploadItemPhoto({ itemId: created.id, file: p.file });
        await appendItemPhotoPath(created.id, path);
      }

      setOpen(false);
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
                        fontWeight: 900,
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
                <div style={{ fontWeight: 950, fontSize: 16, lineHeight: 1.2 }}>
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
                <div style={{ fontWeight: 950 }}>₴ {x.sale_price}</div>
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

      {/* Hidden file chooser (OLX-like) */}
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
                <div className="modalSubtitle">Фото → дані → створити</div>
              </div>

              <button
                className="iconBtn"
                onClick={closeCreate}
                type="button"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modalBody">
              <PhotoCarousel photos={photos} onAdd={pickPhotos} onRemove={removePhoto} />

              <PreviewCard preview={preview} />

              <form id="createItemForm" onSubmit={onCreate} className="form">
                <label>
                  Назва
                  <input
                    className="input"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Напр. Футболка Nike"
                  />
                </label>

                <div className="row2">
                  <label>
                    Розмір
                    <input
                      className="input"
                      value={form.size}
                      onChange={(e) => setForm({ ...form, size: e.target.value })}
                      placeholder="S / M / L / 42..."
                    />
                  </label>

                  <label>
                    SKU (опц.)
                    <input
                      className="input"
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      placeholder="Код/артикул"
                    />
                  </label>
                </div>

                <label>
                  Нотатка (опц.)
                  <input
                    className="input"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Колір/постачальник/коментар"
                  />
                </label>

                <div className="row2">
                  <label>
                    Собівартість (₴/шт)
                    <input
                      className="input"
                      inputMode="decimal"
                      value={form.cost}
                      onChange={(e) => setForm({ ...form, cost: e.target.value })}
                    />
                  </label>

                  <label>
                    Ціна продажу (₴/шт)
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
              </form>
            </div>

            <div className="modalFooter">
              <button
                className="btnSecondary"
                type="button"
                onClick={closeCreate}
                disabled={busyCreate}
              >
                Скасувати
              </button>
              <button
                className="btn"
                form="createItemForm"
                type="submit"
                disabled={busyCreate}
              >
                {busyCreate ? "Зберігаю..." : "Створити"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}