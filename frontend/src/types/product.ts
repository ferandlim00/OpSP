// Tipe data Produk — harus sama dengan JSON dari backend Go (models/product.go)

export interface ProductImage {
  ID: number;
  product_id: number;
  image_url: string;
  is_primary: boolean;
  sort_order: number;
}

export interface ProductCategory {
  ID: number;
  name: string;
}

export type RoomType = "LIVING" | "BEDROOM" | "DINING" | "OFFICE" | "OTHER";

export interface Product {
  ID: number;
  sku: string;
  name: string;
  category_id: number;
  room_type: RoomType;
  description: string;
  price_buy: number | null;
  price_sell: number;
  stock: number;
  min_stock: number;
  is_active: boolean;
  category?: ProductCategory;
  images?: ProductImage[];
  CreatedAt: string;
  DeletedAt?: string | null; // terisi jika produk sudah dihapus (soft delete)
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PaginatedProducts {
  items: Product[];
  meta: PaginationMeta;
}

export const ROOM_OPTIONS: { value: RoomType; label: string; emoji: string }[] = [
  { value: "LIVING", label: "Ruang Tamu", emoji: "🛋️" },
  { value: "BEDROOM", label: "Kamar Tidur", emoji: "🛏️" },
  { value: "DINING", label: "Ruang Makan", emoji: "🍽️" },
  { value: "OFFICE", label: "Ruang Kerja", emoji: "💼" },
  { value: "OTHER", label: "Serbaguna", emoji: "📦" },
];

export const roomLabel = (v?: string) => {
  const r = ROOM_OPTIONS.find((o) => o.value === v);
  return r ? `${r.emoji} ${r.label}` : "📦 Serbaguna";
};

export const MAX_IMAGES = 8;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
