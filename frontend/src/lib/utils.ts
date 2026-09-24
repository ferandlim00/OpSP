import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Fungsi cn() menggabungkan kelas Tailwind secara dinamis
 * dan otomatis menyelesaikan konflik kelas style.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}