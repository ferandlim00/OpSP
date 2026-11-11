// Backend menyimpan URL foto relatif, contoh: "/uploads/products/xxx.jpg".
// Helper ini mengubahnya menjadi URL lengkap: "http://localhost:8080/uploads/products/xxx.jpg".
// Jika nanti pindah ke Cloudflare R2 (URL sudah absolut https://...), URL dipakai apa adanya.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";
const BACKEND_ORIGIN = API_URL.replace(/\/api\/?$/, "");

export function getImageUrl(path?: string | null): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${BACKEND_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
}
