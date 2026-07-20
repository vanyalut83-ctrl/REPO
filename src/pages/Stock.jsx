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
  return crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function extFromName(name = "") {
  const p = name.split(".");
  return (p.length > 1 ? p.pop() : "jpg").toLowerCase();
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

function PhotoStrip({ urls = [] }) {
  // великий блок фото, “від краю до краю” картки, свайп/гортання
  return (
    <div className="cardMedia">
      <div className="cardMediaRow">
        {urls.length ? (
          urls.map((u) => (
            <div className="cardMediaSlide" key={u}>
              <img className="cardMediaImg" src={u} alt="" />
            </div>
          ))
        ) : (
          <div className="cardMediaEmpty">Нема фото</div>
        )}
      </div>
    </div>
  );
}

function AddPhotoCarousel({ photos, onAdd, onRemove }) {
  // для модалок: додаємо фото, є плитка +Додати після останнього
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
    note: "",
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
      } catch {
        // ignore
      }
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
        .select(
          "id, type, qty, created_at, meta, items(id, title, size, sku, photo_paths)"
        )
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

  // ---------- picker helpers (system chooser like OLX) ----------
  function pickCreatePhotos() {
    createInputRef.current?.click();
  }
  function pickEditPhotos() {
    editInputRef.current?.click();
  }
  function pickShipPhotos() {
    shipInputRef.current?.click();
  }

  function onFilesSelected(setter) {
    return (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      if (!files.length) return;

      setter((prev) => {
        const next = [...prev];
        for (const f of files) {
          if (!f.type?.startsWith("image/")) continue;
          next.push({ file: f, url: URL.createObjectURL(f) });
        }
        return next;
      });
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

  // ---------- filters ----------
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

  // ---------- open/close modals ----------
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

  // ---------- actions ----------
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

      // add new photos (append)
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
    // використовуємо той самий bucket (item-photos)
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
      // 1) атомарно: -stock, +delivery, +event(ship)
      const { data: eventId, error: rpcErr } = await db.rpc("ship_item", {
        p_item_id: shipItem.id,
        p_qty: qty,
        p_full_name: full_name,
        p_phone: phone,
        p_city: city,
        p_branch: branch,
      });
      if (rpcErr) throw rpcErr;

      // 2) upload фото до відправлення (не атомарно, але практично)
      const uploaded = [];
      for (const p of shipPhotos) {
        const path = await uploadShipmentPhoto(eventId, p.file);
        uploaded.push(path);
      }

      // 3) дописати photo_paths в meta
      if (uploaded.length) {
        const { data: row, error: e1 } = await db
          .from("item_events")
          .select("meta")
          .eq("id", eventId)
          .single();
        if (e1) throw e1;

        const meta = row?.meta ?? {};
        const nextMeta = { ...meta, photo_paths: uploaded };

        const { error: e2 } = await db
          .from("item_events")
          .update({ meta: nextMeta })
          .eq("id", eventId);
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

  // ---------- UI ----------
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
          <>
            <button className="btn" onClick={openCreate} type="button">
              + Додати товар
            </button>
            <button className="btnSecondary" onClick={loadStock} type="button">
              Оновити
            </button>
          </>
        ) : (
          <button className="btnSecondary" onClick={loadShipments} type="button">
            Оновити
          </button>
        )}
      </div>

      {err ? <div className="errorBox">{err}</div> : null}
      {loading ? <p style={{ marginTop: 10 }}>Завантаження...</p> : null}

      {/* ---------- STOCK TAB ---------- */}
      {tab === "stock" ? (
        <div className="stockGrid">
          {filteredItems.map((x) => {
            const urls = (x.photo_paths ?? []).slice(0, 10).map(getPublicPhotoUrl);
            return (
              <div className="stockCard" key={x.id}>
                <PhotoStrip urls={urls} />

                <div className="stockCardBody">
                  <div className="stockCardTitleRow">
                    <div className="stockCardTitle">{x.title}</div>
                    <div className="stockCardPrice">₴ {x.sale_price}</div>
                  </div>

                  <div className="stockCardMeta">
                    <span>Розмір: {x.size ?? "-"}</span>
                    {x.sku ? <span>SKU: {x.sku}</span> : null}
                  </div>

                  <div className="stockCardStats">
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

                  <div className="stockCardActions">
                    <button className="btnSecondary" type="button" onClick={() => openEdit(x)}>
                      Відкрити
                    </button>
                    <button className="btn" type="button" onClick={() => openShip(x)}>
                      Відправити
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ---------- SHIP TAB ---------- */}
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

                <div className="shipTime">
                  {new Date(ev.created_at).toLocaleString()}
                </div>
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

      {/* ---------- CREATE MODAL ---------- */}
      <Modal open={createOpen} onClose={closeCreate}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">Додати товар</div>
            <div className="modalSubtitle">Спочатку фото, потім дані</div>
          </div>
          <button className="iconBtn" onClick={closeCreate} type="button">
            ✕
          </button>
        </div>

        <div className="modalBody">
          <AddPhotoCarousel
            photos={createPhotos}
            onAdd={pickCreatePhotos}
            onRemove={removePhoto(setCreatePhotos)}
          />

          <form id="createForm" onSubmit={onCreateSubmit} className="form">
            <label>
              Назва
              <input
                className="input"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                placeholder="Напр. Футболка Nike"
              />
            </label>

            <div className="row2">
              <label>
                Розмір
                <input
                  className="input"
                  value={createForm.size}
                  onChange={(e) => setCreateForm({ ...createForm, size: e.target.value })}
                  placeholder="S / M / L / 42..."
                />
              </label>

              <label>
                SKU (опц.)
                <input
                  className="input"
                  value={createForm.sku}
                  onChange={(e) => setCreateForm({ ...createForm, sku: e.target.value })}
                  placeholder="Код/артикул"
                />
              </label>
            </div>

            <label>
              Нотатка (опц.)
              <input
                className="input"
                value={createForm.note}
                onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })}
                placeholder="Колір/постачальник/коментар"
              />
            </label>

            <div className="row2">
              <label>
                Собівартість (₴/шт)
                <input
                  className="input"
                  inputMode="decimal"
                  value={createForm.cost}
                  onChange={(e) => setCreateForm({ ...createForm, cost: e.target.value })}
                />
              </label>

              <label>
                Ціна продажу (₴/шт)
                <input
                  className="input"
                  inputMode="decimal"
                  value={createForm.sale_price}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, sale_price: e.target.value })
                  }
                />
              </label>
            </div>

            <div className="row2">
              <label>
                В наявності (шт)
                <input
                  className="input"
                  inputMode="numeric"
                  value={createForm.qty_in_stock}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, qty_in_stock: e.target.value })
                  }
                />
              </label>

              <label>
                В доставці (шт)
                <input
                  className="input"
                  inputMode="numeric"
                  value={createForm.qty_in_delivery}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, qty_in_delivery: e.target.value })
                  }
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

      {/* ---------- EDIT MODAL ---------- */}
      <Modal open={editOpen} onClose={closeEdit}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">Картка товару</div>
            <div className="modalSubtitle">Редагування даних та фото</div>
          </div>
          <button className="iconBtn" onClick={closeEdit} type="button">
            ✕
          </button>
        </div>

        <div className="modalBody">
          {activeItem ? (
            <>
              {/* існуючі фото */}
              <div className="photoBox" style={{ marginBottom: 10 }}>
                <div className="photoRow">
                  {(activeItem.photo_paths ?? []).length ? (
                    (activeItem.photo_paths ?? []).map((p) => (
                      <div className="photoSlide" key={p}>
                        <img className="photoImg" src={getPublicPhotoUrl(p)} alt="" />
                      </div>
                    ))
                  ) : (
                    <div className="photoAddBig" style={{ width: "100%" }}>
                      <div className="photoSubText">Нема фото</div>
                    </div>
                  )}

                  {/* додати ще */}
                  <button type="button" className="photoAddSmall" onClick={pickEditPhotos}>
                    <div className="photoPlus">＋</div>
                    <div className="photoAddText">Додати</div>
                  </button>
                </div>
              </div>

              {/* нові фото (ще не завантажені) */}
              {editNewPhotos.length ? (
                <AddPhotoCarousel
                  photos={editNewPhotos}
                  onAdd={pickEditPhotos}
                  onRemove={removePhoto(setEditNewPhotos)}
                />
              ) : null}

              <div className="stockCardStats" style={{ marginTop: 10 }}>
                <div><span>В наявності</span><b>{activeItem.qty_in_stock}</b></div>
                <div><span>В доставці</span><b>{activeItem.qty_in_delivery}</b></div>
                <div><span>Отримано</span><b>{activeItem.qty_delivered_total}</b></div>
                <div><span>Повернено</span><b>{activeItem.qty_returned_total}</b></div>
              </div>

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
                  Нотатка
                  <input
                    className="input"
                    value={editForm.note}
                    onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  />
                </label>

                <div className="row2">
                  <label>
                    Собівартість (₴/шт)
                    <input
                      className="input"
                      inputMode="decimal"
                      value={editForm.cost}
                      onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })}
                    />
                  </label>

                  <label>
                    Ціна продажу (₴/шт)
                    <input
                      className="input"
                      inputMode="decimal"
                      value={editForm.sale_price}
                      onChange={(e) =>
                        setEditForm({ ...editForm, sale_price: e.target.value })
                      }
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

      {/* ---------- SHIP MODAL ---------- */}
      <Modal open={shipOpen} onClose={closeShip}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">Відправити</div>
            <div className="modalSubtitle">
              {shipItem ? `${shipItem.title} ${shipItem.size ? `• ${shipItem.size}` : ""}` : ""}
            </div>
          </div>
          <button className="iconBtn" onClick={closeShip} type="button">
            ✕
          </button>
        </div>

        <div className="modalBody">
          {shipItem ? (
            <>
              <div className="shipInfoRow">
                <div className="shipInfoPill">
                  <span>В наявності</span>
                  <b>{shipItem.qty_in_stock}</b>
                </div>
                <div className="shipInfoPill">
                  <span>В доставці</span>
                  <b>{shipItem.qty_in_delivery}</b>
                </div>
              </div>

              <AddPhotoCarousel
                photos={shipPhotos}
                onAdd={pickShipPhotos}
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
                      placeholder="Прізвище Ім'я"
                    />
                  </label>

                  <label>
                    Номер телефону
                    <input
                      className="input"
                      inputMode="tel"
                      value={shipForm.phone}
                      onChange={(e) => setShipForm({ ...shipForm, phone: e.target.value })}
                      placeholder="+380..."
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
                      placeholder="Київ"
                    />
                  </label>

                  <label>
                    № відділення
                    <input
                      className="input"
                      value={shipForm.branch}
                      onChange={(e) => setShipForm({ ...shipForm, branch: e.target.value })}
                      placeholder="Напр. 12"
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