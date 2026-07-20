import { db } from "./supabase";

export async function listItems() {
  const { data, error } = await db
    .from("items")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createItem(payload) {
  const { data, error } = await db
    .from("items")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}