import { supabase } from "./supabase-client.js";
export async function getMyProfile(uid) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).single();
  if (error) throw error; return data;
}
export async function completeSetup(uid, { display_name, avatar_path }) {
  const patch = { display_name, profile_setup_done: true };
  if (avatar_path) patch.avatar_path = avatar_path;
  const { error } = await supabase.from("profiles").update(patch).eq("id", uid);
  if (error) throw error;
}
