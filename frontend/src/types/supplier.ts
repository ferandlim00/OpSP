export interface Supplier {
  ID: number;
  code: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  pic: string;
  is_active: boolean;
  note: string;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export type SupplierInput = Omit<Supplier, 'ID' | 'CreatedAt' | 'UpdatedAt'>;