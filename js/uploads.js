import { supabase } from "./supabase-client.js";
import { AVATAR_BUCKET, MAX_UPLOAD_BYTES } from "./config.js";

// Confere o conteúdo real (assinatura do arquivo), não só extensão/MIME.
async function sniff(file) {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (s, e) => String.fromCharCode(...b.slice(s, e));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) return "image/avif";
  return null;
}
async function compress(file, max = 512) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok, no) => c.toBlob((x) => (x ? ok(x) : no(new Error("Falha ao processar a imagem."))), "image/webp", 0.85));
}
export async function uploadAvatar(file, userId) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("A imagem passa de 5 MB.");
  if (!(await sniff(file))) throw new Error("Use uma imagem JPG, PNG, WebP ou AVIF.");
  const blob = await compress(file);
  const path = `${userId}/avatar-${Date.now()}.webp`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, { contentType: "image/webp", upsert: false });
  if (error) throw error;
  return path;
}
export const avatarUrl = (path) => (path ? supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl : null);

// Upload genérico (banners/produtos): mesma validação de conteúdo real, limite de 5 MB e compressão para WebP.
export async function uploadPublicImage(bucket, file, max = 1280) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("A imagem passa de 5 MB.");
  if (!(await sniff(file))) throw new Error("Use uma imagem JPG, PNG, WebP ou AVIF.");
  const blob = await compress(file, max);
  const path = `${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: "image/webp", upsert: false });
  if (error) throw error;
  return path;
}
export const publicUrl = (bucket, path) => (path ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : null);
export const removeImage = (bucket, path) => path && supabase.storage.from(bucket).remove([path]).catch(() => {});
