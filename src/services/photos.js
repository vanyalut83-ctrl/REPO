import { db } from "./supabase";

const BUCKET = "item-photos";

function extFromName(name = "") {
  const p = name.split(".");
  return (p.length > 1 ? p.pop() : "jpg").toLowerCase();
}

function uid() {
  return (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

export function getPublicPhotoUrl(path) {
  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadItemPhoto({ itemId, file }) {
  const ext = extFromName(file.name);
  const path = `${itemId}/${uid()}.${ext}`;

  const { error } = await db.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  return path;
}

export async function appendItemPhotoPath(itemId, newPath) {
  const { data: row, error: e1 } = await db
    .from("items")
    .select("photo_paths")
    .eq("id", itemId)
    .single();
  if (e1) throw e1;

  const next = [...(row.photo_paths ?? []), newPath];

  const { error: e2 } = await db
    .from("items")
    .update({ photo_paths: next })
    .eq("id", itemId);
  if (e2) throw e2;

  return next;
}