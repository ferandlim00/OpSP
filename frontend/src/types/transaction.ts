import { Product } from "./product";

export interface CustomerRef {
  ID: number;
  customer_code: string;
  name: string;
  phone: string;
  email: string;
  address: string;
}

export interface TransactionItem {
  ID: number;
  transaction_id: number;
  product_id: number;
  qty: number;
  delivered_qty?: number;
  returned_qty?: number;
  price: number;
  discount: number;
  subtotal: number;
  product?: Product;
}

export interface PaymentRecord {
  ID: number;
  transaction_id: number;
  amount: number;
  method: "CASH" | "TRANSFER" | "QRIS" | "DEBIT" | "OTHER";
  payment_type: "DP" | "FULL";
  proof_url?: string;
  note: string;
  CreatedAt: string;
}

export interface Transaction {
  ID: number;
  transaction_no: string;
  customer_id: number;
  type: "SALE" | "RETURN" | "CANCEL";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELLED";
  payment_status: "UNPAID" | "PARTIAL" | "PAID";
  total: number;
  discount: number;
  note: string;
  CreatedAt: string;
  customer?: CustomerRef;
  items?: TransactionItem[];
  payments?: PaymentRecord[];
}

export interface CreateTransactionItemInput {
  product_id: number;
  qty: number;
  price: number;
  discount: number;
}

export interface CreateTransactionInput {
  customer_id: number;
  discount: number;
  note: string;
  items: CreateTransactionItemInput[];
}
