'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useParts, useProducts, useUpdatePart, useCreatePart, useDeletePart, useCreateProduct, useDeleteProduct, useUploadProductImage, PartWithProduct, UpdatePartInput } from '@/hooks/useParts';
import { useGcodeMappings, useCreateGcodeMapping, useDeleteGcodeMapping } from '@/hooks/useInventoryFulfillment';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Boxes,
  Search,
  Clock,
  Scale,
  Layers,
  Package,
  Edit,
  Loader2,
  Plus,
  Trash2,
  Copy,
  ShoppingBag,
  Upload,
  ImageIcon,
  FileCode,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { CreatePartInput, CreateProductInput, Product, ProductType, GcodePartMapping } from '@/types/database';

interface EditPartDialogProps {
  open: boolean;
  onClose: () => void;
  part: PartWithProduct;
  products: Product[];
  onSave: (data: UpdatePartInput) => Promise<void>;
  isPending: boolean;
}

function EditPartDialog({ open, onClose, part, products, onSave, isPending }: EditPartDialogProps) {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(
    part.products?.map(p => p.id) || []
  );
  const [name, setName] = useState(part.name);
  const [printTime, setPrintTime] = useState(part.print_time_minutes.toString());
  const [materialGrams, setMaterialGrams] = useState(part.material_grams.toString());
  const [partsPerPrint, setPartsPerPrint] = useState(part.parts_per_print.toString());
  const [color, setColor] = useState(part.color || '');
  const [materialType, setMaterialType] = useState(part.material_type);
  const [lowStockThreshold, setLowStockThreshold] = useState(part.low_stock_threshold.toString());

  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSubmit = async () => {
    const printTimeNum = parseInt(printTime);
    const materialGramsNum = parseFloat(materialGrams);
    const partsPerPrintNum = parseInt(partsPerPrint);
    const thresholdNum = parseInt(lowStockThreshold);

    if (selectedProductIds.length === 0) {
      toast.error('Please select at least one product');
      return;
    }
    if (!name.trim()) {
      toast.error('Part name is required');
      return;
    }
    if (isNaN(printTimeNum) || printTimeNum < 1) {
      toast.error('Please enter a valid print time');
      return;
    }
    if (isNaN(materialGramsNum) || materialGramsNum < 0) {
      toast.error('Please enter a valid material weight');
      return;
    }
    if (isNaN(partsPerPrintNum) || partsPerPrintNum < 1) {
      toast.error('Please enter a valid parts per print');
      return;
    }

    await onSave({
      id: part.id,
      product_ids: selectedProductIds,
      name: name.trim(),
      print_time_minutes: printTimeNum,
      material_grams: materialGramsNum,
      parts_per_print: partsPerPrintNum,
      color: color.trim() || null,
      material_type: materialType,
      low_stock_threshold: isNaN(thresholdNum) ? 10 : thresholdNum,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Part</DialogTitle>
          <DialogDescription>
            Update the specifications for {part.name}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Products (click to select)</Label>
            <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[42px]">
              {products.map((product) => {
                const isSelected = selectedProductIds.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggleProduct(product.id)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-[#999184] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {product.name}
                  </button>
                );
              })}
            </div>
            {selectedProductIds.length === 0 && (
              <p className="text-xs text-orange-500">Select at least one product</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Part Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="printTime">Print Time (minutes)</Label>
              <Input
                id="printTime"
                type="number"
                min="1"
                value={printTime}
                onChange={(e) => setPrintTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="materialGrams">Material (grams)</Label>
              <Input
                id="materialGrams"
                type="number"
                min="0"
                step="0.1"
                value={materialGrams}
                onChange={(e) => setMaterialGrams(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="partsPerPrint">Parts Per Print</Label>
              <Input
                id="partsPerPrint"
                type="number"
                min="1"
                value={partsPerPrint}
                onChange={(e) => setPartsPerPrint(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="materialType">Material Type</Label>
              <Select value={materialType} onValueChange={setMaterialType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLA">PLA</SelectItem>
                  <SelectItem value="PETG">PETG</SelectItem>
                  <SelectItem value="ABS">ABS</SelectItem>
                  <SelectItem value="TPU">TPU</SelectItem>
                  <SelectItem value="ASA">ASA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                placeholder="e.g., White, Black, Terracotta"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">Low Stock Threshold</Label>
              <Input
                id="threshold"
                type="number"
                min="0"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AddPartDialogProps {
  open: boolean;
  onClose: () => void;
  products: Product[];
  onSave: (data: CreatePartInput) => Promise<void>;
  isPending: boolean;
}

function AddPartDialog({ open, onClose, products, onSave, isPending }: AddPartDialogProps) {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [printTime, setPrintTime] = useState('60');
  const [materialGrams, setMaterialGrams] = useState('0');
  const [partsPerPrint, setPartsPerPrint] = useState('1');
  const [color, setColor] = useState('');
  const [materialType, setMaterialType] = useState('PLA');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');

  const resetForm = () => {
    setSelectedProductIds([]);
    setName('');
    setPrintTime('60');
    setMaterialGrams('0');
    setPartsPerPrint('1');
    setColor('');
    setMaterialType('PLA');
    setLowStockThreshold('10');
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    const printTimeNum = parseInt(printTime);
    const materialGramsNum = parseFloat(materialGrams);
    const partsPerPrintNum = parseInt(partsPerPrint);
    const thresholdNum = parseInt(lowStockThreshold);

    if (selectedProductIds.length === 0) {
      toast.error('Please select at least one product');
      return;
    }
    if (!name.trim()) {
      toast.error('Part name is required');
      return;
    }
    if (isNaN(printTimeNum) || printTimeNum < 1) {
      toast.error('Please enter a valid print time');
      return;
    }
    if (isNaN(materialGramsNum) || materialGramsNum < 0) {
      toast.error('Please enter a valid material weight');
      return;
    }
    if (isNaN(partsPerPrintNum) || partsPerPrintNum < 1) {
      toast.error('Please enter a valid parts per print');
      return;
    }

    await onSave({
      product_ids: selectedProductIds,
      name: name.trim(),
      print_time_minutes: printTimeNum,
      material_grams: materialGramsNum,
      parts_per_print: partsPerPrintNum,
      color: color.trim() || undefined,
      material_type: materialType,
      low_stock_threshold: isNaN(thresholdNum) ? 10 : thresholdNum,
    });
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Part</DialogTitle>
          <DialogDescription>
            Create a new part for your product catalog
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Products * (click to select)</Label>
            <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[42px]">
              {products.map((product) => {
                const isSelected = selectedProductIds.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggleProduct(product.id)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-[#999184] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {product.name}
                  </button>
                );
              })}
            </div>
            {selectedProductIds.length === 0 && (
              <p className="text-xs text-amber-600">Select at least one product</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-name">Part Name *</Label>
            <Input
              id="add-name"
              placeholder="e.g., Base Plate, Inner Pot"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="add-printTime">Print Time (minutes)</Label>
              <Input
                id="add-printTime"
                type="number"
                min="1"
                value={printTime}
                onChange={(e) => setPrintTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-materialGrams">Material (grams)</Label>
              <Input
                id="add-materialGrams"
                type="number"
                min="0"
                step="0.1"
                value={materialGrams}
                onChange={(e) => setMaterialGrams(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="add-partsPerPrint">Parts Per Print</Label>
              <Input
                id="add-partsPerPrint"
                type="number"
                min="1"
                value={partsPerPrint}
                onChange={(e) => setPartsPerPrint(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-materialType">Material Type</Label>
              <Select value={materialType} onValueChange={setMaterialType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLA">PLA</SelectItem>
                  <SelectItem value="PETG">PETG</SelectItem>
                  <SelectItem value="ABS">ABS</SelectItem>
                  <SelectItem value="TPU">TPU</SelectItem>
                  <SelectItem value="ASA">ASA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="add-color">Color</Label>
              <Input
                id="add-color"
                placeholder="e.g., White, Black, Terracotta"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-threshold">Low Stock Threshold</Label>
              <Input
                id="add-threshold"
                type="number"
                min="0"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Add Part
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AddProductDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateProductInput) => Promise<void>;
  isPending: boolean;
}

interface GcodeMappingsDialogProps {
  open: boolean;
  onClose: () => void;
  partId: string;
  partName: string;
  mappings: GcodePartMapping[];
  onAdd: (filename: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isAdding: boolean;
  isDeleting: boolean;
}

function GcodeMappingsDialog({
  open,
  onClose,
  partId,
  partName,
  mappings,
  onAdd,
  onDelete,
  isAdding,
  isDeleting,
}: GcodeMappingsDialogProps) {
  const [newFilename, setNewFilename] = useState('');

  const handleAdd = async () => {
    if (!newFilename.trim()) {
      toast.error('Please enter a gcode filename');
      return;
    }
    await onAdd(newFilename.trim());
    setNewFilename('');
  };

  const partMappings = mappings.filter(m => m.part_id === partId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Gcode Mappings
          </DialogTitle>
          <DialogDescription>
            Map gcode filenames to {partName} for automatic inventory tracking
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Existing mappings */}
          {partMappings.length > 0 ? (
            <div className="space-y-2">
              <Label>Current Mappings</Label>
              <div className="space-y-2">
                {partMappings.map((mapping) => (
                  <div
                    key={mapping.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border"
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-gray-500" />
                      <span className="font-mono text-sm">{mapping.gcode_filename}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(mapping.id)}
                      disabled={isDeleting}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 bg-yellow-50 rounded-lg border border-yellow-200">
              <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-yellow-600" />
              <p className="text-sm">No gcode mappings configured</p>
              <p className="text-xs text-yellow-700 mt-1">
                Prints won&apos;t auto-track without a mapping
              </p>
            </div>
          )}

          {/* Add new mapping */}
          <div className="space-y-2">
            <Label htmlFor="gcode-filename">Add New Mapping</Label>
            <div className="flex gap-2">
              <Input
                id="gcode-filename"
                placeholder="e.g., planter_base_v2.gcode"
                value={newFilename}
                onChange={(e) => setNewFilename(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <Button onClick={handleAdd} disabled={isAdding || !newFilename.trim()}>
                {isAdding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Enter the gcode filename as it appears on your Bambu printer.
              Partial matches are supported (e.g., &quot;planter_base&quot; will match &quot;planter_base_v2.gcode&quot;).
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddProductDialog({ open, onClose, onSave, isPending }: AddProductDialogProps) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [type, setType] = useState<ProductType>('planter');
  const [description, setDescription] = useState('');

  const resetForm = () => {
    setName('');
    setSku('');
    setType('planter');
    setDescription('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Product name is required');
      return;
    }

    await onSave({
      name: name.trim(),
      sku: sku.trim() || undefined,
      type,
      description: description.trim() || undefined,
    });
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Create a new product to organize your parts
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="product-name">Product Name *</Label>
            <Input
              id="product-name"
              placeholder="e.g., Self-Watering Planter (White)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product-sku">SKU</Label>
              <Input
                id="product-sku"
                placeholder="e.g., PLANTER-WHITE"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ProductType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planter">Planter</SelectItem>
                  <SelectItem value="kiosk">Kiosk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-description">Description</Label>
            <Input
              id="product-description"
              placeholder="Optional product description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Add Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PartsPage() {
  const [productFilter, setProductFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editingPart, setEditingPart] = useState<PartWithProduct | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deletingPart, setDeletingPart] = useState<PartWithProduct | null>(null);
  const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);
  const [gcodeDialogPart, setGcodeDialogPart] = useState<PartWithProduct | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { canEdit } = useAuth();
  const { data: parts, isLoading } = useParts();
  const { data: products } = useProducts();
  const { data: gcodeMappings } = useGcodeMappings();
  const updatePart = useUpdatePart();
  const createPart = useCreatePart();
  const deletePart = useDeletePart();
  const createProduct = useCreateProduct();
  const deleteProduct = useDeleteProduct();
  const uploadProductImage = useUploadProductImage();
  const createGcodeMapping = useCreateGcodeMapping();
  const deleteGcodeMapping = useDeleteGcodeMapping();

  const handleSavePart = async (data: Parameters<typeof updatePart.mutateAsync>[0]) => {
    try {
      await updatePart.mutateAsync(data);
      toast.success('Part updated successfully');
      setEditingPart(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update part';
      toast.error(message);
      console.error('Failed to update part:', error);
    }
  };

  const handleCreatePart = async (data: CreatePartInput) => {
    try {
      await createPart.mutateAsync(data);
      toast.success('Part created successfully');
      setIsAddDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create part';
      toast.error(message);
      console.error('Failed to create part:', error);
    }
  };

  const handleDeletePart = async () => {
    if (!deletingPart) return;
    try {
      await deletePart.mutateAsync(deletingPart.id);
      toast.success('Part deleted successfully');
      setDeletingPart(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete part';
      toast.error(message);
      console.error('Failed to delete part:', error);
    }
  };

  const handleDuplicatePart = async (part: PartWithProduct) => {
    try {
      await createPart.mutateAsync({
        product_ids: part.products?.map(p => p.id) || [],
        name: `${part.name}_copy`,
        print_time_minutes: part.print_time_minutes,
        material_grams: Number(part.material_grams),
        parts_per_print: part.parts_per_print,
        color: part.color || undefined,
        material_type: part.material_type,
        low_stock_threshold: part.low_stock_threshold,
      });
      toast.success(`Duplicated "${part.name}" as "${part.name}_copy"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to duplicate part';
      toast.error(message);
      console.error('Failed to duplicate part:', error);
    }
  };

  const handleCreateProduct = async (data: CreateProductInput) => {
    try {
      await createProduct.mutateAsync(data);
      toast.success('Product created successfully');
      setIsAddProductDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create product';
      toast.error(message);
      console.error('Failed to create product:', error);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    try {
      await deleteProduct.mutateAsync(deletingProduct.id);
      toast.success('Product deleted successfully');
      setDeletingProduct(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete product';
      toast.error(message);
      console.error('Failed to delete product:', error);
    }
  };

  const handleImageUpload = async (productId: string, file: File) => {
    setUploadingProductId(productId);
    try {
      await uploadProductImage.mutateAsync({ productId, file });
      toast.success('Product image uploaded successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload image';
      toast.error(message);
      console.error('Failed to upload image:', error);
    } finally {
      setUploadingProductId(null);
    }
  };

  const triggerFileUpload = (productId: string) => {
    setUploadingProductId(productId);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingProductId) {
      handleImageUpload(uploadingProductId, file);
    }
    // Reset the input
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleAddGcodeMapping = async (filename: string) => {
    if (!gcodeDialogPart) return;
    try {
      await createGcodeMapping.mutateAsync({
        gcode_filename: filename,
        part_id: gcodeDialogPart.id,
      });
      toast.success('Gcode mapping added');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add mapping';
      toast.error(message);
    }
  };

  const handleDeleteGcodeMapping = async (mappingId: string) => {
    try {
      await deleteGcodeMapping.mutateAsync(mappingId);
      toast.success('Gcode mapping removed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove mapping';
      toast.error(message);
    }
  };

  const getGcodeMappingsForPart = (partId: string) => {
    return gcodeMappings?.filter(m => m.part_id === partId && m.is_active) || [];
  };

  // Count parts per product (parts can belong to multiple products)
  const getPartsCountForProduct = (productId: string) => {
    return parts?.filter(p => p.products?.some(prod => prod.id === productId)).length || 0;
  };

  const filteredParts = parts?.filter((part) => {
    const matchesProduct = productFilter === 'all' || part.products?.some(p => p.id === productFilter);
    const matchesSearch = part.name.toLowerCase().includes(search.toLowerCase()) ||
                         part.material_type.toLowerCase().includes(search.toLowerCase());
    return matchesProduct && matchesSearch;
  });

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const getStockStatus = (onHand: number, reserved: number, threshold: number) => {
    const available = onHand - reserved;
    if (available <= 0) return { label: 'Out of Stock', color: 'bg-orange-100 text-orange-700' };
    if (available < threshold) return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-700' };
    return { label: 'In Stock', color: 'bg-green-100 text-green-700' };
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Parts Catalog</h1>
            <p className="text-gray-500">Manage your 3D printed parts</p>
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

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parts Catalog</h1>
          <p className="text-gray-500">Manage your 3D printed parts</p>
        </div>
        {canEdit && (
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Part
          </Button>
        )}
      </div>

      {/* Hidden file input for image uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Products Management Section */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              <CardTitle className="text-base">Products ({products?.length || 0})</CardTitle>
            </div>
            {canEdit && (
              <Button size="sm" onClick={() => setIsAddProductDialogOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Add Product
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products?.map((product) => {
              const partsCount = getPartsCountForProduct(product.id);
              const isUploading = uploadingProductId === product.id && uploadProductImage.isPending;
              return (
                <div
                  key={product.id}
                  className="flex gap-3 p-3 bg-gray-50 rounded-lg border"
                >
                  {/* Product Image */}
                  <div className="relative shrink-0">
                    {product.image_url ? (
                      <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-white border">
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-gray-200 flex items-center justify-center border">
                        <ImageIcon className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => triggerFileUpload(product.id)}
                        disabled={isUploading}
                        className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
                        title="Upload image"
                      >
                        {isUploading ? (
                          <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
                        ) : (
                          <Upload className="h-3 w-3 text-gray-500" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{product.name}</span>
                      <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                        {product.type}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                      {product.sku && <span>SKU: {product.sku}</span>}
                      <span>{partsCount} part{partsCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {/* Delete Button */}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingProduct(product)}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 self-start"
                      title="Delete product"
                      disabled={partsCount > 0}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
            {products?.length === 0 && (
              <div className="col-span-full text-center py-4 text-gray-500">
                No products yet. Add a product to get started.
              </div>
            )}
          </div>
          {products && products.some(p => getPartsCountForProduct(p.id) > 0) && (
            <p className="text-xs text-gray-400 mt-3">
              Note: Products with parts cannot be deleted. Remove all parts first.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search parts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {products?.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Parts table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5" />
            Parts ({filteredParts?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part Name</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Print Time
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Scale className="h-4 w-4" />
                    Material
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Layers className="h-4 w-4" />
                    Per Print
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Package className="h-4 w-4" />
                    Stock
                  </div>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <FileCode className="h-4 w-4" />
                    Gcode
                  </div>
                </TableHead>
                {canEdit && <TableHead className="w-[140px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParts?.map((part) => {
                const inventory = part.inventory;
                const onHand = inventory?.quantity_on_hand || 0;
                const reserved = inventory?.quantity_reserved || 0;
                const status = getStockStatus(onHand, reserved, part.low_stock_threshold);

                return (
                  <TableRow key={part.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900">{part.name}</div>
                        {part.color && (
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <div
                              className="w-3 h-3 rounded-full border border-gray-200"
                              style={{
                                backgroundColor:
                                  part.color.toLowerCase() === 'white' ? '#f5f5f5' :
                                  part.color.toLowerCase() === 'black' ? '#1a1a1a' :
                                  part.color.toLowerCase() === 'terracotta' ? '#c65d3b' :
                                  part.color
                              }}
                            />
                            {part.color}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {part.products?.map((prod) => (
                          <Badge
                            key={prod.id}
                            variant="secondary"
                            className="bg-gray-100 text-gray-700"
                          >
                            {prod.name}
                          </Badge>
                        ))}
                        {(!part.products || part.products.length === 0) && (
                          <span className="text-gray-400 text-sm">No products</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatTime(part.print_time_minutes)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{part.material_grams}g</div>
                        <div className="text-gray-500">{part.material_type}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {part.parts_per_print}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{onHand - reserved} available</div>
                        <div className="text-gray-500">{reserved} reserved</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={status.color} variant="secondary">
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const mappings = getGcodeMappingsForPart(part.id);
                        return mappings.length > 0 ? (
                          <button
                            onClick={() => canEdit && setGcodeDialogPart(part)}
                            className="flex items-center gap-1 text-green-600 hover:underline"
                            disabled={!canEdit}
                          >
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-xs">{mappings.length}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => canEdit && setGcodeDialogPart(part)}
                            className="flex items-center gap-1 text-yellow-600 hover:underline"
                            disabled={!canEdit}
                          >
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-xs">None</span>
                          </button>
                        );
                      })()}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingPart(part)}
                            title="Edit part"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicatePart(part)}
                            disabled={createPart.isPending}
                            title="Duplicate part"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingPart(part)}
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            title="Delete part"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {filteredParts?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No parts found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      {editingPart && products && (
        <EditPartDialog
          key={editingPart.id}
          open={!!editingPart}
          onClose={() => setEditingPart(null)}
          part={editingPart}
          products={products}
          onSave={handleSavePart}
          isPending={updatePart.isPending}
        />
      )}

      {/* Add dialog */}
      {products && (
        <AddPartDialog
          open={isAddDialogOpen}
          onClose={() => setIsAddDialogOpen(false)}
          products={products}
          onSave={handleCreatePart}
          isPending={createPart.isPending}
        />
      )}

      {/* Delete part confirmation dialog */}
      <AlertDialog open={!!deletingPart} onOpenChange={() => setDeletingPart(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Part</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingPart?.name}&quot;? This action cannot be undone.
              This will also delete associated inventory records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePart}
              className="bg-orange-600 hover:bg-orange-700"
              disabled={deletePart.isPending}
            >
              {deletePart.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add product dialog */}
      <AddProductDialog
        open={isAddProductDialogOpen}
        onClose={() => setIsAddProductDialogOpen(false)}
        onSave={handleCreateProduct}
        isPending={createProduct.isPending}
      />

      {/* Delete product confirmation dialog */}
      <AlertDialog open={!!deletingProduct} onOpenChange={() => setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingProduct?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              className="bg-orange-600 hover:bg-orange-700"
              disabled={deleteProduct.isPending}
            >
              {deleteProduct.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Gcode mappings dialog */}
      {gcodeDialogPart && gcodeMappings && (
        <GcodeMappingsDialog
          open={!!gcodeDialogPart}
          onClose={() => setGcodeDialogPart(null)}
          partId={gcodeDialogPart.id}
          partName={gcodeDialogPart.name}
          mappings={gcodeMappings}
          onAdd={handleAddGcodeMapping}
          onDelete={handleDeleteGcodeMapping}
          isAdding={createGcodeMapping.isPending}
          isDeleting={deleteGcodeMapping.isPending}
        />
      )}
    </div>
  );
}
