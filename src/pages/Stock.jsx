// src/pages/Stock.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../services/supabase";
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
function uid() {
  return (
    crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}
function extFromName(name = "") {
  const p = name.split(".");
  return (p.length > 1 ? p.pop() : "jpg").toLowerCase();
}
function normalizeItemPhotoPath(itemId, p) {
  if (!p) return null;
  const s = String(p);
  if (s.includes("/")) return s;
  // якщо в БД лежить тільки ім'я файла — підставимо itemId/
  return `${itemId}/${s}`;
}

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modal modern" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Segmented({ value, onChange }) {
  return (
    <div className="seg">
      <button
        type="button"
        className={`segBtn ${value === "stock" ? "active" : ""}`}
        onClick={() => onChange("stock")}
      >
        Склад
      </button>
      <button
        type="button"
        className={`segBtn ${value === "ship" ? "active" : ""}`}
        onClick={() => onChange("ship")}
      >
        Відправлення
      </button>
    </div>
  );
}

function PhotoBoxSquare({ urls }) {
  // квадратний медіа-блок як на прикладі, фото "вписується" в блок
  return (
    <div className="pMedia">
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

function ProductCard({ item, onOpen, onShip }) {
  const urls = (item.photo_paths ?? [])
    .map((p) => normalizeItemPhotoPath(item.id, p))
    .filter(Boolean)
    .map(getPublicPhotoUrl);

  const qty = item.qty_in_stock ?? 0;
  const low = qty > 0 && qty <= 2;
  const out = qty === 0;

  const price = Number(item.sale_price ?? 0);
  const cost = Number(item.cost ?? 0);
  const margin =
    price > 0 ? Math.max(0, Math.round(((price - cost) / price) * 100)) : 0;

  // "Одяг" як в прикладі: без нового поля беремо коротку note як тег
  const tag =
    item.note && String(item.note).trim().length <= 12
      ? String(item.note).trim()
      : "Товар";

  return (
    <div className="pCard">
      <div className="pBadges">
        <div className="pBadge left">{tag}</div>
        {out ? (
          <div className="pBadge right danger">Нема</div>
        ) : low ? (
          <div className="pBadge right warn">Мало</div>
        ) : null}
      </div>

      <PhotoBoxSquare urls={urls} />

      <div className="pBody">
        <div className="pTitle">{item.title}</div>
        <div className="pSub">
          {item.sku ? `SKU-${item.sku}` : item.size ? `Розмір: ${item.size}` : "—"}
        </div>

        <div className="pInfoRow">
          <div className="pInfo">
            <div className="pInfoLabel">Ціна продажу</div>
            <div className="pInfoValue">₴ {item.sale_price ?? 0}</div>
          </div>

          <div className="pInfo success">
            <div className="pInfoLabel">Маржа</div>
            <div className="pInfoValue">{margin}%</div>
          </div>
        </div>

        <div className="pFooter">
          <div className="pStockPill">
            <span className="dot" />
            <span>{qty} шт</span>
          </div>

          <div className="pActions">
            <button type="button" className="iconAction" onClick={onOpen} title="Відкрити / редагувати">
              ✎
            </button>
            <button
              type="button"
              className="iconAction primary"
              onClick={onShip}
              title="Відправити"
              disabled={qty <= 0}
            >
              ⤴
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddPhotoCarousel({ photos, onAdd, onRemove }) {
  return (
    <div className="photoBox">
      <div className="photoRow">
        {photos.length === 0 ? (
          <button type="button" className="photoAddBig" onClick={onAdd}>
            <div className="photoPlus">＋</div>
            <div className="photoAddText">Додати фото</div>
            <div className="photoSubText">Системний вибір: камера / фото / файли</div>
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

export default function Stock() {
  const [tab, setTab] = useState("stock"); // stock | ship
  const [items, setItems] = useState([]);
  const [shipments, setShipments] = useState([]);

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // create item modal
  const [createOpen, setCreateOpen] = useState(false);
  const [busyCreate, setBusyCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    size: "",
    sku: "",
    note: "", // коротка note може бути "тегом" як на прикладі
    cost: "0",
    sale_price: "0",
    qty_in_stock: "0",
    qty_in_delivery: "0",
  });
  const [createPhotos, setCreatePhotos] = useState([]); // [{file,url}]
  const createInputRef = useRef(null);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [busyEdit, setBusyEdit] = useState(false);
  const [activeItem, setActiveItem] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    size: "",
    sku: "",
    note: "",
    cost: "0",
    sale_price: "0",
  });
  const [editNewPhotos, setEditNewPhotos] = useState([]); // new photos only
  const editInputRef = useRef(null);

  // ship modal
  const [shipOpen, setShipOpen] = useState(false);
  const [busyShip, setBusyShip] = useState(false);
  const [shipItem, setShipItem] = useState(null);
  const [shipForm, setShipForm] = useState({
    full_name: "",
    phone: "",
    city: "",
    branch: "",
    qty: "1",
  });
  const [shipPhotos, setShipPhotos] = useState([]); // [{file,url}]
  const shipInputRef = useRef(null);

  function revokePreviews(arr) {
    for (const p of arr) {
      try {
        URL.revokeObjectURL(p.url);
      } catch {}
    }
  }

  async function loadStock() {
    setLoading(true);
    setErr("");
    try {
      const data = await listItems();
      setItems(data ?? []);
    } catch (e) {
      setErr(e?.message ?? "Помилка завантаження складу");
    } finally {
      setLoading(false);
    }
  }

  async function loadShipments() {
    setErr("");
    try {
      const { data, error } = await db
        .from("item_events")
        .select("id, type, qty, created_at, meta, items(id, title, size, sku, photo_paths)")
        .eq("type", "ship")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setShipments(data ?? []);
    } catch (e) {
      setErr(e?.message ?? "Помилка завантаження відправлень");
    }
  }

  useEffect(() => {
    loadStock();
  }, []);

  useEffect(() => {
    if (tab === "ship") loadShipments();
  }, [tab]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setCreateOpen(false);
        setEditOpen(false);
        setShipOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // chooser helpers
  function onFilesSelected(setter) {
    return (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      if (!files.length) return;

      setter((prev) => [
        ...prev,
        ...files
          .filter((f) => f.type?.startsWith("image/"))
          .map((f) => ({ file: f, url: URL.createObjectURL(f) })),
      ]);
    };
  }
  function removePhoto(setter) {
    return (idx) => {
      setter((prev) => {
        const copy = [...prev];
        const item = copy[idx];
        if (item) URL.revokeObjectURL(item.url);
        copy.splice(idx, 1);
        return copy;
      });
    };
  }

  const filteredItems = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) =>
      `${x.title ?? ""} ${x.size ?? ""} ${x.sku ?? ""}`.toLowerCase().includes(s)
    );
  }, [items, q]);

  const filteredShipments = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return shipments;
    return shipments.filter((x) => {
      const it = x.items;
      const meta = x.meta || {};
      return `${it?.title ?? ""} ${it?.size ?? ""} ${it?.sku ?? ""} ${meta.full_name ?? ""} ${meta.phone ?? ""} ${meta.city ?? ""}`
        .toLowerCase()
        .includes(s);
    });
  }, [shipments, q]);

  function openCreate() {
    setErr("");
    setCreateForm({
      title: "",
      size: "",
      sku: "",
      note: "",
      cost: "0",
      sale_price: "0",
      qty_in_stock: "0",
      qty_in_delivery: "0",
    });
    setCreatePhotos((prev) => {
      revokePreviews(prev);
      return [];
    });
    setCreateOpen(true);
  }
  function closeCreate() {
    setCreateOpen(false);
    setCreatePhotos((prev) => {
      revokePreviews(prev);
      return [];
    });
  }

  function openEdit(item) {
    setErr("");
    setActiveItem(item);
    setEditForm({
      title: item.title ?? "",
      size: item.size ?? "",
      sku: item.sku ?? "",
      note: item.note ?? "",
      cost: String(item.cost ?? 0),
      sale_price: String(item.sale_price ?? 0),
    });
    setEditNewPhotos((prev) => {
      revokePreviews(prev);
      return [];
    });
    setEditOpen(true);
  }
  function closeEdit() {
    setEditOpen(false);
    setActiveItem(null);
    setEditNewPhotos((prev) => {
      revokePreviews(prev);
      return [];
    });
  }

  function openShip(item) {
    setErr("");
    setShipItem(item);
    setShipForm({
      full_name: "",
      phone: "",
      city: "",
      branch: "",
      qty: "1",
    });
    setShipPhotos((prev) => {
      revokePreviews(prev);
      return [];
    });
    setShipOpen(true);
  }
  function closeShip() {
    setShipOpen(false);
    setShipItem(null);
    setShipPhotos((prev) => {
      revokePreviews(prev);
      return [];
    });
  }

  async function onCreateSubmit(e) {
    e.preventDefault();
    setErr("");

    const title = createForm.title.trim();
    if (!title) return setErr("Вкажи назву товару");

    const payload = {
      title,
      size: createForm.size.trim() || null,
      sku: createForm.sku.trim() || null,
      note: createForm.note.trim() || null,
      cost: toNumber(createForm.cost),
      sale_price: toNumber(createForm.sale_price),
      qty_in_stock: toInt(createForm.qty_in_stock),
      qty_in_delivery: toInt(createForm.qty_in_delivery),
    };

    setBusyCreate(true);
    try {
      const created = await createItem(payload);

      for (const p of createPhotos) {
        const path = await uploadItemPhoto({ itemId: created.id, file: p.file });
        await appendItemPhotoPath(created.id, path);
      }

      setCreateOpen(false);
      setCreatePhotos((prev) => {
        revokePreviews(prev);
        return [];
      });
      await loadStock();
    } catch (e2) {
      setErr(e2?.message ?? "Помилка створення");
    } finally {
      setBusyCreate(false);
    }
  }

  async function onEditSave() {
    if (!activeItem) return;
    setErr("");

    const title = editForm.title.trim();
    if (!title) return setErr("Вкажи назву товару");

    const patch = {
      title,
      size: editForm.size.trim() || null,
      sku: editForm.sku.trim() || null,
      note: editForm.note.trim() || null,
      cost: toNumber(editForm.cost),
      sale_price: toNumber(editForm.sale_price),
    };

    setBusyEdit(true);
    try {
      const { error } = await db.from("items").update(patch).eq("id", activeItem.id);
      if (error) throw error;

      for (const p of editNewPhotos) {
        const path = await uploadItemPhoto({ itemId: activeItem.id, file: p.file });
        await appendItemPhotoPath(activeItem.id, path);
      }

      closeEdit();
      await loadStock();
    } catch (e) {
      setErr(e?.message ?? "Помилка збереження");
    } finally {
      setBusyEdit(false);
    }
  }

  async function uploadShipmentPhoto(eventId, file) {
    const path = `shipments/${eventId}/${uid()}.${extFromName(file.name)}`;
    const { error } = await db.storage.from("item-photos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    return path;
  }

  async function shipSubmit(e) {
    e.preventDefault();
    if (!shipItem) return;

    setErr("");

    const qty = toInt(shipForm.qty);
    if (qty <= 0) return setErr("Кількість має бути > 0");
    if (qty > (shipItem.qty_in_stock ?? 0)) return setErr("Недостатньо товару на складі");

    const full_name = shipForm.full_name.trim();
    const phone = shipForm.phone.trim();
    const city = shipForm.city.trim();
    const branch = shipForm.branch.trim();
    if (!full_name || !phone || !city || !branch) {
      return setErr("Заповни ПІБ, телефон, місто і відділення");
    }

    setBusyShip(true);
    try {
      const { data: eventId, error: rpcErr } = await db.rpc("ship_item", {
        p_item_id: shipItem.id,
        p_qty: qty,
        p_full_name: full_name,
        p_phone: phone,
        p_city: city,
        p_branch: branch,
      });
      if (rpcErr) throw rpcErr;

      const uploaded = [];
      for (const p of shipPhotos) {
        const path = await uploadShipmentPhoto(eventId, p.file);
        uploaded.push(path);
      }

      if (uploaded.length) {
        const { data: row, error: e1 } = await db
          .from("item_events")
          .select("meta")
          .eq("id", eventId)
          .single();
        if (e1) throw e1;

        const meta = row?.meta ?? {};
        const nextMeta = { ...meta, photo_paths: uploaded };

        const { error: e2 } = await db.from("item_events").update({ meta: nextMeta }).eq("id", eventId);
        if (e2) throw e2;
      }

      closeShip();
      await loadStock();
      if (tab === "ship") await loadShipments();
    } catch (e2) {
      setErr(e2?.message ?? "Помилка відправлення");
    } finally {
      setBusyShip(false);
    }
  }

  return (
    <section>
      <div className="stockTop">
        <Segmented value={tab} onChange={setTab} />

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tab === "stock" ? "Пошук товарів..." : "Пошук відправлень..."}
          className="input"
          style={{ flex: "1 1 260px" }}
        />

        {tab === "stock" ? (
          <button className="btnSecondary" onClick={loadStock} type="button">
            Оновити
          </button>
        ) : (
          <button className="btnSecondary" onClick={loadShipments} type="button">
            Оновити
          </button>
        )}
      </div>

      {err ? <div className="errorBox">{err}</div> : null}
      {loading ? <p style={{ marginTop: 10 }}>Завантаження...</p> : null}

      {tab === "stock" ? (
        <>
          <div className="premiumGrid">
            {filteredItems.map((x) => (
              <ProductCard
                key={x.id}
                item={x}
                onOpen={() => openEdit(x)}
                onShip={() => openShip(x)}
              />
            ))}
          </div>

          {/* ДОДАТИ — вниз по центру */}
          <button className="fabAdd" type="button" onClick={openCreate} aria-label="Add item">
            + Додати
          </button>
          <div style={{ height: 84 }} />
        </>
      ) : null}

      {tab === "ship" ? (
        <div className="shipGrid">
          {filteredShipments.map((ev) => {
            const it = ev.items;
            const meta = ev.meta || {};
            const shipPhotoUrls = (meta.photo_paths ?? []).map(getPublicPhotoUrl);

            return (
              <div className="shipCard" key={ev.id}>
                <div className="shipCardTop">
                  <div className="shipTitle">
                    {it?.title ?? "Товар"} {it?.size ? `• ${it.size}` : ""}
                  </div>
                  <div className="shipQty">К-сть: {ev.qty}</div>
                </div>

                <div className="shipMeta">
                  <div><b>ПІБ:</b> {meta.full_name}</div>
                  <div><b>Тел:</b> {meta.phone}</div>
                  <div><b>Місто:</b> {meta.city}</div>
                  <div><b>Відділення:</b> {meta.branch}</div>
                </div>

                {shipPhotoUrls.length ? (
                  <div className="shipPhotos">
                    <div className="shipPhotosRow">
                      {shipPhotoUrls.map((u) => (
                        <div className="shipPhoto" key={u}>
                          <img src={u} alt="" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="shipTime">{new Date(ev.created_at).toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* hidden choosers */}
      <input
        ref={createInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onFilesSelected(setCreatePhotos)}
        style={{ display: "none" }}
      />
      <input
        ref={editInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onFilesSelected(setEditNewPhotos)}
        style={{ display: "none" }}
      />
      <input
        ref={shipInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onFilesSelected(setShipPhotos)}
        style={{ display: "none" }}
      />

      {/* CREATE MODAL */}
      <Modal open={createOpen} onClose={closeCreate}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">Додати товар</div>
            <div className="modalSubtitle">Фото → дані → створити</div>
          </div>
          <button className="iconBtn" onClick={closeCreate} type="button">✕</button>
        </div>

        <div className="modalBody">
          <AddPhotoCarousel
            photos={createPhotos}
            onAdd={() => createInputRef.current?.click()}
            onRemove={removePhoto(setCreatePhotos)}
          />

          <form id="createForm" onSubmit={onCreateSubmit} className="form">
            <label>
              Назва
              <input
                className="input"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              />
            </label>

            <div className="row2">
              <label>
                Розмір
                <input
                  className="input"
                  value={createForm.size}
                  onChange={(e) => setCreateForm({ ...createForm, size: e.target.value })}
                />
              </label>

              <label>
                SKU
                <input
                  className="input"
                  value={createForm.sku}
                  onChange={(e) => setCreateForm({ ...createForm, sku: e.target.value })}
                />
              </label>
            </div>

            <label>
              Тег (короткий) / Нотатка
              <input
                className="input"
                value={createForm.note}
                onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })}
                placeholder="Напр. Одяг"
              />
            </label>

            <div className="row2">
              <label>
                Собівартість
                <input
                  className="input"
                  inputMode="decimal"
                  value={createForm.cost}
                  onChange={(e) => setCreateForm({ ...createForm, cost: e.target.value })}
                />
              </label>

              <label>
                Ціна продажу
                <input
                  className="input"
                  inputMode="decimal"
                  value={createForm.sale_price}
                  onChange={(e) => setCreateForm({ ...createForm, sale_price: e.target.value })}
                />
              </label>
            </div>

            <div className="row2">
              <label>
                В наявності
                <input
                  className="input"
                  inputMode="numeric"
                  value={createForm.qty_in_stock}
                  onChange={(e) => setCreateForm({ ...createForm, qty_in_stock: e.target.value })}
                />
              </label>

              <label>
                В доставці
                <input
                  className="input"
                  inputMode="numeric"
                  value={createForm.qty_in_delivery}
                  onChange={(e) => setCreateForm({ ...createForm, qty_in_delivery: e.target.value })}
                />
              </label>
            </div>
          </form>
        </div>

        <div className="modalFooter">
          <button className="btnSecondary" type="button" onClick={closeCreate} disabled={busyCreate}>
            Скасувати
          </button>
          <button className="btn" form="createForm" type="submit" disabled={busyCreate}>
            {busyCreate ? "Зберігаю..." : "Створити"}
          </button>
        </div>
      </Modal>

      {/* EDIT MODAL */}
      <Modal open={editOpen} onClose={closeEdit}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">Картка товару</div>
            <div className="modalSubtitle">Редагування</div>
          </div>
          <button className="iconBtn" onClick={closeEdit} type="button">✕</button>
        </div>

        <div className="modalBody">
          {activeItem ? (
            <>
              <div className="photoBox" style={{ marginBottom: 10 }}>
                <div className="photoRow">
                  {(activeItem.photo_paths ?? []).length ? (
                    (activeItem.photo_paths ?? []).map((p) => {
                      const norm = normalizeItemPhotoPath(activeItem.id, p);
                      return (
                        <div className="photoSlide" key={p}>
                          <img className="photoImg" src={getPublicPhotoUrl(norm)} alt="" />
                        </div>
                      );
                    })
                  ) : (
                    <div className="photoAddBig" style={{ width: "100%" }}>
                      <div className="photoSubText">Нема фото</div>
                    </div>
                  )}

                  <button type="button" className="photoAddSmall" onClick={() => editInputRef.current?.click()}>
                    <div className="photoPlus">＋</div>
                    <div className="photoAddText">Додати</div>
                  </button>
                </div>
              </div>

              {editNewPhotos.length ? (
                <AddPhotoCarousel
                  photos={editNewPhotos}
                  onAdd={() => editInputRef.current?.click()}
                  onRemove={removePhoto(setEditNewPhotos)}
                />
              ) : null}

              <form className="form" id="editForm" onSubmit={(e) => e.preventDefault()}>
                <label>
                  Назва
                  <input
                    className="input"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  />
                </label>

                <div className="row2">
                  <label>
                    Розмір
                    <input
                      className="input"
                      value={editForm.size}
                      onChange={(e) => setEditForm({ ...editForm, size: e.target.value })}
                    />
                  </label>

                  <label>
                    SKU
                    <input
                      className="input"
                      value={editForm.sku}
                      onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                    />
                  </label>
                </div>

                <label>
                  Тег/Нотатка
                  <input
                    className="input"
                    value={editForm.note}
                    onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  />
                </label>

                <div className="row2">
                  <label>
                    Собівартість
                    <input
                      className="input"
                      inputMode="decimal"
                      value={editForm.cost}
                      onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })}
                    />
                  </label>

                  <label>
                    Ціна продажу
                    <input
                      className="input"
                      inputMode="decimal"
                      value={editForm.sale_price}
                      onChange={(e) => setEditForm({ ...editForm, sale_price: e.target.value })}
                    />
                  </label>
                </div>
              </form>
            </>
          ) : null}
        </div>

        <div className="modalFooter">
          <button className="btnSecondary" type="button" onClick={closeEdit} disabled={busyEdit}>
            Закрити
          </button>
          {activeItem ? (
            <>
              <button className="btnSecondary" type="button" onClick={() => openShip(activeItem)} disabled={busyEdit}>
                Відправити
              </button>
              <button className="btn" type="button" onClick={onEditSave} disabled={busyEdit}>
                {busyEdit ? "Зберігаю..." : "Зберегти"}
              </button>
            </>
          ) : null}
        </div>
      </Modal>

      {/* SHIP MODAL */}
      <Modal open={shipOpen} onClose={closeShip}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">Відправити</div>
            <div className="modalSubtitle">
              {shipItem ? `${shipItem.title}${shipItem.size ? ` • ${shipItem.size}` : ""}` : ""}
            </div>
          </div>
          <button className="iconBtn" onClick={closeShip} type="button">✕</button>
        </div>

        <div className="modalBody">
          {shipItem ? (
            <>
              <AddPhotoCarousel
                photos={shipPhotos}
                onAdd={() => shipInputRef.current?.click()}
                onRemove={removePhoto(setShipPhotos)}
              />

              <form id="shipForm" onSubmit={shipSubmit} className="form">
                <div className="row2">
                  <label>
                    ПІБ
                    <input
                      className="input"
                      value={shipForm.full_name}
                      onChange={(e) => setShipForm({ ...shipForm, full_name: e.target.value })}
                    />
                  </label>

                  <label>
                    Телефон
                    <input
                      className="input"
                      inputMode="tel"
                      value={shipForm.phone}
                      onChange={(e) => setShipForm({ ...shipForm, phone: e.target.value })}
                    />
                  </label>
                </div>

                <div className="row2">
                  <label>
                    Місто
                    <input
                      className="input"
                      value={shipForm.city}
                      onChange={(e) => setShipForm({ ...shipForm, city: e.target.value })}
                    />
                  </label>

                  <label>
                    № відділення
                    <input
                      className="input"
                      value={shipForm.branch}
                      onChange={(e) => setShipForm({ ...shipForm, branch: e.target.value })}
                    />
                  </label>
                </div>

                <label>
                  Кількість
                  <input
                    className="input"
                    inputMode="numeric"
                    value={shipForm.qty}
                    onChange={(e) => setShipForm({ ...shipForm, qty: e.target.value })}
                  />
                </label>
              </form>
            </>
          ) : null}
        </div>

        <div className="modalFooter">
          <button className="btnSecondary" type="button" onClick={closeShip} disabled={busyShip}>
            Скасувати
          </button>
          <button className="btn" form="shipForm" type="submit" disabled={busyShip}>
            {busyShip ? "Відправляю..." : "Відправити"}
          </button>
        </div>
      </Modal>
    </section>
  );
}