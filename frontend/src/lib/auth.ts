// Kunci yang dipakai untuk menyimpan data sesi di localStorage
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
 * Simpan token JWT dan data user setelah berhasil login
 */
export function setAuthSession(token: string, user: object) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Ambil token JWT yang tersimpan
 */
export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
}

/**
 * Ambil data user yang tersimpan (dengan tipe AuthUser secara default)
 */
export function getUser<T = AuthUser>(): T | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

/**
 * Cek apakah user sudah login (ada token)
 */
export function isAuthenticated(): boolean {
    return !!getToken();
}

/**
 * Hapus sesi login (logout)
 */
export function clearAuthSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

/**
 * Alias dari getUser() — dipakai di beberapa halaman seperti employees/page.tsx
 */
export const getAuthUser = getUser;
