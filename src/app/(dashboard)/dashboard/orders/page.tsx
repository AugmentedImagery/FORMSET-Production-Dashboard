'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { useOrders, useCreateOrder, useUpdateOrderStatus, useUpdateOrder } from '@/hooks/useOrders';
import { useProducts } from '@/hooks/useParts';
import { ProductionOrder } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Search,
  MoreVertical,
  ShoppingBag,
  Building2,
  AlertTriangle,
  Loader2,
  Eye,
  Play,
  CheckCircle,
  XCircle,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { OrderStatus, OrderPriority } from '@/types/database';

function CreateOrderDialog() {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [priority, setPriority] = useState<OrderPriority>('normal');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const { data: products } = useProducts();
  const createOrder = useCreateOrder();

  const handleSubmit = async () => {
    if (!productId) {
      toast.error('Please select a product');
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      toast.error('Please enter a valid quantity');
      return;
    }

    try {
      await createOrder.mutateAsync({
        product_id: productId,
        quantity: qty,
        priority,
        due_date: dueDate || undefined,
        notes: notes || undefined,
      });
      toast.success('Order created successfully');
      setOpen(false);
      // Reset form
      setProductId('');
      setQuantity('1');
      setPriority('normal');
      setDueDate('');
      setNotes('');
    } catch {
      toast.error('Failed to create order');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Order
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Production Order</DialogTitle>
          <DialogDescription>
            Create a new internal production order
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="product">Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products?.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as OrderPriority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="rush">Rush</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date (optional)</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              placeholder="Any special instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createOrder.isPending}>
            {createOrder.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditOrderDialogProps {
  open: boolean;
  onClose: () => void;
  order: ProductionOrder;
}

function EditOrderDialog({ open, onClose, order }: EditOrderDialogProps) {
  const [quantity, setQuantity] = useState(order.quantity.toString());
  const [priority, setPriority] = useState<OrderPriority>(order.priority);
  const [dueDate, setDueDate] = useState(
    order.due_date ? format(new Date(order.due_date), 'yyyy-MM-dd') : ''
  );
  const [notes, setNotes] = useState(order.notes || '');

  const updateOrder = useUpdateOrder();

  const handleSubmit = async () => {
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      toast.error('Please enter a valid quantity');
      return;
    }

    try {
      await updateOrder.mutateAsync({
        id: order.id,
        quantity: qty,
        priority,
        due_date: dueDate || null,
        notes: notes.trim() || null,
      });
      toast.success('Order updated successfully');
      onClose();
    } catch {
      toast.error('Failed to update order');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Order</DialogTitle>
          <DialogDescription>
            Update order {order.shopify_order_number || order.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-quantity">Quantity</Label>
            <Input
              id="edit-quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-priority">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as OrderPriority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="rush">Rush</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-dueDate">Due Date</Label>
            <Input
              id="edit-dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Input
              id="edit-notes"
              placeholder="Any special instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateOrder.isPending}>
            {updateOrder.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function OrdersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingOrder, setEditingOrder] = useState<ProductionOrder | null>(null);
  const { canEdit } = useAuth();
  const { data: orders, isLoading } = useOrders();
  const updateStatus = useUpdateOrderStatus();

  const filteredOrders = orders?.filter((order) => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesSearch =
      order.product?.name.toLowerCase().includes(search.toLowerCase()) ||
      order.shopify_order_number?.toLowerCase().includes(search.toLowerCase()) ||
      order.id.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'in_production':
        return 'bg-[#999184]/20 text-[#7a756a]';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateStatus.mutateAsync({ id: orderId, status: newStatus });
      toast.success(`Order marked as ${newStatus.replace('_', ' ')}`);
    } catch {
      toast.error('Failed to update order status');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
            <p className="text-gray-500">Manage production orders</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Count orders by status
  const statusCounts = {
    all: orders?.length || 0,
    pending: orders?.filter((o) => o.status === 'pending').length || 0,
    in_production: orders?.filter((o) => o.status === 'in_production').length || 0,
    completed: orders?.filter((o) => o.status === 'completed').length || 0,
    cancelled: orders?.filter((o) => o.status === 'cancelled').length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-500">Manage production orders</p>
        </div>
        {canEdit && <CreateOrderDialog />}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Orders with tabs */}
      <Tabs defaultValue="all" onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">
            All ({statusCounts.all})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({statusCounts.pending})
          </TabsTrigger>
          <TabsTrigger value="in_production">
            In Production ({statusCounts.in_production})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({statusCounts.completed})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders?.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="font-mono text-sm text-gray-700 hover:text-gray-900 hover:underline"
                        >
                          {order.shopify_order_number || order.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        {order.product?.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {order.source === 'shopify' ? (
                            <>
                              <ShoppingBag className="h-4 w-4 text-gray-500" />
                              <span className="text-sm">Shopify</span>
                            </>
                          ) : (
                            <>
                              <Building2 className="h-4 w-4 text-gray-500" />
                              <span className="text-sm">Internal</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{order.quantity}</TableCell>
                      <TableCell>
                        {order.priority === 'critical' && (
                          <Badge className="bg-orange-100 text-orange-700">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Critical
                          </Badge>
                        )}
                        {order.priority === 'rush' && (
                          <Badge className="bg-yellow-100 text-yellow-700">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Rush
                          </Badge>
                        )}
                        {order.priority === 'normal' && (
                          <span className="text-sm text-gray-500">Normal</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.due_date
                          ? format(new Date(order.due_date), 'MMM d, yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={getStatusColor(order.status)}
                          variant="secondary"
                        >
                          {order.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(order.created_at), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/orders/${order.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            {canEdit && order.status !== 'completed' && order.status !== 'cancelled' && (
                              <DropdownMenuItem onClick={() => setEditingOrder(order)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit Order
                              </DropdownMenuItem>
                            )}
                            {canEdit && order.status === 'pending' && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleStatusChange(order.id, 'in_production')
                                }
                              >
                                <Play className="mr-2 h-4 w-4" />
                                Start Production
                              </DropdownMenuItem>
                            )}
                            {canEdit && order.status === 'in_production' && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleStatusChange(order.id, 'completed')
                                }
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark Complete
                              </DropdownMenuItem>
                            )}
                            {canEdit && order.status !== 'cancelled' && order.status !== 'completed' && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleStatusChange(order.id, 'cancelled')
                                }
                                className="text-orange-600"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancel Order
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredOrders?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        No orders found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      {editingOrder && (
        <EditOrderDialog
          key={editingOrder.id}
          open={!!editingOrder}
          onClose={() => setEditingOrder(null)}
          order={editingOrder}
        />
      )}
    </div>
  );
}
