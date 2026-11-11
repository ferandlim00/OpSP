import axios from "axios";
import { clearAuthSession, getToken } from "@/lib/auth";

// Alamat dasar backend Go Fiber kita
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Helper pembuat key idempotency deterministik per window 3 detik untuk mencegah double-click di seluruh aplikasi
function buildAutoIdempotencyKey(method: string, url: string, data: unknown): string {
    const bucket = Math.floor(Date.now() / 3000);
    let payloadSig = "";
    if (typeof FormData !== "undefined" && data instanceof FormData) {
        const parts: string[] = [];
        data.forEach((val, key) => {
            if (typeof File !== "undefined" && val instanceof File) {
                parts.push(`${key}:${val.name}:${val.size}`);
            } else {
                parts.push(`${key}:${String(val)}`);
            }
        });
        payloadSig = parts.join("|");
    } else if (data !== undefined && data !== null) {
        try {
            payloadSig = typeof data === "string" ? data : JSON.stringify(data);
        } catch {
            payloadSig = String(data);
        }
    }
    const raw = `${method.toUpperCase()}:${url}:${bucket}:${payloadSig}`;
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i++) {
        hash ^= raw.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `auto-${bucket}-${(hash >>> 0).toString(16)}`;
}

// Interceptor: Otomatis sisipkan Token JWT & X-Idempotency-Key di setiap request mutasi
api.interceptors.request.use(
    (config) => {
        if (typeof window !== "undefined") {
            const token = getToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            const method = (config.method || "get").toLowerCase();
            const isMutation = method === "post" || method === "put" || method === "patch" || method === "delete";
            const isLogin = (config.url || "").includes("/auth/login");
            if (isMutation && !isLogin && !config.headers["X-Idempotency-Key"]) {
                config.headers["X-Idempotency-Key"] = buildAutoIdempotencyKey(
                    method,
                    config.url || "",
                    config.data
                );
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Interceptor Response: Tangani jika token kedaluwarsa (401)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            if (typeof window !== "undefined") {
                // Jika token tidak valid / kedaluwarsa, hapus sesi dan arahkan ke login
                clearAuthSession();
                if (window.location.pathname !== "/login") {
                    window.location.href = "/login";
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;
