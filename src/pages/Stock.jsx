import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../services/supabase";
import { createItem, listItems } from "../services/items";
import { appendItemPhotoPath, getPublicPhotoUrl, uploadItemPhoto } from "../services/photos";

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

function IconTrash({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 6l1 16h10l1-16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 11v7M14 11v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconEdit({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconShip({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 7h11v10H3V7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 10h4l3 3v4h-7v-7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" stroke="currentColor" strokeWidth="2" />
      <path d="M17 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
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
          <button className="iconBtn" type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modalBody">{children}</div>

        {footer ? <div className="modalFooter">{footer}</div> : null}
      </div>
    </div>
  );
}

function PhotoSquare({ urls }) {
  // Фото обрізається під блок (object-fit: cover)
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

function GroupCard({ group, onOpen }) {
  const qty = group.qty_in_stock_sum;
  const low = qty > 0 && qty <= 2;
  const out = qty === 0;

  return (
    <button type="button" className="pCard pCardBtn" onClick={onOpen}>
      <div className="pBadges">
        <div className="pBadge left">{group.tag}</div>
        {out ? (
          <div className="pBadge right danger">Нема</div>
        ) : low ? (
          <div className="pBadge right warn">Мало</div>
        ) : (
          <div className="pBadge right">{group.variantsCount} вар.</div>
        )}
      </div>

      <PhotoSquare urls={group.coverUrls} />

      <div className="pBody">
        <div className="pTitle">{group.title}</div>
        <div className="pSub">
          В наявності: <b>{qty}</b> • В доставці: <b>{group.qty_in_delivery_sum}</b>
        </div>

        <div className="pFooter">
          <div className="pStockPill">
            <span className="dot" />
            <span>{qty} шт</span>
          </div>
          <div className="pActions">
            <span className="hintTiny">Відкрити</span>
          </div>
        </div>
      </div>
    </button>
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
            <div className="photoSubText">камера / фото / файли</div>
          </button>
        ) : (
          <>
            {photos.map((p, idx) => (
              <div className="photoSlide" key={p.url}>
                <img className="photoImg" src={p.url} alt="" />
                <button type="button" className="photoRemove" onClick={() => onRemove(idx)} title="Видалити">
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
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");

  // ---- Group modal (product)
  const [groupOpen, setGroupOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null); // {title, variants:[]}

  // ---- Create variant modal
  const [createOpen, setCreateOpen] = useState(false);
  const [busyCreate, setBusyCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    color: "",
    size: "",
    sku: "",
    note: "",
    cost: "0",
    sale_price: "0",
    qty_in_stock: "0",
    qty_in_delivery: "0",
  });
  const [createPhotos, setCreatePhotos] = useState([]);
  const createInputRef = useRef(null);

  // ---- Edit variant modal
  const [editOpen, setEditOpen] = useState(false);
  const [busyEdit, setBusyEdit] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [activeVariant, setActiveVariant] = useState(null); // item row
  const [editForm, setEditForm] = useState({
    title: "",
    color: "",
    size: "",
    sku: "",
    note: "",
    cost: "0",
    sale_price: "0",
    qty_in_stock: "0",
    qty_in_delivery: "0",
  });
  const [editNewPhotos, setEditNewPhotos] = useState([]);
  const editInputRef = useRef(null);

  // ---- Ship modal
  const [shipOpen, setShipOpen] = useState(false);
  const [busyShip, setBusyShip] = useState(false);
  const [shipVariant, setShipVariant] = useState(null); // selected variant
  const [shipForm, setShipForm] = useState({
    full_name: "",
    phone: "",
    city: "",
    branch: "",
    qty: "1",
  });
  const [shipPhotos, setShipPhotos] = useState([]);
  const shipInputRef = useRef(null);

  function revokePreviews(arr) {
    for (const p of arr) {
      try {
        URL.revokeObjectURL(p.url);
      } catch {}
    }
  }

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

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) => {
      const hay = `${x.title ?? ""} ${x.color ?? ""} ${x.size ?? ""} ${x.sku ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [items, q]);

  const groups = useMemo(() => {
    const map = new Map();

    for (const it of filtered) {
      const key = (it.title ?? "").trim().toLowerCase();
      if (!key) continue;

      if (!map.has(key)) {
        map.set(key, {
          key,
          title: it.title,
          tag: (it.note && String(it.note).trim().slice(0, 12)) || "Товар",
          variants: [],
        });
      }
      map.get(key).variants.push(it);
    }

    const out = [];
    for (const g of map.values()) {
      const qty_in_stock_sum = g.variants.reduce((a, x) => a + (x.qty_in_stock ?? 0), 0);
      const qty_in_delivery_sum = g.variants.reduce((a, x) => a + (x.qty_in_delivery ?? 0), 0);

      // cover: перше фото з першого варіанту, якщо є
      const first = g.variants.find((v) => (v.photo_paths ?? []).length) || g.variants[0];
      const coverUrls = (first?.photo_paths ?? [])
        .map((p) => normalizeItemPhotoPath(first.id, p))
        .filter(Boolean)
        .map(getPublicPhotoUrl);

      out.push({
        ...g,
        qty_in_stock_sum,
        qty_in_delivery_sum,
        variantsCount: g.variants.length,
        coverUrls,
      });
    }

    // більш “живий” порядок: спочатку де є на складі
    out.sort((a, b) => (b.qty_in_stock_sum - a.qty_in_stock_sum) || a.title.localeCompare(b.title));
    return out;
  }, [filtered]);

  // ----- open group modal
  function openGroup(g) {
    setActiveGroup(g);
    setGroupOpen(true);
  }
  function closeGroup() {
    setGroupOpen(false);
    setActiveGroup(null);
  }

  // ----- create
  function openCreate(initial = {}) {
    setErr("");
    setCreateForm({
      title: initial.title ?? "",
      color: "",
      size: "",
      sku: "",
      note: initial.note ?? "",
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

  async function submitCreate(e) {
    e.preventDefault();
    setErr("");

    const title = createForm.title.trim();
    if (!title) return setErr("Вкажи назву");

    const payload = {
      title,
      color: createForm.color.trim() || null,
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

      closeCreate();
      await load();
    } catch (e2) {
      setErr(e2?.message ?? "Помилка створення");
    } finally {
      setBusyCreate(false);
    }
  }

  // ----- edit variant
  function openEditVariant(v) {
    setErr("");
    setActiveVariant(v);
    setEditForm({
      title: v.title ?? "",
      color: v.color ?? "",
      size: v.size ?? "",
      sku: v.sku ?? "",
      note: v.note ?? "",
      cost: String(v.cost ?? 0),
      sale_price: String(v.sale_price ?? 0),
      qty_in_stock: String(v.qty_in_stock ?? 0),
      qty_in_delivery: String(v.qty_in_delivery ?? 0),
    });
    setEditNewPhotos((prev) => {
      revokePreviews(prev);
      return [];
    });
    setEditOpen(true);
  }
  function closeEditVariant() {
    setEditOpen(false);
    setActiveVariant(null);
    setEditNewPhotos((prev) => {
      revokePreviews(prev);
      return [];
    });
  }

  async function saveEditVariant() {
    if (!activeVariant) return;
    setErr("");

    const title = editForm.title.trim();
    if (!title) return setErr("Вкажи назву");

    const patch = {
      title,
      color: editForm.color.trim() || null,
      size: editForm.size.trim() || null,
      sku: editForm.sku.trim() || null,
      note: editForm.note.trim() || null,
      cost: toNumber(editForm.cost),
      sale_price: toNumber(editForm.sale_price),
      qty_in_stock: toInt(editForm.qty_in_stock),
      qty_in_delivery: toInt(editForm.qty_in_delivery),
    };

    setBusyEdit(true);
    try {
      const { error } = await db.from("items").update(patch).eq("id", activeVariant.id);
      if (error) throw error;

      for (const p of editNewPhotos) {
        const path = await uploadItemPhoto({ itemId: activeVariant.id, file: p.file });
        await appendItemPhotoPath(activeVariant.id, path);
      }

      closeEditVariant();
      await load();
    } catch (e) {
      setErr(e?.message ?? "Помилка збереження");
    } finally {
      setBusyEdit(false);
    }
  }

  async function deleteVariant() {
    if (!activeVariant) return;
    const ok = window.confirm(`Видалити варіант?\n${activeVariant.title} • ${activeVariant.color || "-"} • ${activeVariant.size || "-"}`);
    if (!ok) return;

    setBusyDelete(true);
    setErr("");
    try {
      const { error } = await db.from("items").delete().eq("id", activeVariant.id);
      if (error) throw error;

      closeEditVariant();
      await load();
    } catch (e) {
      setErr(e?.message ?? "Помилка видалення");
    } finally {
      setBusyDelete(false);
    }
  }

  // ----- ship (for selected variant)
  function openShip(v) {
    setErr("");
    setShipVariant(v);
    setShipForm({ full_name: "", phone: "", city: "", branch: "", qty: "1" });
    setShipPhotos((prev) => {
      revokePreviews(prev);
      return [];
    });
    setShipOpen(true);
  }
  function closeShip() {
    setShipOpen(false);
    setShipVariant(null);
    setShipPhotos((prev) => {
      revokePreviews(prev);
      return [];
    });
  }

  async function uploadShipmentPhoto(eventId, file) {
    const path = `shipments/${eventId}/${uid()}.${extFromName(file.name)}`;
    const { data, error } = await db.storage.from("item-photos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });
    if (error) throw error;
    return data?.path ?? path;
  }

  async function submitShip(e) {
    e.preventDefault();
    if (!shipVariant) return;

    setErr("");

    const qty = toInt(shipForm.qty);
    if (qty <= 0) return setErr("К-сть має бути > 0");
    if (qty > (shipVariant.qty_in_stock ?? 0)) return setErr("Недостатньо на складі");

    const full_name = shipForm.full_name.trim();
    const phone = shipForm.phone.trim();
    const city = shipForm.city.trim();
    const branch = shipForm.branch.trim();
    if (!full_name || !phone || !city || !branch) return setErr("Заповни ПІБ, телефон, місто, відділення");

    setBusyShip(true);
    try {
      // 1) створюємо ship-event + міняємо залишки
      const { data: eventId, error: rpcErr } = await db.rpc("ship_item", {
        p_item_id: shipVariant.id,
        p_qty: qty,
        p_full_name: full_name,
        p_phone: phone,
        p_city: city,
        p_branch: branch,
      });
      if (rpcErr) throw rpcErr;

      // 2) аплоад фото доставки
      const uploaded = [];
      for (const p of shipPhotos) {
        uploaded.push(await uploadShipmentPhoto(eventId, p.file));
      }

      // 3) дописати meta: color/size + photo_paths
      const { data: row, error: e1 } = await db.from("item_events").select("meta").eq("id", eventId).single();
      if (e1) throw e1;

      const meta = row?.meta ?? {};
      const nextMeta = {
        ...meta,
        color: shipVariant.color ?? null,
        size: shipVariant.size ?? null,
        sku: shipVariant.sku ?? null,
        photo_paths: uniq([...(meta.photo_paths ?? []), ...uploaded]),
      };

      const { error: e2 } = await db.from("item_events").update({ meta: nextMeta }).eq("id", eventId);
      if (e2) throw e2;

      closeShip();
      await load();
      navigate("/"); // на Головну (відправлення)
    } catch (e2) {
      setErr(e2?.message ?? "Помилка відправлення");
    } finally {
      setBusyShip(false);
    }
  }

  return (
    <section>
      <div className="stockTop">
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Пошук: назва / колір / розмір / sku..."
          style={{ flex: "1 1 260px" }}
        />
        <button className="btnSecondary" type="button" onClick={load}>
          Оновити
        </button>
      </div>

      {err ? <div className="errorBox">{err}</div> : null}
      {loading ? <p style={{ marginTop: 10 }}>Завантаження...</p> : null}

      <div className="premiumGrid">
        {groups.map((g) => (
          <GroupCard key={g.key} group={g} onOpen={() => openGroup(g)} />
        ))}
      </div>

      {/* add button centered */}
      <button className="fabAdd" type="button" onClick={() => openCreate({})}>
        + Додати
      </button>
      <div style={{ height: 84 }} />

      {/* hidden inputs */}
      <input ref={createInputRef} type="file" accept="image/*" multiple onChange={onFilesSelected(setCreatePhotos)} style={{ display: "none" }} />
      <input ref={editInputRef} type="file" accept="image/*" multiple onChange={onFilesSelected(setEditNewPhotos)} style={{ display: "none" }} />
      <input ref={shipInputRef} type="file" accept="image/*" multiple onChange={onFilesSelected(setShipPhotos)} style={{ display: "none" }} />

      {/* GROUP (product) modal */}
      <Modal
        open={groupOpen}
        onClose={closeGroup}
        title={activeGroup?.title || "Товар"}
        subtitle="Варіанти (колір/розмір)"
        footer={
          <div className="modalFooterSplit">
            <button className="btnSecondary" type="button" onClick={closeGroup}>Закрити</button>
            <button className="btn" type="button" onClick={() => openCreate({ title: activeGroup?.title || "" })}>
              + Додати варіант
            </button>
          </div>
        }
      >
        {activeGroup ? (
          <div className="variantList">
            {activeGroup.variants
              .slice()
              .sort((a, b) => (a.color || "").localeCompare(b.color || "") || (a.size || "").localeCompare(b.size || ""))
              .map((v) => (
                <div className="variantRow" key={v.id}>
                  <div className="variantMain">
                    <div className="variantTitle">
                      <b>{v.color || "—"}</b> • <b>{v.size || "—"}</b>
                      {v.sku ? <span className="muted"> • SKU-{v.sku}</span> : null}
                    </div>
                    <div className="variantMeta">
                      <span>В наявності: <b>{v.qty_in_stock}</b></span>
                      <span>В доставці: <b>{v.qty_in_delivery}</b></span>
                      <span>Ціна: <b>₴ {v.sale_price}</b></span>
                    </div>
                  </div>

                  <div className="variantActions">
                    <button className="iconAction" type="button" onClick={() => openEditVariant(v)} title="Редагувати">
                      <IconEdit />
                    </button>
                    <button className="iconAction primary" type="button" onClick={() => openShip(v)} title="Відправити" disabled={(v.qty_in_stock ?? 0) <= 0}>
                      <IconShip />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        ) : null}
      </Modal>

      {/* CREATE variant modal */}
      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="Додати варіант"
        subtitle="Колір + розмір + кількість"
        footer={
          <div className="modalFooterSplit">
            <button className="btnSecondary" type="button" onClick={closeCreate} disabled={busyCreate}>Скасувати</button>
            <button className="btn" type="submit" form="createVariantForm" disabled={busyCreate}>
              {busyCreate ? "Зберігаю..." : "Створити"}
            </button>
          </div>
        }
      >
        <AddPhotoCarousel photos={createPhotos} onAdd={() => createInputRef.current?.click()} onRemove={removePhoto(setCreatePhotos)} />

        <form id="createVariantForm" onSubmit={submitCreate} className="form">
          <label>
            Назва
            <input className="input" value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} />
          </label>

          <div className="row2">
            <label>
              Колір
              <input className="input" value={createForm.color} onChange={(e) => setCreateForm({ ...createForm, color: e.target.value })} placeholder="Напр. Чорний" />
            </label>
            <label>
              Розмір
              <input className="input" value={createForm.size} onChange={(e) => setCreateForm({ ...createForm, size: e.target.value })} placeholder="S / M / L / 42" />
            </label>
          </div>

          <div className="row2">
            <label>
              SKU (опц.)
              <input className="input" value={createForm.sku} onChange={(e) => setCreateForm({ ...createForm, sku: e.target.value })} />
            </label>
            <label>
              Тег/Нотатка (опц.)
              <input className="input" value={createForm.note} onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })} placeholder="Напр. Одяг" />
            </label>
          </div>

          <div className="row2">
            <label>
              Собівартість (₴/шт)
              <input className="input" inputMode="decimal" value={createForm.cost} onChange={(e) => setCreateForm({ ...createForm, cost: e.target.value })} />
            </label>
            <label>
              Ціна продажу (₴/шт)
              <input className="input" inputMode="decimal" value={createForm.sale_price} onChange={(e) => setCreateForm({ ...createForm, sale_price: e.target.value })} />
            </label>
          </div>

          <div className="row2">
            <label>
              В наявності (шт)
              <input className="input" inputMode="numeric" value={createForm.qty_in_stock} onChange={(e) => setCreateForm({ ...createForm, qty_in_stock: e.target.value })} />
            </label>
            <label>
              В доставці (шт)
              <input className="input" inputMode="numeric" value={createForm.qty_in_delivery} onChange={(e) => setCreateForm({ ...createForm, qty_in_delivery: e.target.value })} />
            </label>
          </div>
        </form>
      </Modal>

      {/* EDIT variant modal (delete first icon) */}
      <Modal
        open={editOpen}
        onClose={closeEditVariant}
        title="Редагувати варіант"
        subtitle={activeVariant ? `${activeVariant.title} • ${activeVariant.color || "—"} • ${activeVariant.size || "—"}` : ""}
        footer={
          <div className="modalFooterSplit">
            <button
              className="iconDanger"
              type="button"
              onClick={deleteVariant}
              disabled={busyDelete || busyEdit}
              title="Видалити"
              aria-label="Delete"
            >
              <IconTrash />
            </button>

            <div className="modalFooterRight">
              <button className="btnSecondary" type="button" onClick={closeEditVariant} disabled={busyDelete || busyEdit}>
                Закрити
              </button>
              <button className="btn" type="button" onClick={saveEditVariant} disabled={busyDelete || busyEdit}>
                {busyEdit ? "Зберігаю..." : "Зберегти"}
              </button>
            </div>
          </div>
        }
      >
        {activeVariant ? (
          <>
            <div className="photoBox">
              <div className="photoRow">
                {(activeVariant.photo_paths ?? []).length ? (
                  (activeVariant.photo_paths ?? []).map((p) => {
                    const norm = normalizeItemPhotoPath(activeVariant.id, p);
                    const url = getPublicPhotoUrl(norm);
                    return (
                      <div className="photoSlide" key={p}>
                        <img className="photoImg" src={url} alt="" />
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
              <AddPhotoCarousel photos={editNewPhotos} onAdd={() => editInputRef.current?.click()} onRemove={removePhoto(setEditNewPhotos)} />
            ) : null}

            <form className="form" onSubmit={(e) => e.preventDefault()}>
              <label>
                Назва
                <input className="input" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              </label>

              <div className="row2">
                <label>
                  Колір
                  <input className="input" value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} />
                </label>
                <label>
                  Розмір
                  <input className="input" value={editForm.size} onChange={(e) => setEditForm({ ...editForm, size: e.target.value })} />
                </label>
              </div>

              <div className="row2">
                <label>
                  SKU
                  <input className="input" value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} />
                </label>
                <label>
                  Тег/Нотатка
                  <input className="input" value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} />
                </label>
              </div>

              <div className="row2">
                <label>
                  Собівартість
                  <input className="input" inputMode="decimal" value={editForm.cost} onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })} />
                </label>
                <label>
                  Ціна
                  <input className="input" inputMode="decimal" value={editForm.sale_price} onChange={(e) => setEditForm({ ...editForm, sale_price: e.target.value })} />
                </label>
              </div>

              <div className="row2">
                <label>
                  В наявності
                  <input className="input" inputMode="numeric" value={editForm.qty_in_stock} onChange={(e) => setEditForm({ ...editForm, qty_in_stock: e.target.value })} />
                </label>
                <label>
                  В доставці
                  <input className="input" inputMode="numeric" value={editForm.qty_in_delivery} onChange={(e) => setEditForm({ ...editForm, qty_in_delivery: e.target.value })} />
                </label>
              </div>
            </form>
          </>
        ) : null}
      </Modal>

      {/* SHIP modal */}
      <Modal
        open={shipOpen}
        onClose={closeShip}
        title="Відправити"
        subtitle={
          shipVariant
            ? `${shipVariant.title} • ${shipVariant.color || "—"} • ${shipVariant.size || "—"}`
            : ""
        }
        footer={
          <div className="modalFooterSplit">
            <button className="btnSecondary" type="button" onClick={closeShip} disabled={busyShip}>
              Скасувати
            </button>
            <button className="btn" type="submit" form="shipForm" disabled={busyShip}>
              {busyShip ? "Відправляю..." : "Відправити"}
            </button>
          </div>
        }
      >
        <AddPhotoCarousel photos={shipPhotos} onAdd={() => shipInputRef.current?.click()} onRemove={removePhoto(setShipPhotos)} />

        <form id="shipForm" onSubmit={submitShip} className="form">
          <div className="row2">
            <label>
              ПІБ
              <input className="input" value={shipForm.full_name} onChange={(e) => setShipForm({ ...shipForm, full_name: e.target.value })} />
            </label>
            <label>
              Телефон
              <input className="input" inputMode="tel" value={shipForm.phone} onChange={(e) => setShipForm({ ...shipForm, phone: e.target.value })} />
            </label>
          </div>

          <div className="row2">
            <label>
              Місто
              <input className="input" value={shipForm.city} onChange={(e) => setShipForm({ ...shipForm, city: e.target.value })} />
            </label>
            <label>
              № відділення
              <input className="input" value={shipForm.branch} onChange={(e) => setShipForm({ ...shipForm, branch: e.target.value })} />
            </label>
          </div>

          <label>
            Кількість (доступно: {shipVariant?.qty_in_stock ?? 0})
            <input className="input" inputMode="numeric" value={shipForm.qty} onChange={(e) => setShipForm({ ...shipForm, qty: e.target.value })} />
          </label>
        </form>
      </Modal>
    </section>
  );
}