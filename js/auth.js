import { supabase, configured } from "./supabase-client.js";

const need = () => { if (!configured) throw new Error("Configure js/config.js com a URL e a chave do Supabase."); };
const base = () => location.origin + location.pathname.replace(/[^/]*$/, "");

export async function signUp(email, password) {
  need();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: base() + "aluno.html" } });
  if (error) throw error; return data;
}
export async function signIn(email, password) {
  need();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signInGoogle() {
  need();
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: base() + "aluno.html" } });
  if (error) throw error;
}
export async function resetPassword(email) {
  need();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: base() + "login.html" });
  if (error) throw error;
}
export async function signOut() { await supabase.auth.signOut(); location.href = "login.html"; }

export async function isAdmin() {
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}
// Guarda de página. A segurança real está no RLS; isto só decide a navegação.
export async function requireUser({ admin = false } = {}) {
  need();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { if (!admin) location.replace("login.html"); return null; }
  if (admin && !(await isAdmin())) { await supabase.auth.signOut(); return null; }
  return session.user;
}
