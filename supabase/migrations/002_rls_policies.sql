-- Row Level Security Policies for Production Dashboard
-- Version: 1.0.0

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_product_mappings ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS user_role AS $$
DECLARE
  role user_role;
BEGIN
  SELECT up.role INTO role FROM user_profiles up WHERE up.id = user_id;
  RETURN COALESCE(role, 'viewer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin or manager
CREATE OR REPLACE FUNCTION is_admin_or_manager(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role(user_id) IN ('admin', 'manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role(user_id) = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Products policies (all authenticated users can read, admin/manager can modify)
CREATE POLICY "Products are viewable by authenticated users"
ON products FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Products can be created by admin or manager"
ON products FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Products can be updated by admin or manager"
ON products FOR UPDATE
TO authenticated
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Products can be deleted by admin only"
ON products FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Parts policies (same as products)
CREATE POLICY "Parts are viewable by authenticated users"
ON parts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Parts can be created by admin or manager"
ON parts FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Parts can be updated by admin or manager"
ON parts FOR UPDATE
TO authenticated
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Parts can be deleted by admin only"
ON parts FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Inventory policies (all can read, admin/manager can modify)
CREATE POLICY "Inventory is viewable by authenticated users"
ON inventory FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Inventory can be updated by admin or manager"
ON inventory FOR UPDATE
TO authenticated
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Inventory can be inserted by admin or manager"
ON inventory FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Printers policies
CREATE POLICY "Printers are viewable by authenticated users"
ON printers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Printers can be managed by admin or manager"
ON printers FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Printers can be updated by admin or manager"
ON printers FOR UPDATE
TO authenticated
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Printers can be deleted by admin only"
ON printers FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Production Orders policies
CREATE POLICY "Production orders are viewable by authenticated users"
ON production_orders FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Production orders can be created by admin or manager"
ON production_orders FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Production orders can be updated by admin or manager"
ON production_orders FOR UPDATE
TO authenticated
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Production orders can be deleted by admin only"
ON production_orders FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Print Jobs policies
CREATE POLICY "Print jobs are viewable by authenticated users"
ON print_jobs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Print jobs can be created by admin or manager"
ON print_jobs FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Print jobs can be updated by admin or manager"
ON print_jobs FOR UPDATE
TO authenticated
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Print jobs can be deleted by admin only"
ON print_jobs FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Print History policies (all can read, admin/manager can insert)
CREATE POLICY "Print history is viewable by authenticated users"
ON print_history FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Print history can be created by admin or manager"
ON print_history FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_manager(auth.uid()));

-- User Profiles policies
CREATE POLICY "Users can view all profiles"
ON user_profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update their own profile"
ON user_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admin can update any profile"
ON user_profiles FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Profiles are auto-created on signup"
ON user_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Inventory Adjustments policies (all can read, created automatically)
CREATE POLICY "Inventory adjustments are viewable by authenticated users"
ON inventory_adjustments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Inventory adjustments can be created by admin or manager"
ON inventory_adjustments FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Shopify Product Mappings policies
CREATE POLICY "Shopify mappings are viewable by authenticated users"
ON shopify_product_mappings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Shopify mappings can be managed by admin only"
ON shopify_product_mappings FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- Service role bypass (for webhooks and background jobs)
-- Note: Service role key automatically bypasses RLS
