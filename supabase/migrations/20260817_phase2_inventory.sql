-- =========================================================
-- FAZ 2 - ÜRÜN / DEPO / STOK ALTYAPISI
-- Fabrika Yönetim Sistemi
-- =========================================================

-- ---------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'product_type'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.product_type AS ENUM (
      'raw_material',
      'semi_finished',
      'finished',
      'consumable',
      'spare_part'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'stock_movement_type'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.stock_movement_type AS ENUM (
      'entry',
      'exit',
      'transfer',
      'adjustment',
      'return',
      'production_consumption',
      'production_entry'
    );
  END IF;
END
$$;


-- =========================================================
-- PRODUCT CATEGORIES
-- =========================================================

CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,

  is_active boolean NOT NULL DEFAULT true,

  created_by uuid
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- =========================================================
-- PRODUCTS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  code text NOT NULL UNIQUE,
  name text NOT NULL,

  category_id uuid
    REFERENCES public.product_categories(id)
    ON DELETE SET NULL,

  product_type public.product_type NOT NULL,

  description text,

  unit text NOT NULL DEFAULT 'Adet',

  barcode text UNIQUE,

  image_url text,

  minimum_stock numeric(14,3) NOT NULL DEFAULT 0,
  maximum_stock numeric(14,3),

  purchase_price numeric(14,2),
  sale_price numeric(14,2),

  is_active boolean NOT NULL DEFAULT true,

  created_by uuid
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT products_minimum_stock_check
    CHECK (minimum_stock >= 0),

  CONSTRAINT products_maximum_stock_check
    CHECK (
      maximum_stock IS NULL
      OR maximum_stock >= minimum_stock
    ),

  CONSTRAINT products_purchase_price_check
    CHECK (
      purchase_price IS NULL
      OR purchase_price >= 0
    ),

  CONSTRAINT products_sale_price_check
    CHECK (
      sale_price IS NULL
      OR sale_price >= 0
    )
);


-- =========================================================
-- WAREHOUSES
-- =========================================================

CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  code text NOT NULL UNIQUE,
  name text NOT NULL,

  description text,
  location_description text,

  manager_id uuid
    REFERENCES public.profiles(id)
    ON DELETE SET NULL,

  is_active boolean NOT NULL DEFAULT true,

  created_by uuid
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- =========================================================
-- WAREHOUSE LOCATIONS / RAFLAR
-- =========================================================

CREATE TABLE IF NOT EXISTS public.warehouse_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  warehouse_id uuid NOT NULL
    REFERENCES public.warehouses(id)
    ON DELETE CASCADE,

  code text NOT NULL,

  description text,

  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT warehouse_locations_unique_code
    UNIQUE (warehouse_id, code)
);


-- =========================================================
-- INVENTORY
-- =========================================================

CREATE TABLE IF NOT EXISTS public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  product_id uuid NOT NULL
    REFERENCES public.products(id)
    ON DELETE RESTRICT,

  warehouse_id uuid NOT NULL
    REFERENCES public.warehouses(id)
    ON DELETE RESTRICT,

  location_id uuid
    REFERENCES public.warehouse_locations(id)
    ON DELETE RESTRICT,

  quantity numeric(14,3) NOT NULL DEFAULT 0,

  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT inventory_quantity_check
    CHECK (quantity >= 0)
);


CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_unique_location
ON public.inventory (
  product_id,
  warehouse_id,
  location_id
)
WHERE location_id IS NOT NULL;


CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_unique_no_location
ON public.inventory (
  product_id,
  warehouse_id
)
WHERE location_id IS NULL;


