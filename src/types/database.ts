// Database types for the Production Dashboard
// These types mirror the Supabase database schema

export type ProductType = 'kiosk' | 'planter';
export type OrderSource = 'internal' | 'shopify';
export type OrderPriority = 'normal' | 'rush' | 'critical';
export type OrderStatus = 'pending' | 'in_production' | 'completed' | 'cancelled';
export type PrintJobStatus = 'queued' | 'printing' | 'completed' | 'failed';
export type PrinterStatus = 'idle' | 'printing' | 'error' | 'offline' | 'maintenance';
export type PrintHistoryStatus = 'success' | 'failed' | 'cancelled';
export type UserRole = 'admin' | 'manager' | 'viewer';

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  type: ProductType;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Part {
  id: string;
  name: string;
  print_time_minutes: number;
  material_grams: number;
  parts_per_print: number;
  color: string | null;
  material_type: string;
  gcode_file_url: string | null;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  products?: Product[];
  product_parts?: ProductPart[];
  inventory?: Inventory;
}

export interface ProductPart {
  id: string;
  product_id: string;
  part_id: string;
  created_at: string;
  // Joined fields
  product?: Product;
  part?: Part;
}

export interface Inventory {
  id: string;
  part_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  last_updated: string;
  // Joined fields
  part?: Part;
}

export interface ProductionOrder {
  id: string;
  source: OrderSource;
  shopify_order_id: string | null;
  shopify_order_number: string | null;
  product_id: string;
  quantity: number;
  priority: OrderPriority;
  status: OrderStatus;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  created_by: string | null;
  // Joined fields
  product?: Product;
  print_jobs?: PrintJob[];
}

export interface PrintJob {
  id: string;
  production_order_id: string;
  part_id: string;
  quantity_needed: number;
  quantity_completed: number;
  quantity_failed: number;
  status: PrintJobStatus;
  printer_id: string | null;
  scheduled_start: string | null;
  actual_start: string | null;
  actual_end: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  part?: Part;
  production_order?: ProductionOrder;
  printer?: Printer;
}

export interface Printer {
  id: string;
  name: string;
  model: string | null;
  serial_number: string | null;
  status: PrinterStatus;
  current_job_id: string | null;
  bambu_device_id: string | null;
  last_heartbeat: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  current_job?: PrintJob;
}

export interface PrintHistory {
  id: string;
  print_job_id: string;
  printer_id: string | null;
  part_id: string;
  status: PrintHistoryStatus;
  started_at: string;
  ended_at: string | null;
  failure_reason: string | null;
  material_used_grams: number | null;
  created_at: string;
  // Joined fields
  print_job?: PrintJob;
  printer?: Printer;
  part?: Part;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryAdjustment {
  id: string;
  part_id: string;
  previous_quantity: number;
  new_quantity: number;
  adjustment_type: 'manual' | 'print_complete' | 'print_failed' | 'order_reserved' | 'order_released';
  reason: string | null;
  created_by: string | null;
  created_at: string;
  // Joined fields
  part?: Part;
  user?: UserProfile;
}

// Dashboard Stats Types
export interface DashboardStats {
  pendingOrders: number;
  inProductionOrders: number;
  totalPartsInStock: number;
  printSuccessRate: number;
  lowStockParts: Part[];
  recentOrders: ProductionOrder[];
  activeJobs: PrintJob[];
}

// Form Input Types
export interface CreateProductInput {
  name: string;
  sku?: string;
  type: ProductType;
  description?: string;
}

export interface CreatePartInput {
  product_ids: string[];
  name: string;
  print_time_minutes: number;
  material_grams: number;
  parts_per_print: number;
  color?: string;
  material_type: string;
  low_stock_threshold: number;
}

export interface CreateOrderInput {
  product_id: string;
  quantity: number;
  priority: OrderPriority;
  due_date?: string;
  notes?: string;
}

export interface LogPrintInput {
  print_job_id: string;
  quantity_completed: number;
  quantity_failed: number;
  printer_id?: string;
  notes?: string;
}

// API Response Types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
