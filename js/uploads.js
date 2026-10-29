import { supabase } from "./supabase-client.js";
import { AVATAR_BUCKET, MAX_UPLOAD_BYTES } from "./config.js";
import { createId } from "./ids.js";

// Confere o conteúdo real (assinatura do arquivo), não só extensão/MIME.
async function sniff(file) {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (s, e) => String.fromCharCode(...b.slice(s, e));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (["avif", "avis"].includes(brand)) return "image/avif";
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) return "image/heic";
  }
  return null;
}
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível abrir essa foto neste navegador. Tente salvar como JPG e enviar novamente.")); };
    image.src = url;
  });
}
async function compress(file, max = 512) {
  let source, width, height;
  if (typeof createImageBitmap === "function") {
    try { source = await createImageBitmap(file); width = source.width; height = source.height; }
    catch { /* Tenta a decodificação via <img>, mais compatível com Safari. */ }
  }
  if (!source) { source = await loadImage(file); width = source.naturalWidth; height = source.naturalHeight; }
  const s = Math.min(1, max / Math.max(width, height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(width * s)); c.height = Math.max(1, Math.round(height * s));
  const context = c.getContext("2d");
  if (!context) throw new Error("Não foi possível processar a imagem neste navegador.");
  context.drawImage(source, 0, 0, c.width, c.height);
  source.close?.();
  const toBlob = (type) => new Promise((resolve, reject) => {
    try { c.toBlob(resolve, type, 0.85); } catch (error) { reject(error); }
  });
  let blob = await toBlob("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg");
  if (!blob) throw new Error("Falha ao processar a imagem.");
  return { blob, extension: blob.type === "image/webp" ? "webp" : "jpg", contentType: blob.type };
}
export async function uploadAvatar(file, userId) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("A imagem passa de 5 MB.");
  if (!(await sniff(file))) throw new Error("Use uma imagem JPG, PNG, WebP, AVIF ou HEIC.");
  const { blob, extension, contentType } = await compress(file);
  const path = `${userId}/avatar-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
  return path;
}
export const avatarUrl = (path) => (path ? supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl : null);

// Upload genérico (banners/produtos): valida conteúdo real, limite de 5 MB e comprime para formato compatível.
export async function uploadPublicImage(bucket, file, max = 1280) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("A imagem passa de 5 MB.");
  if (!(await sniff(file))) throw new Error("Use uma imagem JPG, PNG, WebP, AVIF ou HEIC.");
  const { blob, extension, contentType } = await compress(file, max);
  const path = `${createId()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
  return path;
}
export const publicUrl = (bucket, path) => (path ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : null);
export const removeImage = (bucket, path) => path && supabase.storage.from(bucket).remove([path]).catch(() => {});
