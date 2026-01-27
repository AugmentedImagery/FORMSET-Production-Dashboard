# FORMSET Production Dashboard

A comprehensive production management system for 3D printing operations, designed to track orders, manage inventory, schedule print jobs, and monitor production metrics.

## Features

### Dashboard
- Real-time overview of production status
- Pending and in-production order counts
- Total parts in stock with low-stock alerts
- Print success rate tracking (last 30 days)
- Recent orders list
- Active print jobs timeline

### Production Orders
- Create and manage production orders
- Track order status (pending, in_production, completed, cancelled)
- Shopify webhook integration for automatic order creation
- Order details with associated print jobs
- Cancel orders with automatic inventory release

### Print Job Management
- Queue and track print jobs
- Log print completions with success/failure counts
- Assign jobs to specific printers
- Auto-scheduling algorithm for optimal printer utilization
- Print history tracking with material usage

### Inventory Management
- Real-time stock level monitoring
- Low stock alerts and thresholds
- Manual inventory adjustments with audit logging
- Reserved quantity tracking for active orders

### Parts & Products
- Manage parts with print specifications (time, material, parts per print)
- Many-to-many relationship: parts can belong to multiple products
- Product catalog management (kiosk vs planter types)
- Duplicate parts for quick creation

### Printer Management
- Register and manage 3D printers
- Track printer status (idle, printing, maintenance, offline)
- Set daily operating hours for scheduling

### Analytics
- Production metrics over configurable time periods
- Daily production charts
- Success/failure rate tracking
- Material usage statistics

### Authentication & Authorization
- User authentication via Supabase Auth
- Role-based access control (admin, manager, viewer)
- Protected routes with middleware

## Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) with App Router
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Authentication**: Supabase Auth
- **State Management**: [TanStack Query](https://tanstack.com/query) (React Query)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Charts**: [Recharts](https://recharts.org/)
- **Notifications**: [Sonner](https://sonner.emilkowal.ski/)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account and project

### Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: Shopify webhook verification
SHOPIFY_WEBHOOK_SECRET=your_shopify_webhook_secret
```

### Database Setup

1. Create a new Supabase project
2. Run the migration files in order:
   ```bash
   # In Supabase SQL Editor, run each file:
   supabase/migrations/001_initial_schema.sql
   supabase/migrations/002_rls_policies.sql
   supabase/migrations/003_print_history_quantity.sql
   supabase/migrations/004_product_parts_junction.sql
   ```

### Installation

```bash
# Clone the repository
git clone https://github.com/AugmentedImagery/FORMSET-Production-Dashboard.git

# Navigate to project directory
cd FORMSET-Production-Dashboard

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### First-Time Setup

1. Register an admin user at `/register`
2. In Supabase, set the user's role to 'admin' in the `user_profiles` table
3. Create your products (kiosk or planter types)
4. Add parts associated with each product
5. Optionally register your 3D printers

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Authentication pages
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/         # Protected dashboard routes
│   │   └── dashboard/
│   │       ├── analytics/
│   │       ├── inventory/
│   │       ├── orders/
│   │       ├── parts/
│   │       ├── printers/
│   │       ├── schedule/
│   │       └── settings/
│   └── api/
│       └── webhooks/shopify/ # Shopify webhook handler
├── components/
│   ├── auth/                # Authentication components
│   ├── dashboard/           # Dashboard-specific components
│   ├── providers/           # Context providers
│   └── ui/                  # shadcn/ui components
├── hooks/                   # Custom React hooks
│   ├── useAuth.ts
│   ├── useDashboard.ts
│   ├── useInventory.ts
│   ├── useOrders.ts
│   ├── useParts.ts
│   ├── usePrintJobs.ts
│   ├── usePrinters.ts
│   └── useSchedule.ts
├── lib/
│   ├── scheduling.ts        # Auto-scheduling algorithm
│   ├── supabase/           # Supabase client configuration
│   └── utils.ts
└── types/
    └── database.ts          # TypeScript type definitions
```

## API Integration

### Shopify Webhooks

The application supports Shopify webhook integration for automatic order creation:

1. Configure a webhook in your Shopify admin pointing to:
   ```
   https://your-domain.com/api/webhooks/shopify
   ```

2. Subscribe to the following topics:
   - `orders/create` - Creates production orders
   - `orders/cancelled` - Cancels associated production orders

3. Set up product mappings in the `shopify_product_mappings` table to link Shopify products/variants to your internal products.

## Database Schema

### Core Tables

- **products** - Product catalog (kiosk, planter types)
- **parts** - Individual printable components
- **product_parts** - Junction table for many-to-many part-product relationships
- **inventory** - Stock levels for each part
- **printers** - 3D printer registry
- **production_orders** - Customer orders
- **print_jobs** - Individual print tasks
- **print_history** - Completed print records
- **inventory_adjustments** - Audit log for stock changes
- **user_profiles** - Extended user information with roles

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in Vercel
3. Configure environment variables
4. Deploy

### Other Platforms

The application can be deployed to any platform that supports Next.js:
- AWS Amplify
- Netlify
- Railway
- Self-hosted with Docker

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software developed for FORMSET.

## Support

For issues and feature requests, please use the GitHub Issues page.
