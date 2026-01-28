'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Part, CreatePartInput, CreateProductInput, Product } from '@/types/database';

export interface PartWithProducts extends Omit<Part, 'inventory' | 'products' | 'product_parts'> {
  products: Product[];
  inventory: { quantity_on_hand: number; quantity_reserved: number };
}

// For backwards compatibility in some UIs that expect a single product
export interface PartWithProduct extends PartWithProducts {
  product: Product; // First product for display purposes
}

export function useParts(productId?: string) {
  return useQuery({
    queryKey: ['parts', productId],
    queryFn: async () => {
      const supabase = createClient();

      // Query parts with their product associations via junction table
      let query = supabase
        .from('parts')
        .select(`
          *,
          product_parts(
            product:products(*)
          ),
          inventory(quantity_on_hand, quantity_reserved)
        `)
        .order('name');

      const { data, error } = await query;

      if (error) throw error;

      // Transform the nested product_parts structure into a flat products array
      const transformedData = (data || []).map((part: {
        product_parts: Array<{ product: Product }>;
        inventory: { quantity_on_hand: number; quantity_reserved: number } | null;
        [key: string]: unknown;
      }) => {
        const products = part.product_parts?.map(pp => pp.product).filter(Boolean) || [];
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { product_parts, ...rest } = part;
        return {
          ...rest,
          products,
          product: products[0] || null, // First product for backwards compatibility
          inventory: part.inventory || { quantity_on_hand: 0, quantity_reserved: 0 },
        };
      });

      // If filtering by productId, filter the results
      if (productId) {
        return transformedData.filter((part: PartWithProduct) =>
          part.products.some(p => p.id === productId)
        ) as PartWithProduct[];
      }

      return transformedData as PartWithProduct[];
    },
  });
}

export function usePart(id: string) {
  return useQuery({
    queryKey: ['part', id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('parts')
        .select(`
          *,
          product_parts(
            product:products(*)
          ),
          inventory(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Transform the nested structure
      const products = data.product_parts?.map((pp: { product: Product }) => pp.product).filter(Boolean) || [];
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { product_parts, ...rest } = data;

      return {
        ...rest,
        products,
        product: products[0] || null,
        inventory: data.inventory || { quantity_on_hand: 0, quantity_reserved: 0 },
      } as PartWithProduct;
    },
    enabled: !!id,
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Product[];
    },
  });
}

export function useCreatePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePartInput) => {
      const supabase = createClient();
      const { product_ids, ...partData } = input;

      // Insert the part
      const { data: part, error: partError } = await supabase
        .from('parts')
        .insert(partData)
        .select()
        .single();

      if (partError) throw partError;

      // Insert product associations into the junction table
      if (product_ids.length > 0) {
        const productParts = product_ids.map(productId => ({
          product_id: productId,
          part_id: part.id,
        }));

        const { error: junctionError } = await supabase
          .from('product_parts')
          .insert(productParts);

        if (junctionError) throw junctionError;
      }

      return part;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export interface UpdatePartInput {
  id: string;
  product_ids?: string[];
  name?: string;
  print_time_minutes?: number;
  material_grams?: number;
  parts_per_print?: number;
  color?: string | null;
  material_type?: string;
  low_stock_threshold?: number;
}

export function useUpdatePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, product_ids, ...updates }: UpdatePartInput) => {
      const supabase = createClient();

      // Update the part itself if there are field updates
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('parts')
          .update(updates)
          .eq('id', id);

        if (error) {
          throw new Error(error.message || 'Failed to update part');
        }
      }

      // Update product associations if product_ids was provided
      if (product_ids !== undefined) {
        // Delete existing associations
        const { error: deleteError } = await supabase
          .from('product_parts')
          .delete()
          .eq('part_id', id);

        if (deleteError) throw deleteError;

        // Insert new associations
        if (product_ids.length > 0) {
          const productParts = product_ids.map(productId => ({
            product_id: productId,
            part_id: id,
          }));

          const { error: insertError } = await supabase
            .from('product_parts')
            .insert(productParts);

          if (insertError) throw insertError;
        }
      }

      return { id, product_ids, ...updates };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      queryClient.invalidateQueries({ queryKey: ['part', variables.id] });
    },
    onError: (error) => {
      console.error('Update part error:', error);
    },
  });
}

export function useDeletePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      // Junction table entries will be deleted automatically via CASCADE
      const { error } = await supabase
        .from('parts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Product> & { id: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      return { id, ...updates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
  });
}

export function useUploadProductImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, file }: { productId: string; file: File }) => {
      const supabase = createClient();

      // Generate a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('product-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-photos')
        .getPublicUrl(filePath);

      // Update the product with the new image URL
      const { error: updateError } = await supabase
        .from('products')
        .update({ image_url: publicUrl })
        .eq('id', productId);

      if (updateError) throw updateError;

      return { productId, imageUrl: publicUrl };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
  });
}

// Helper hook to get parts for a specific product (via junction table)
export function usePartsForProduct(productId: string) {
  return useQuery({
    queryKey: ['parts_for_product', productId],
    queryFn: async () => {
      const supabase = createClient();

      // Query via junction table
      const { data, error } = await supabase
        .from('product_parts')
        .select(`
          part:parts(
            *,
            inventory(quantity_on_hand, quantity_reserved)
          )
        `)
        .eq('product_id', productId);

      if (error) throw error;

      // Extract parts from the junction result
      return (data || [])
        .map((pp: { part: Part & { inventory: { quantity_on_hand: number; quantity_reserved: number } } }) => pp.part)
        .filter(Boolean);
    },
    enabled: !!productId,
  });
}
