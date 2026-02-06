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
export type FulfillmentStatus = 'unfulfilled' | 'partially_fulfilled' | 'fulfilled';
export type AllocationStatus = 'pending' | 'partially_allocated' | 'allocated';
export type PrintLogSource = 'bambu_auto' | 'manual';

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  type: ProductType;
  description: string | null;
  image_url: string | null;
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
  // Fulfillment tracking
  fulfillment_status: FulfillmentStatus;
  fulfilled_at: string | null;
  // Joined fields
  product?: Product;
  print_jobs?: PrintJob[];
  allocations?: OrderPartAllocation[];
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
  bambu_access_token: string | null;
  last_heartbeat: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  current_job?: PrintJob;
  bambu_state?: BambuPrinterState;
}

// Bambu Lab real-time printer state (from bambu_printer_state table)
export interface BambuPrinterState {
  id: string;
  printer_id: string;
  // Status
  print_stage: string | null;
  gcode_state: string | null;
  // Temperatures (Celsius)
  nozzle_temp: number | null;
  nozzle_target: number | null;
  bed_temp: number | null;
  bed_target: number | null;
  chamber_temp: number | null;
  // Print Progress
  print_percent: number | null;
  current_layer: number | null;
  total_layers: number | null;
  time_remaining_min: number | null;
  // Current Job Info
  subtask_name: string | null;
  gcode_file: string | null;
  // AMS Status
  ams_status: Record<string, unknown> | null;
  // Connectivity
  wifi_signal: number | null;
  online: boolean;
  // Timestamps
  updated_at: string;
  created_at: string;
}

// Gcode filename to part mapping for automatic inventory tracking
export interface GcodePartMapping {
  id: string;
  gcode_filename: string;
  part_id: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  part?: Part;
}

// Order part allocation for inventory-based fulfillment
export interface OrderPartAllocation {
  id: string;
  production_order_id: string;
  part_id: string;
  quantity_needed: number;
  quantity_allocated: number;
  status: AllocationStatus;
  created_at: string;
  updated_at: string;
  // Joined fields
  part?: Part;
  production_order?: ProductionOrder;
}

// Standalone print log (not tied to specific orders)
export interface InventoryPrintLog {
  id: string;
  part_id: string;
  printer_id: string | null;
  gcode_filename: string | null;
  quantity_printed: number;
  status: 'success' | 'failed';
  source: PrintLogSource;
  started_at: string | null;
  completed_at: string;
  failure_reason: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  // Joined fields
  part?: Part;
  printer?: Printer;
}

// Part demand calculation (from database view)
export interface PartDemand {
  part_id: string;
  part_name: string;
  parts_per_print: number;
  print_time_minutes: number;
  total_demand: number;
  available_inventory: number;
  deficit: number;
  prints_required: number;
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
export interface StockLevel {
  id: string;
  name: string;
  quantity: number;
}

export interface ProductionQueueItem {
  id: string;
  part: Part;
  quantity_needed: number;
  quantity_completed: number;
  order_count: number;
}

export interface DashboardStats {
  pendingOrders: number;
  inProductionOrders: number;
  totalPartsInStock: number;
  printSuccessRate: number;
  lowStockParts: Part[];
  stockLevels: StockLevel[];
  recentOrders: ProductionOrder[];
  productionQueue: ProductionQueueItem[];
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

// Input for logging prints to inventory (new system)
export interface LogInventoryPrintInput {
  part_id: string;
  quantity_printed: number;
  status: 'success' | 'failed';
  printer_id?: string;
  gcode_filename?: string;
  failure_reason?: string;
  notes?: string;
}

// Input for creating gcode mappings
export interface CreateGcodeMappingInput {
  gcode_filename: string;
  part_id: string;
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
