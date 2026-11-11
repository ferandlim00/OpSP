import { Product } from "./product";

export type MovementType = "INBOUND" | "PENDING" | "OUTBOUND" | "ADJUSTMENT";

export interface InventoryMovement {
  ID: number;
  product_id: number;
  user_id: number;
  type: MovementType;
  quantity: number;
  notes: string;
  photo_url?: string;
  CreatedAt: string;
  product?: Product;
}

export interface InventoryMovementInput {
  product_id: number;
  type: MovementType;
  quantity: number;
  notes: string;
  photo?: File | null;
}