-- =========================================================
-- STOCK MOVEMENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  product_id uuid NOT NULL
    REFERENCES public.products(id)
    ON DELETE RESTRICT,

  movement_type public.stock_movement_type NOT NULL,

  source_warehouse_id uuid
    REFERENCES public.warehouses(id)
    ON DELETE RESTRICT,

  source_location_id uuid
    REFERENCES public.warehouse_locations(id)
    ON DELETE RESTRICT,

  destination_warehouse_id uuid
    REFERENCES public.warehouses(id)
    ON DELETE RESTRICT,

  destination_location_id uuid
    REFERENCES public.warehouse_locations(id)
    ON DELETE RESTRICT,

  quantity numeric(14,3) NOT NULL,

  reference_no text,

  description text,

  transfer_group_id uuid,

  performed_by uuid
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT stock_movements_quantity_check
    CHECK (quantity > 0)
);


-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_product_categories_name
ON public.product_categories(name);

CREATE INDEX IF NOT EXISTS idx_products_name
ON public.products(name);

CREATE INDEX IF NOT EXISTS idx_products_code
ON public.products(code);

CREATE INDEX IF NOT EXISTS idx_products_category
ON public.products(category_id);

CREATE INDEX IF NOT EXISTS idx_products_type
ON public.products(product_type);

CREATE INDEX IF NOT EXISTS idx_products_barcode
ON public.products(barcode)
WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_active
ON public.products(is_active);

CREATE INDEX IF NOT EXISTS idx_warehouses_code
ON public.warehouses(code);

