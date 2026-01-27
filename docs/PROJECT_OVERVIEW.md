# FORMSET Production Dashboard - Project Overview

This document provides a comprehensive overview of the FORMSET Production Dashboard architecture, design decisions, and implementation details.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Design](#database-design)
3. [Authentication & Authorization](#authentication--authorization)
4. [Core Features](#core-features)
5. [Data Flow](#data-flow)
6. [Auto-Scheduling Algorithm](#auto-scheduling-algorithm)
7. [Shopify Integration](#shopify-integration)
8. [State Management](#state-management)
9. [UI/UX Design](#uiux-design)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Browser                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Next.js Frontend                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │  Dashboard  │  │   Orders    │  │  Inventory  │      │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │   Parts     │  │  Schedule   │  │  Analytics  │      │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js API Routes                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              /api/webhooks/shopify                        │   │
│  │              (Shopify order webhooks)                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Supabase                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  PostgreSQL  │  │     Auth     │  │   Storage    │          │
│  │   Database   │  │   Service    │  │  (Optional)  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────────────────────────────────────────┐          │
│  │            Row Level Security (RLS)               │          │
│  └──────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
│  ┌──────────────────────────────────────────────────┐          │
│  │                 Shopify Store                      │          │
│  │          (Sends webhooks on order events)         │          │
│  └──────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Choices

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Next.js 14 (App Router) | Server components, file-based routing, excellent DX |
| Database | Supabase (PostgreSQL) | Real-time subscriptions, built-in auth, RLS |
| State | TanStack Query | Caching, refetching, optimistic updates |
| Styling | Tailwind CSS | Utility-first, rapid development |
| Components | shadcn/ui | Accessible, customizable, not a dependency |

---

## Database Design

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│  products   │       │  product_parts  │       │    parts    │
├─────────────┤       ├─────────────────┤       ├─────────────┤
│ id (PK)     │◄──────│ product_id (FK) │       │ id (PK)     │
│ name        │       │ part_id (FK)    │──────►│ name        │
│ type        │       │ created_at      │       │ print_time  │
│ description │       └─────────────────┘       │ material_g  │
│ sku         │           Many-to-Many          │ parts_per   │
│ active      │                                 │ color       │
└─────────────┘                                 │ material    │
      │                                         │ threshold   │
      │                                         └─────────────┘
      │                                               │
      ▼                                               ▼
┌─────────────────┐                           ┌─────────────┐
│production_orders│                           │  inventory  │
├─────────────────┤                           ├─────────────┤
│ id (PK)         │                           │ id (PK)     │
│ product_id (FK) │                           │ part_id(FK) │
│ order_number    │                           │ qty_on_hand │
│ quantity        │                           │ qty_reserved│
│ status          │                           │ last_updated│
│ priority        │                           └─────────────┘
│ due_date        │                                 │
│ source          │                                 ▼
│ customer_name   │                           ┌─────────────────┐
│ completed_at    │                           │inv_adjustments  │
└─────────────────┘                           ├─────────────────┤
      │                                       │ id (PK)         │
      │                                       │ part_id (FK)    │
      ▼                                       │ prev_quantity   │
┌─────────────────┐                           │ new_quantity    │
│   print_jobs    │                           │ adjustment_type │
├─────────────────┤                           │ reason          │
│ id (PK)         │                           │ created_by      │
│ order_id (FK)   │                           └─────────────────┘
│ part_id (FK)    │
│ printer_id (FK) │──────────────────────────►┌─────────────┐
│ quantity_needed │                           │  printers   │
│ qty_completed   │                           ├─────────────┤
│ qty_failed      │                           │ id (PK)     │
│ status          │                           │ name        │
│ scheduled_start │                           │ model       │
│ actual_start    │                           │ status      │
│ actual_end      │                           │ start_hour  │
└─────────────────┘                           │ end_hour    │
      │                                       │ notes       │
      ▼                                       └─────────────┘
┌─────────────────┐
│  print_history  │
├─────────────────┤
│ id (PK)         │
│ print_job_id    │
│ printer_id      │
│ part_id         │
│ status          │
│ quantity        │
│ started_at      │
│ ended_at        │
│ failure_reason  │
│ material_used   │
└─────────────────┘
```

### Key Design Decisions

#### Many-to-Many Parts-Products Relationship

Parts can belong to multiple products via the `product_parts` junction table. This allows:
- Shared components across product variants (e.g., a reservoir used in all planter colors)
- Flexible product composition
- Accurate inventory tracking across all products using a shared part

```sql
-- Example: Get all parts for a product
SELECT p.* FROM parts p
JOIN product_parts pp ON p.id = pp.part_id
WHERE pp.product_id = 'product-uuid';
```

#### Inventory Tracking

The inventory system tracks:
- `quantity_on_hand`: Total physical stock
- `quantity_reserved`: Stock allocated to active orders
- `available = quantity_on_hand - quantity_reserved`

When orders are created, inventory is reserved. When orders complete or are cancelled, reserved inventory is adjusted accordingly.

#### Print History Quantity Tracking

Print history records include a `quantity` field to accurately track:
- How many parts were printed in a single session
- Material usage per batch
- Success/failure rates by quantity, not just by print session

---

## Authentication & Authorization

### Authentication Flow

```
┌────────────┐     ┌────────────┐     ┌────────────┐
│   Login    │────►│  Supabase  │────►│   Session  │
│   Page     │     │    Auth    │     │   Cookie   │
└────────────┘     └────────────┘     └────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────┐
│                    Middleware                           │
│  1. Refresh session via getUser()                      │
│  2. Check route protection                              │
│  3. Redirect based on auth state                        │
│     - / → /dashboard (authenticated)                    │
│     - / → /login (unauthenticated)                      │
│     - /dashboard/* → /login (unauthenticated)           │
│     - /login → /dashboard (authenticated)               │
└────────────────────────────────────────────────────────┘
```

### Role-Based Access Control

| Role | Permissions |
|------|-------------|
| admin | Full access: create, read, update, delete all entities |
| manager | Create orders, manage print jobs, update inventory |
| viewer | Read-only access to all dashboards |

Roles are stored in the `user_profiles` table and checked via the `useAuth` hook:

```typescript
const { user, role, isAdmin, canEdit } = useAuth();

// canEdit = role === 'admin' || role === 'manager'
```

### Row Level Security (RLS)

All tables have RLS policies that:
- Allow authenticated users to read data
- Restrict write operations based on user role
- Enable service role bypass for webhook processing

---

## Core Features

### 1. Dashboard

The dashboard provides at-a-glance production metrics:

```typescript
interface DashboardStats {
  pendingOrders: number;
  inProductionOrders: number;
  totalPartsInStock: number;
  printSuccessRate: number;
  lowStockParts: Part[];
  recentOrders: ProductionOrder[];
  activeJobs: PrintJob[];
}
```

Data is fetched via the `useDashboardStats()` hook with 30-second auto-refresh.

### 2. Production Orders

Orders flow through these statuses:

```
pending → in_production → completed
                      ↘ cancelled
```

When an order is created:
1. Order record is inserted
2. Print jobs are created for each associated part
3. Inventory is reserved based on quantity needed

### 3. Print Jobs

Print jobs track the manufacturing of individual parts:

```typescript
interface PrintJob {
  id: string;
  production_order_id: string;
  part_id: string;
  printer_id: string | null;
  quantity_needed: number;
  quantity_completed: number;
  quantity_failed: number;
  status: 'queued' | 'printing' | 'completed' | 'failed';
  scheduled_start: string | null;
  actual_start: string | null;
  actual_end: string | null;
}
```

### 4. Inventory Management

Inventory operations:
- **View**: Real-time stock levels with status indicators
- **Adjust**: Manual adjustments with reason logging
- **Reserve**: Automatic reservation when orders are created
- **Release**: Automatic release when orders complete/cancel

---

## Data Flow

### Order Creation Flow

```
┌──────────────┐
│ Create Order │
│    Form      │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ useCreateOrder mutation                       │
│  1. Insert production_order                   │
│  2. Query product_parts for associated parts  │
│  3. Create print_jobs for each part           │
│  4. Reserve inventory                         │
└──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ Query Invalidation                            │
│  - orders, print_jobs, inventory, dashboard   │
└──────────────────────────────────────────────┘
```

### Print Logging Flow

```
┌──────────────┐
│  Log Print   │
│   Dialog     │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ useLogPrint mutation                          │
│  1. Update print_job quantities               │
│  2. Create print_history records              │
│  3. Check if job is complete                  │
│  4. If all jobs complete → update order       │
└──────────────────────────────────────────────┘
```

---

## Auto-Scheduling Algorithm

The scheduling system optimizes print job distribution across printers.

### Algorithm Overview

```typescript
function autoScheduleJobs(jobs: PrintJob[], printers: Printer[]): Schedule {
  // 1. Filter available printers (status = 'idle' or 'printing')
  // 2. Sort jobs by priority (order due_date, then creation time)
  // 3. For each job:
  //    a. Find printer with earliest availability
  //    b. Calculate start time based on operating hours
  //    c. Calculate end time based on print duration
  //    d. Assign job to printer
  // 4. Return scheduled jobs with time slots
}
```

### Scheduling Constraints

- **Operating Hours**: Each printer has configurable start/end hours
- **Sequential Printing**: One job per printer at a time
- **Priority**: Orders with earlier due dates are scheduled first
- **Work Hours**: Jobs don't start outside printer operating hours

### Schedule Output

```typescript
interface ScheduledJob {
  job: PrintJob;
  printer: Printer;
  scheduledStart: Date;
  scheduledEnd: Date;
  dayIndex: number;  // 0 = today, 1 = tomorrow, etc.
}

interface DailySchedule {
  date: Date;
  printerSchedules: Map<string, ScheduledJob[]>;
}
```

---

## Shopify Integration

### Webhook Handler

```typescript
// POST /api/webhooks/shopify
async function handler(request: Request) {
  // 1. Verify webhook signature (HMAC-SHA256)
  // 2. Parse webhook topic from headers
  // 3. Route to appropriate handler:
  //    - orders/create → handleOrderCreated
  //    - orders/cancelled → handleOrderCancelled
}
```

### Product Mapping

Shopify products are mapped to internal products via the `shopify_product_mappings` table:

```sql
CREATE TABLE shopify_product_mappings (
  id UUID PRIMARY KEY,
  shopify_product_id BIGINT NOT NULL,
  shopify_variant_id BIGINT,
  product_id UUID REFERENCES products(id),
  UNIQUE(shopify_product_id, shopify_variant_id)
);
```

### Order Processing

When a Shopify order is received:
1. Extract line items from webhook payload
2. Look up product mappings for each item
3. Create production order with customer info
4. Create print jobs for all parts
5. Reserve inventory

---

## State Management

### TanStack Query Setup

```typescript
// Query keys follow a hierarchical pattern
const queryKeys = {
  orders: ['orders'],
  orderById: (id: string) => ['orders', id],
  printJobs: ['print_jobs'],
  printJobsByStatus: (status: string) => ['print_jobs', status],
  inventory: ['inventory'],
  dashboardStats: ['dashboard_stats'],
};
```

### Query Invalidation Strategy

After mutations, related queries are invalidated to ensure data consistency:

```typescript
// After creating an order
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['orders'] });
  queryClient.invalidateQueries({ queryKey: ['print_jobs'] });
  queryClient.invalidateQueries({ queryKey: ['inventory'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
}
```

### Auto-Refresh

- Dashboard stats: 30 second interval
- Active print jobs: Manual refresh on user action

---

## UI/UX Design

### Design Principles

1. **Information Density**: Show relevant data without overwhelming
2. **Status Visibility**: Clear visual indicators for all statuses
3. **Quick Actions**: Common operations accessible in 1-2 clicks
4. **Responsive**: Functional on desktop and tablet

### Color Coding

| Status | Color | Usage |
|--------|-------|-------|
| Pending | Yellow/Orange | Orders waiting to start |
| In Production | Blue | Active orders/jobs |
| Completed | Green | Finished items |
| Cancelled/Failed | Red | Errors or cancellations |
| Low Stock | Orange | Inventory warnings |
| Out of Stock | Red | Critical inventory |

### Component Library

Built with shadcn/ui for consistency:
- Cards for data grouping
- Tables for list views
- Dialogs for forms
- Badges for status indicators
- Progress bars for stock levels
- Toast notifications for feedback

---

## Future Considerations

### Potential Enhancements

1. **Real-time Updates**: Supabase real-time subscriptions for live data
2. **Printer Integration**: Direct API connection to 3D printers
3. **Barcode Scanning**: Quick inventory updates via mobile
4. **Reporting**: Exportable production reports
5. **Multi-tenant**: Support for multiple organizations

### Scalability

The current architecture supports:
- Horizontal scaling via serverless deployment
- Database connection pooling via Supabase
- CDN caching for static assets
- Query result caching via TanStack Query
