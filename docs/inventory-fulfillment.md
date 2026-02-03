# Inventory-Based Order Fulfillment System

This document explains how the inventory-based fulfillment system works, including automatic print tracking via Bambu Lab printers.

## Overview

The system decouples prints from specific orders. Instead of tracking "print job X for order Y", prints add parts to a general inventory pool. Orders consume from this inventory automatically using FIFO (First In, First Out) allocation.

### Key Benefits

- **Flexible Production**: Print parts without being tied to a specific order
- **Automatic Fulfillment**: Orders auto-complete when all parts are allocated
- **Hands-Free Tracking**: Bambu printers automatically update inventory on print completion
- **Demand-Based Scheduling**: Schedule page shows what needs printing based on actual demand minus available inventory

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Print Completion                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Bambu Printer ──MQTT──> Python Service ──> Supabase                   │
│        │                       │                  │                      │
│        │                       │                  ▼                      │
│        │                       │         ┌──────────────────┐           │
│        │                       │         │ inventory_print_ │           │
│        │                       │         │      log         │           │
│        │                       │         └────────┬─────────┘           │
│        │                       │                  │                      │
│        │                       │                  ▼                      │
│        │                       │         ┌──────────────────┐           │
│        │                       │         │    inventory     │           │
│        │                       │         │  (quantity +N)   │           │
│        │                       │         └────────┬─────────┘           │
│        │                       │                  │                      │
│        │                       │                  ▼ [DB Trigger]        │
│        │                       │         ┌──────────────────┐           │
│        │                       │         │ Auto-allocate to │           │
│        │                       │         │ waiting orders   │           │
│        │                       │         │     (FIFO)       │           │
│        │                       │         └──────────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           Order Creation                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Dashboard ──> Create Order ──> order_part_allocations (per part)      │
│                      │                                                   │
│                      ▼                                                   │
│             Check existing inventory                                     │
│                      │                                                   │
│                      ▼                                                   │
│             Allocate what's available                                    │
│             (remaining creates demand)                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Database Tables

### `gcode_part_mappings`

Maps Bambu gcode filenames to parts for automatic tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| gcode_filename | TEXT | Exact filename (e.g., `iPad_Holder_v2.gcode`) |
| part_id | UUID | Foreign key to parts table |
| is_active | BOOLEAN | Whether this mapping is active |
| created_at | TIMESTAMP | Creation timestamp |

**Important**: Filenames must match exactly (case-insensitive). If you have `kiosk_plates_plate_7.3mf` and `kiosk_plates_plate_6.3mf` as different parts, each needs its own mapping.

### `order_part_allocations`

Tracks which parts are allocated/reserved for which orders.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| production_order_id | UUID | Foreign key to production_orders |
| part_id | UUID | Foreign key to parts |
| quantity_needed | INTEGER | Parts needed for this order |
| quantity_allocated | INTEGER | Parts reserved from inventory |
| status | TEXT | `pending`, `partially_allocated`, `allocated` |

### `inventory_print_log`

Standalone print tracking (not tied to orders).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| part_id | UUID | Part that was printed |
| printer_id | UUID | Printer used (optional) |
| gcode_filename | TEXT | Original gcode filename |
| quantity_printed | INTEGER | Parts produced |
| status | TEXT | `success` or `failed` |
| source | TEXT | `bambu_auto` or `manual` |
| completed_at | TIMESTAMP | When the print finished |

### Modified: `production_orders`

Added fulfillment tracking columns:

| Column | Type | Description |
|--------|------|-------------|
| fulfillment_status | TEXT | `unfulfilled`, `partially_fulfilled`, `fulfilled` |
| fulfilled_at | TIMESTAMP | When fully fulfilled |

## Components

### Python Service (bambu-service)

The Python service connects to Bambu printers via MQTT and detects print completions.

**Location**: `bambu-service/`

**Key files**:
- `event_handlers.py` - Handles MQTT events, tracks gcode filename
- `supabase_writer.py` - Contains `record_print_completion()` method

**Flow**:
1. On print start: Store the gcode filename from MQTT data
2. On print finish (FINISH event):
   - Look up gcode filename in `gcode_part_mappings` (exact match)
   - Get `parts_per_print` from the part
   - Insert into `inventory_print_log`
   - Increment inventory (triggers auto-allocation)

**Running the service**:
```bash
cd bambu-service
python main.py
```

Requires environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- Bambu printer credentials (configured in dashboard)

### Frontend Pages

#### Schedule Page (`/dashboard/schedule`)

Shows parts that need printing based on demand minus inventory.

- Groups parts by priority (critical > rush > normal)
- Shows deficit and prints required
- "Log Print" button for manual tracking
- Warns if orders exist without allocations (legacy)

#### Order Detail Page (`/dashboard/orders/[id]`)

Shows fulfillment progress based on allocations.

- Progress bar shows `quantity_allocated / quantity_needed`
- Individual part allocation breakdown
- Shows how many prints are still needed per part

#### Parts Page (`/dashboard/parts`)

Manage gcode mappings for each part.

- Click the Gcode column to add/remove mappings
- Green checkmark = mapping configured
- Yellow warning = no mapping (auto-tracking won't work)

#### Inventory Page (`/dashboard/inventory`)

View and manage inventory levels.

- "Log Print" button to manually record completed prints
- Shows available vs reserved quantities

## FIFO Allocation Logic

When inventory increases (either from auto-detection or manual logging):

1. Get available inventory (on_hand - reserved)
2. Query unfulfilled orders sorted by:
   - Priority (critical first, then rush, then normal)
   - Creation date (oldest first within same priority)
3. For each order:
   - Calculate unallocated need for each part
   - Allocate available inventory
   - Update `quantity_reserved` in inventory
   - Update `quantity_allocated` in allocations
4. If all parts allocated, mark order as fulfilled

## Manual vs Automatic Tracking

### Automatic (Bambu Integration)

- Requires Python service running locally
- Requires gcode mapping configured for the part
- Zero user intervention needed

### Manual

- Works from Schedule or Inventory pages
- Click "Log Print" and enter count
- Good for non-Bambu printers or failed auto-detection

## Setup Checklist

1. **Database Migration**: Run `006_inventory_fulfillment.sql`
2. **Gcode Mappings**: Configure for each part via Parts page
3. **Python Service**: Ensure running with correct credentials
4. **Printer Configuration**: Link printers via dashboard Settings

## Troubleshooting

### "All caught up!" but orders exist

Orders created before the migration don't have allocations. Either:
- Cancel and recreate the orders
- Wait for automatic migration (future feature)

### Auto-tracking not working

1. Check Python service is running
2. Verify gcode mapping exists for the part (exact filename match)
3. Check printer is linked in dashboard
4. Review Python service logs for errors

### Fulfillment stuck at partial

Check if:
- Inventory is actually available
- The `allocate_inventory_to_orders` trigger is working
- No database errors in Supabase logs
