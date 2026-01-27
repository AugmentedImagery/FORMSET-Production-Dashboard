import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

// Verify Shopify webhook signature
function verifyShopifyWebhook(body: string, signature: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return false;

  const hmac = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body and signature
    const body = await request.text();
    const signature = request.headers.get('x-shopify-hmac-sha256');
    const topic = request.headers.get('x-shopify-topic');
    const shopifyOrderId = request.headers.get('x-shopify-order-id');

    // Verify signature
    if (!signature || !verifyShopifyWebhook(body, signature)) {
      console.error('Invalid Shopify webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const data = JSON.parse(body);
    const supabase = await createServiceClient();

    // Handle different webhook topics
    switch (topic) {
      case 'orders/create': {
        await handleOrderCreate(supabase, data);
        break;
      }
      case 'orders/cancelled': {
        await handleOrderCancelled(supabase, data);
        break;
      }
      case 'orders/fulfilled': {
        // Optional: Update order status when fulfilled externally
        break;
      }
      default:
        console.log(`Unhandled webhook topic: ${topic}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleOrderCreate(supabase: Awaited<ReturnType<typeof createServiceClient>>, order: ShopifyOrder) {
  // Get line items that map to our products
  for (const item of order.line_items) {
    // Look up product mapping
    const { data: mapping } = await supabase
      .from('shopify_product_mappings')
      .select('product_id')
      .or(`shopify_product_id.eq.${item.product_id},shopify_variant_id.eq.${item.variant_id}`)
      .single();

    if (!mapping) {
      console.log(`No mapping found for Shopify product ${item.product_id}`);
      continue;
    }

    // Determine priority based on shipping method or tags
    let priority: 'normal' | 'rush' | 'critical' = 'normal';
    if (order.tags?.toLowerCase().includes('rush')) {
      priority = 'rush';
    } else if (order.tags?.toLowerCase().includes('critical')) {
      priority = 'critical';
    }

    // Create production order
    const { data: productionOrder, error: orderError } = await supabase
      .from('production_orders')
      .insert({
        source: 'shopify',
        shopify_order_id: order.id.toString(),
        shopify_order_number: order.order_number?.toString() || order.name,
        product_id: mapping.product_id,
        quantity: item.quantity,
        priority,
        status: 'pending',
        notes: `Shopify order: ${order.name}\nCustomer: ${order.customer?.email || 'Unknown'}`,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Failed to create production order:', orderError);
      continue;
    }

    // Get all parts for this product via junction table
    const { data: productParts } = await supabase
      .from('product_parts')
      .select('part:parts(*)')
      .eq('product_id', mapping.product_id);

    if (!productParts || productParts.length === 0) continue;

    // Extract parts from the junction result and create print jobs
    const printJobs: { production_order_id: string; part_id: string; quantity_needed: number; status: 'queued' }[] = [];

    for (const pp of productParts) {
      const part = pp.part as unknown as { id: string; parts_per_print: number } | null;
      if (part) {
        printJobs.push({
          production_order_id: productionOrder.id,
          part_id: part.id,
          quantity_needed: Math.ceil(item.quantity / part.parts_per_print),
          status: 'queued' as const,
        });
      }
    }

    if (printJobs.length === 0) continue;

    await supabase.from('print_jobs').insert(printJobs);
  }

  console.log(`Created production order(s) for Shopify order ${order.name}`);
}

async function handleOrderCancelled(supabase: Awaited<ReturnType<typeof createServiceClient>>, order: ShopifyOrder) {
  // Find and cancel associated production orders
  const { data: productionOrders } = await supabase
    .from('production_orders')
    .select('id, status')
    .eq('shopify_order_id', order.id.toString());

  if (!productionOrders) return;

  for (const po of productionOrders) {
    // Only cancel if not already completed
    if (po.status !== 'completed') {
      await supabase
        .from('production_orders')
        .update({
          status: 'cancelled',
          notes: 'Cancelled: Shopify order was cancelled',
        })
        .eq('id', po.id);

      // Also cancel any pending print jobs
      await supabase
        .from('print_jobs')
        .update({ status: 'failed' })
        .eq('production_order_id', po.id)
        .in('status', ['queued', 'printing']);
    }
  }

  console.log(`Cancelled production order(s) for Shopify order ${order.id}`);
}

// Shopify order types (simplified)
interface ShopifyOrder {
  id: number;
  name: string;
  order_number?: number;
  tags?: string;
  customer?: {
    email?: string;
  };
  line_items: {
    product_id: number;
    variant_id: number;
    quantity: number;
    title: string;
  }[];
}
