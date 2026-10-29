import { supabase } from "./supabase-client.js";
const ok = ({ data, error }) => { if (error) throw error; return data; };
export const listProducts = () => supabase.from("products").select("*").eq("status", "published").order("featured", { ascending: false }).order("sort_order").then(ok);
export const featured = (n) => supabase.from("products").select("id,title,price").eq("status", "published").eq("featured", true).order("sort_order").limit(n).then(ok);
export const whatsapp = async () => {
  const v = (await supabase.from("app_settings").select("value").eq("key", "whatsapp_number").maybeSingle().then(ok))?.value;
  return typeof v === "string" && /^\d{10,15}$/.test(v) ? v : null;
};
export const brl = (n) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
export const waLink = (num, title) =>
  `https://wa.me/${num}?text=${encodeURIComponent(`Olá! Tenho interesse no produto ${title} da BOX Jardim Silvina. Gostaria de saber mais detalhes.`)}`;
