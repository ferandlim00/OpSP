// Kunci yang dipakai untuk menyimpan data sesi di localStorage & Cookie
const TOKEN_KEY = "wf_token";
const USER_KEY = "wf_user";

/**
 * Tipe data user yang tersimpan di sesi setelah login
 */
export interface AuthUser {
    ID: number;
    name: string;
    username: string;
    email: string;
    role_id: number;
    is_active: boolean;
    role?: {
        ID: number;
        name: string;
        description: string;
    };
}

/**
 * Periksa apakah struktur & waktu kedaluwarsa (exp) token JWT masih valid (mendukung Base64URL tanpa padding '=')
 */
export function isJwtTokenNotExpired(token: string | null): boolean {
    if (!token || typeof token !== "string") return false;
    try {
        const parts = token.trim().split(".");
        if (parts.length !== 3) return false;
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
        const jsonPayload = decodeURIComponent(
            atob(padded)
                .split("")
                .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join("")
        );
        const payload = JSON.parse(jsonPayload);
        if (payload && typeof payload.exp === "number") {
            const nowSec = Math.floor(Date.now() / 1000);
            return payload.exp > nowSec;
        }
        return true;
    } catch {
        // Jika gagal decode di sisi browser, biarkan backend yang memvalidasi
        return true;
    }
}

/**
 * Simpan token JWT dan data user setelah berhasil login (di localStorage & Cookie)
 */
export function setAuthSession(token: string, user: object) {
    if (typeof window === "undefined") return;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=86400; SameSite=Lax${secureFlag}`;
}

/**
 * Ambil token JWT yang tersimpan (otomatis bersihkan jika sudah melewati waktu exp)
 */
export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    if (!isJwtTokenNotExpired(token)) {
        clearAuthSession();
        return null;
    }
    return token;
}

/**
 * Ambil data user yang tersimpan (dengan tipe AuthUser secara default)
 */
export function getUser<T = AuthUser>(): T | null {
    if (typeof window === "undefined") return null;
    if (!getToken()) return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

/**
 * Cek apakah user sudah login dengan token JWT yang masih aktif
 */
export function isAuthenticated(): boolean {
    return !!getToken();
}

/**
 * Hapus sesi login (logout) dari localStorage & Cookie
 */
export function clearAuthSession() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    document.cookie = `${TOKEN_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Alias dari getUser() — dipakai di beberapa halaman seperti employees/page.tsx
 */
export const getAuthUser = getUser;