CREATE INDEX IF NOT EXISTS idx_warehouse_locations_warehouse
ON public.warehouse_locations(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_inventory_product
ON public.inventory(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_warehouse
ON public.inventory(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_inventory_location
ON public.inventory(location_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product
ON public.stock_movements(product_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_type
ON public.stock_movements(movement_type);

CREATE INDEX IF NOT EXISTS idx_stock_movements_created
ON public.stock_movements(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_source_warehouse
ON public.stock_movements(source_warehouse_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_destination_warehouse
ON public.stock_movements(destination_warehouse_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_performed_by
ON public.stock_movements(performed_by);

CREATE INDEX IF NOT EXISTS idx_stock_movements_transfer_group
ON public.stock_movements(transfer_group_id)
WHERE transfer_group_id IS NOT NULL;


-- =========================================================
-- UPDATED_AT TRIGGERS
-- Faz 1'deki set_updated_at() kullanılıyor.
-- =========================================================

DROP TRIGGER IF EXISTS product_categories_updated_at
ON public.product_categories;

CREATE TRIGGER product_categories_updated_at
BEFORE UPDATE ON public.product_categories
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS products_updated_at
ON public.products;

CREATE TRIGGER products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS warehouses_updated_at
ON public.warehouses;

CREATE TRIGGER warehouses_updated_at
BEFORE UPDATE ON public.warehouses
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS warehouse_locations_updated_at
ON public.warehouse_locations;

CREATE TRIGGER warehouse_locations_updated_at
BEFORE UPDATE ON public.warehouse_locations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS inventory_updated_at
ON public.inventory;

CREATE TRIGGER inventory_updated_at
BEFORE UPDATE ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


-- =========================================================
-- FAZ 2 PERMISSIONS
-- =========================================================

INSERT INTO public.permissions (
  key,
  module,
  label
)
VALUES
  (
    'products.create',
    'Ürün',
    'Ürün oluşturma'
  ),
  (
    'products.update',
    'Ürün',
    'Ürün güncelleme'
  ),
  (
    'products.delete',
    'Ürün',
    'Ürün pasife alma'
  ),
  (
    'warehouses.view',
    'Depo',
    'Depoları görüntüleme'
  ),
  (
    'warehouses.create',
    'Depo',
    'Depo oluşturma'
  ),
  (
    'warehouses.update',
    'Depo',
    'Depo güncelleme'
  ),
  (
    'stock.entry',
    'Stok',
    'Stok girişi'
  ),
  (
    'stock.exit',
    'Stok',
    'Stok çıkışı'
  ),
  (
    'stock.transfer',
    'Stok',
    'Depolar arası transfer'
  ),
  (
    'stock.adjustment',
    'Stok',
    'Stok düzeltme'
  )
ON CONFLICT (key) DO NOTHING;


-- =========================================================
-- ADMIN
-- =========================================================

INSERT INTO public.role_permissions (
  role,
  permission_key
)
SELECT
  'admin',
  p.key
FROM public.permissions p
WHERE p.key IN (
  'products.create',
  'products.update',
  'products.delete',
  'warehouses.view',
  'warehouses.create',
  'warehouses.update',
  'stock.entry',
  'stock.exit',
  'stock.transfer',
  'stock.adjustment'
)
ON CONFLICT (role, permission_key) DO NOTHING;


-- =========================================================
-- WAREHOUSE ROLE
-- =========================================================

INSERT INTO public.role_permissions (
  role,
  permission_key
)
SELECT
  'warehouse',
  p.key
FROM public.permissions p
WHERE p.key IN (
  'products.view',
  'products.create',
  'products.update',
  'warehouses.view',
  'warehouses.create',
  'warehouses.update',
  'stock.view',
  'stock.entry',
  'stock.exit',
  'stock.transfer',
  'stock.adjustment'
)
ON CONFLICT (role, permission_key) DO NOTHING;


-- =========================================================
-- PATRON
-- =========================================================

INSERT INTO public.role_permissions (
  role,
  permission_key
)
SELECT
  'patron',
  p.key
FROM public.permissions p
WHERE p.key IN (
  'products.view',
  'warehouses.view',
  'stock.view'
)
ON CONFLICT (role, permission_key) DO NOTHING;


-- =========================================================
-- PRODUCTION MANAGER
-- =========================================================

INSERT INTO public.role_permissions (
  role,
  permission_key
)
SELECT
  'production_manager',
  p.key
FROM public.permissions p
WHERE p.key IN (
  'products.view',
  'warehouses.view',
  'stock.view'
)
ON CONFLICT (role, permission_key) DO NOTHING;


-- =========================================================
-- GRANTS
-- =========================================================

GRANT SELECT, INSERT, UPDATE
ON public.product_categories
TO authenticated;

GRANT SELECT, INSERT, UPDATE
ON public.products
TO authenticated;

GRANT SELECT, INSERT, UPDATE
ON public.warehouses
TO authenticated;

GRANT SELECT, INSERT, UPDATE
ON public.warehouse_locations
TO authenticated;


-- Inventory doğrudan frontend tarafından değiştirilmeyecek.
GRANT SELECT
ON public.inventory
TO authenticated;


-- Stock movements RPC ile yönetilecek.
GRANT SELECT
ON public.stock_movements
TO authenticated;


GRANT ALL
ON public.product_categories,
   public.products,
   public.warehouses,
   public.warehouse_locations,
   public.inventory,
   public.stock_movements
TO service_role;


-- =========================================================
-- RLS ENABLE
-- =========================================================

ALTER TABLE public.product_categories
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.products
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.warehouses
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.warehouse_locations
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inventory
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stock_movements
ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- PRODUCT CATEGORIES RLS
-- =========================================================

CREATE POLICY "product_categories_read"
ON public.product_categories
FOR SELECT
TO authenticated
USING (
  public.has_permission(
    auth.uid(),
    'products.view'
  )
  OR
  public.has_permission(
    auth.uid(),
    'products.manage'
  )
);


CREATE POLICY "product_categories_create"
ON public.product_categories
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_permission(
    auth.uid(),
    'products.create'
  )
  OR
  public.has_permission(
    auth.uid(),
    'products.manage'
  )
);


CREATE POLICY "product_categories_update"
ON public.product_categories
FOR UPDATE
TO authenticated
USING (
  public.has_permission(
    auth.uid(),
    'products.update'
  )
  OR
  public.has_permission(
    auth.uid(),
    'products.manage'
  )
)
WITH CHECK (
  public.has_permission(
    auth.uid(),
    'products.update'
  )
  OR
  public.has_permission(
    auth.uid(),
    'products.manage'
  )
);


-- =========================================================
-- PRODUCTS RLS
-- =========================================================

CREATE POLICY "products_read"
ON public.products
FOR SELECT
TO authenticated
USING (
  public.has_permission(
    auth.uid(),
    'products.view'
  )
  OR
  public.has_permission(
    auth.uid(),
    'products.manage'
  )
);


CREATE POLICY "products_create"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_permission(
    auth.uid(),
    'products.create'
  )
  OR
  public.has_permission(
    auth.uid(),
    'products.manage'
  )
);


CREATE POLICY "products_update"
ON public.products
FOR UPDATE
TO authenticated
USING (
  public.has_permission(
    auth.uid(),
    'products.update'
  )
  OR
  public.has_permission(
    auth.uid(),
    'products.manage'
  )
)
WITH CHECK (
  public.has_permission(
    auth.uid(),
    'products.update'
  )
  OR
  public.has_permission(
    auth.uid(),
    'products.manage'
  )
);


-- =========================================================
-- WAREHOUSES RLS
-- =========================================================

CREATE POLICY "warehouses_read"
ON public.warehouses
FOR SELECT
TO authenticated
USING (
  public.has_permission(
    auth.uid(),
    'warehouses.view'
  )
  OR
  public.has_permission(
    auth.uid(),
    'stock.view'
  )
  OR
  public.has_permission(
    auth.uid(),
    'stock.manage'
  )
);


CREATE POLICY "warehouses_create"
ON public.warehouses
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_permission(
    auth.uid(),
    'warehouses.create'
  )
  OR
  public.has_permission(
    auth.uid(),
    'stock.manage'
  )
);


CREATE POLICY "warehouses_update"
ON public.warehouses
FOR UPDATE
TO authenticated
USING (
  public.has_permission(
    auth.uid(),
    'warehouses.update'
  )
  OR
  public.has_permission(
    auth.uid(),
    'stock.manage'
  )
)
WITH CHECK (
  public.has_permission(
    auth.uid(),
    'warehouses.update'
  )
  OR
  public.has_permission(
    auth.uid(),
    'stock.manage'
  )
);


-- =========================================================
-- WAREHOUSE LOCATIONS RLS
-- =========================================================

CREATE POLICY "warehouse_locations_read"
ON public.warehouse_locations
FOR SELECT
TO authenticated
USING (
  public.has_permission(
    auth.uid(),
    'warehouses.view'
  )
  OR
  public.has_permission(
    auth.uid(),
    'stock.view'
  )
  OR
  public.has_permission(
    auth.uid(),
    'stock.manage'
  )
);


CREATE POLICY "warehouse_locations_create"
ON public.warehouse_locations
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_permission(
    auth.uid(),
    'warehouses.create'
  )
  OR
  public.has_permission(
    auth.uid(),
    'stock.manage'
  )
);


CREATE POLICY "warehouse_locations_update"
ON public.warehouse_locations
FOR UPDATE
TO authenticated
USING (
  public.has_permission(
    auth.uid(),
    'warehouses.update'
  )
  OR
  public.has_permission(
    auth.uid(),
    'stock.manage'
  )
)
WITH CHECK (
  public.has_permission(
    auth.uid(),
    'warehouses.update'
  )
  OR
  public.has_permission(
    auth.uid(),
    'stock.manage'
  )
);


-- =========================================================
-- INVENTORY RLS
-- =========================================================

CREATE POLICY "inventory_read"
ON public.inventory
FOR SELECT
TO authenticated
USING (
  public.has_permission(
    auth.uid(),
    'stock.view'
  )
  OR
  public.has_permission(
    auth.uid(),
    'stock.manage'
  )
  OR
  public.has_permission(
    auth.uid(),
    'products.view'
  )
);


-- =========================================================
-- STOCK MOVEMENTS RLS
-- =========================================================

CREATE POLICY "stock_movements_read"
ON public.stock_movements
FOR SELECT
TO authenticated
USING (
  public.has_permission(
    auth.uid(),
    'stock.view'
  )
  OR
  public.has_permission(
    auth.uid(),
    'stock.manage'
  )
);


-- =========================================================
-- END
-- =========================================================