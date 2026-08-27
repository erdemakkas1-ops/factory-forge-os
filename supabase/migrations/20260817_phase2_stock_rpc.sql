-- =========================================================
-- FAZ 2 - STOK HAREKET RPC FONKSİYONLARI
-- Fabrika Yönetim Sistemi
-- =========================================================
--
-- Amaç:
-- Frontend inventory tablosunu doğrudan değiştirmez.
-- Tüm stok işlemleri güvenli PostgreSQL fonksiyonları
-- üzerinden gerçekleştirilir.
--
-- =========================================================


-- =========================================================
-- 1. STOK GİRİŞİ
-- =========================================================

CREATE OR REPLACE FUNCTION public.stock_entry(
  p_product_id uuid,
  p_warehouse_id uuid,
  p_quantity numeric,
  p_location_id uuid DEFAULT NULL,
  p_reference_no text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_movement_id uuid;
BEGIN

  -- -------------------------------------------------------
  -- Kullanıcı kontrolü
  -- -------------------------------------------------------

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;


  -- -------------------------------------------------------
  -- Yetki kontrolü
  -- -------------------------------------------------------

  IF NOT (
    public.has_permission(auth.uid(), 'stock.entry')
    OR
    public.has_permission(auth.uid(), 'stock.manage')
  ) THEN
    RAISE EXCEPTION 'Bu işlem için stok giriş yetkiniz bulunmuyor.';
  END IF;


  -- -------------------------------------------------------
  -- Miktar kontrolü
  -- -------------------------------------------------------

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Stok giriş miktarı sıfırdan büyük olmalıdır.';
  END IF;


  -- -------------------------------------------------------
  -- Ürün kontrolü
  -- -------------------------------------------------------

  IF NOT EXISTS (
    SELECT 1
    FROM public.products
    WHERE id = p_product_id
      AND is_active = true
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Ürün bulunamadı veya aktif değil.';
  END IF;


  -- -------------------------------------------------------
  -- Depo kontrolü
  -- -------------------------------------------------------

  IF NOT EXISTS (
    SELECT 1
    FROM public.warehouses
    WHERE id = p_warehouse_id
      AND is_active = true
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Depo bulunamadı veya aktif değil.';
  END IF;


  -- -------------------------------------------------------
  -- Raf / konum kontrolü
  -- -------------------------------------------------------

  IF p_location_id IS NOT NULL THEN

    IF NOT EXISTS (
      SELECT 1
      FROM public.warehouse_locations
      WHERE id = p_location_id
        AND warehouse_id = p_warehouse_id
        AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Seçilen raf bu depoya ait değil veya aktif değil.';
    END IF;

  END IF;


  -- -------------------------------------------------------
  -- Inventory güncelle
  -- -------------------------------------------------------

  IF p_location_id IS NULL THEN
    INSERT INTO public.inventory (
      product_id,
      warehouse_id,
      location_id,
      quantity
    )
    VALUES (
      p_product_id,
      p_warehouse_id,
      NULL,
      p_quantity
    )
    ON CONFLICT (product_id, warehouse_id)
    WHERE location_id IS NULL
    DO UPDATE SET
      quantity = public.inventory.quantity + EXCLUDED.quantity,
      updated_at = now();

  ELSE
    INSERT INTO public.inventory (
      product_id,
      warehouse_id,
      location_id,
      quantity
    )
    VALUES (
      p_product_id,
      p_warehouse_id,
      p_location_id,
      p_quantity
    )
    ON CONFLICT (product_id, warehouse_id, location_id)
    WHERE location_id IS NOT NULL
    DO UPDATE SET
      quantity = public.inventory.quantity + EXCLUDED.quantity,
      updated_at = now();

  END IF;


  -- -------------------------------------------------------
  -- Stok hareket kaydı
  -- -------------------------------------------------------

  INSERT INTO public.stock_movements (
    product_id,
    movement_type,
    destination_warehouse_id,
    destination_location_id,
    quantity,
    reference_no,
    description,
    performed_by
  )
  VALUES (
    p_product_id,
    'entry',
    p_warehouse_id,
    p_location_id,
    p_quantity,
    NULLIF(trim(p_reference_no), ''),
    NULLIF(trim(p_description), ''),
    auth.uid()
  )
  RETURNING id
  INTO v_movement_id;


  RETURN v_movement_id;

END;
$$;



-- =========================================================
-- 2. STOK ÇIKIŞI
-- =========================================================

CREATE OR REPLACE FUNCTION public.stock_exit(
  p_product_id uuid,
  p_warehouse_id uuid,
  p_quantity numeric,
  p_location_id uuid DEFAULT NULL,
  p_reference_no text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inventory_id uuid;
  v_current_quantity numeric;
  v_movement_id uuid;
BEGIN

  -- -------------------------------------------------------
  -- Kullanıcı kontrolü
  -- -------------------------------------------------------

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;


  -- -------------------------------------------------------
  -- Yetki kontrolü
  -- -------------------------------------------------------

  IF NOT (
    public.has_permission(auth.uid(), 'stock.exit')
    OR
    public.has_permission(auth.uid(), 'stock.manage')
  ) THEN
    RAISE EXCEPTION 'Bu işlem için stok çıkış yetkiniz bulunmuyor.';
  END IF;


  -- -------------------------------------------------------
  -- Miktar kontrolü
  -- -------------------------------------------------------

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Stok çıkış miktarı sıfırdan büyük olmalıdır.';
  END IF;


  -- -------------------------------------------------------
  -- Inventory satırını kilitle
  -- -------------------------------------------------------

  IF p_location_id IS NULL THEN

    SELECT
      id,
      quantity
    INTO
      v_inventory_id,
      v_current_quantity
    FROM public.inventory
    WHERE product_id = p_product_id
      AND warehouse_id = p_warehouse_id
      AND location_id IS NULL
    FOR UPDATE;

  ELSE

    SELECT
      id,
      quantity
    INTO
      v_inventory_id,
      v_current_quantity
    FROM public.inventory
    WHERE product_id = p_product_id
      AND warehouse_id = p_warehouse_id
      AND location_id = p_location_id
    FOR UPDATE;

  END IF;


  -- -------------------------------------------------------
  -- Stok kontrolü
  -- -------------------------------------------------------

  IF v_inventory_id IS NULL THEN
    RAISE EXCEPTION 'Bu ürün için seçilen depoda stok bulunmuyor.';
  END IF;


  IF v_current_quantity < p_quantity THEN
    RAISE EXCEPTION
      'Yetersiz stok. Mevcut stok: %, çıkış miktarı: %',
      v_current_quantity,
      p_quantity;
  END IF;


  -- -------------------------------------------------------
  -- Inventory azalt
  -- -------------------------------------------------------

  UPDATE public.inventory
  SET
    quantity = quantity - p_quantity,
    updated_at = now()
  WHERE id = v_inventory_id;


  -- -------------------------------------------------------
  -- Stok hareket kaydı
  -- -------------------------------------------------------

  INSERT INTO public.stock_movements (
    product_id,
    movement_type,
    source_warehouse_id,
    source_location_id,
    quantity,
    reference_no,
    description,
    performed_by
  )
  VALUES (
    p_product_id,
    'exit',
    p_warehouse_id,
    p_location_id,
    p_quantity,
    NULLIF(trim(p_reference_no), ''),
    NULLIF(trim(p_description), ''),
    auth.uid()
  )
  RETURNING id
  INTO v_movement_id;


  RETURN v_movement_id;

END;
$$;



-- =========================================================
-- 3. DEPOLAR ARASI TRANSFER
-- =========================================================

CREATE OR REPLACE FUNCTION public.stock_transfer(
  p_product_id uuid,
  p_source_warehouse_id uuid,
  p_destination_warehouse_id uuid,
  p_quantity numeric,
  p_source_location_id uuid DEFAULT NULL,
  p_destination_location_id uuid DEFAULT NULL,
  p_reference_no text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_inventory_id uuid;
  v_source_quantity numeric;
  v_transfer_group_id uuid := gen_random_uuid();
  v_movement_id uuid;
BEGIN

  -- -------------------------------------------------------
  -- Kullanıcı kontrolü
  -- -------------------------------------------------------

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum açmanız gerekiyor.';
  END IF;


  -- -------------------------------------------------------
  -- Yetki kontrolü
  -- -------------------------------------------------------

  IF NOT (
    public.has_permission(auth.uid(), 'stock.transfer')
    OR
    public.has_permission(auth.uid(), 'stock.manage')
  ) THEN
    RAISE EXCEPTION 'Bu işlem için stok transfer yetkiniz bulunmuyor.';
  END IF;


  -- -------------------------------------------------------
  -- Miktar kontrolü
  -- -------------------------------------------------------

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Transfer miktarı sıfırdan büyük olmalıdır.';
  END IF;


  -- -------------------------------------------------------
  -- Aynı depo kontrolü
  -- -------------------------------------------------------

  IF (
    p_source_warehouse_id = p_destination_warehouse_id
    AND
    p_source_location_id IS NOT DISTINCT FROM p_destination_location_id
  ) THEN
    RAISE EXCEPTION 'Kaynak ve hedef stok konumu aynı olamaz.';
  END IF;


  -- -------------------------------------------------------
  -- Kaynak depo kontrolü
  -- -------------------------------------------------------

  IF NOT EXISTS (
    SELECT 1
    FROM public.warehouses
    WHERE id = p_source_warehouse_id
      AND is_active = true
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Kaynak depo bulunamadı veya aktif değil.';
  END IF;


  -- -------------------------------------------------------
  -- Hedef depo kontrolü
  -- -------------------------------------------------------

  IF NOT EXISTS (
    SELECT 1
    FROM public.warehouses
    WHERE id = p_destination_warehouse_id
      AND is_active = true
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Hedef depo bulunamadı veya aktif değil.';
  END IF;


  -- -------------------------------------------------------
  -- Kaynak raf kontrolü
  -- -------------------------------------------------------

  IF p_source_location_id IS NOT NULL THEN

    IF NOT EXISTS (
      SELECT 1
      FROM public.warehouse_locations
      WHERE id = p_source_location_id
        AND warehouse_id = p_source_warehouse_id
        AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Kaynak raf seçilen depoya ait değil.';
    END IF;

  END IF;


  -- -------------------------------------------------------
  -- Hedef raf kontrolü
  -- -------------------------------------------------------

  IF p_destination_location_id IS NOT NULL THEN

    IF NOT EXISTS (
      SELECT 1
      FROM public.warehouse_locations
      WHERE id = p_destination_location_id
        AND warehouse_id = p_destination_warehouse_id
        AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Hedef raf seçilen depoya ait değil.';
    END IF;

  END IF;


  -- -------------------------------------------------------
  -- Kaynak inventory kaydını kilitle
  -- -------------------------------------------------------

  IF p_source_location_id IS NULL THEN

    SELECT
      id,
      quantity
    INTO
      v_source_inventory_id,
      v_source_quantity
    FROM public.inventory
    WHERE product_id = p_product_id
      AND warehouse_id = p_source_warehouse_id
      AND location_id IS NULL
    FOR UPDATE;

  ELSE

    SELECT
      id,
      quantity
    INTO
      v_source_inventory_id,
      v_source_quantity
    FROM public.inventory
    WHERE product_id = p_product_id
      AND warehouse_id = p_source_warehouse_id
      AND location_id = p_source_location_id
    FOR UPDATE;

  END IF;


  -- -------------------------------------------------------
  -- Kaynak stok kontrolü
  -- -------------------------------------------------------

  IF v_source_inventory_id IS NULL THEN
    RAISE EXCEPTION 'Kaynak depoda bu ürüne ait stok bulunmuyor.';
  END IF;


  IF v_source_quantity < p_quantity THEN
    RAISE EXCEPTION
      'Yetersiz stok. Mevcut stok: %, transfer miktarı: %',
      v_source_quantity,
      p_quantity;
  END IF;


  -- -------------------------------------------------------
  -- Kaynak stoğu azalt
  -- -------------------------------------------------------

  UPDATE public.inventory
  SET
    quantity = quantity - p_quantity,
    updated_at = now()
  WHERE id = v_source_inventory_id;


  -- -------------------------------------------------------
  -- Hedef stoğu artır
  -- -------------------------------------------------------

  IF p_destination_location_id IS NULL THEN

    UPDATE public.inventory
    SET
      quantity = quantity + p_quantity,
      updated_at = now()
    WHERE product_id = p_product_id
      AND warehouse_id = p_destination_warehouse_id
      AND location_id IS NULL;

    IF NOT FOUND THEN

      INSERT INTO public.inventory (
        product_id,
        warehouse_id,
        location_id,
        quantity
      )
      VALUES (
        p_product_id,
        p_destination_warehouse_id,
        NULL,
        p_quantity
      );

    END IF;

  ELSE

    UPDATE public.inventory
    SET
      quantity = quantity + p_quantity,
      updated_at = now()
    WHERE product_id = p_product_id
      AND warehouse_id = p_destination_warehouse_id
      AND location_id = p_destination_location_id;

    IF NOT FOUND THEN

      INSERT INTO public.inventory (
        product_id,
        warehouse_id,
        location_id,
        quantity
      )
      VALUES (
        p_product_id,
        p_destination_warehouse_id,
        p_destination_location_id,
        p_quantity
      );

    END IF;

  END IF;


  -- -------------------------------------------------------
  -- Transfer hareket kaydı
  -- -------------------------------------------------------

  INSERT INTO public.stock_movements (
    product_id,
    movement_type,
    source_warehouse_id,
    source_location_id,
    destination_warehouse_id,
    destination_location_id,
    quantity,
    reference_no,
    description,
    transfer_group_id,
    performed_by
  )
  VALUES (
    p_product_id,
    'transfer',
    p_source_warehouse_id,
    p_source_location_id,
    p_destination_warehouse_id,
    p_destination_location_id,
    p_quantity,
    NULLIF(trim(p_reference_no), ''),
    NULLIF(trim(p_description), ''),
    v_transfer_group_id,
    auth.uid()
  )
  RETURNING id
  INTO v_movement_id;


  RETURN v_movement_id;

END;
$$;



-- =========================================================
-- GÜVENLİK
-- =========================================================

REVOKE ALL
ON FUNCTION public.stock_entry(
  uuid,
  uuid,
  numeric,
  uuid,
  text,
  text
)
FROM PUBLIC, anon;


REVOKE ALL
ON FUNCTION public.stock_exit(
  uuid,
  uuid,
  numeric,
  uuid,
  text,
  text
)
FROM PUBLIC, anon;


REVOKE ALL
ON FUNCTION public.stock_transfer(
  uuid,
  uuid,
  uuid,
  numeric,
  uuid,
  uuid,
  text,
  text
)
FROM PUBLIC, anon;



-- =========================================================
-- AUTHENTICATED KULLANICI EXECUTE
-- =========================================================

GRANT EXECUTE
ON FUNCTION public.stock_entry(
  uuid,
  uuid,
  numeric,
  uuid,
  text,
  text
)
TO authenticated;


GRANT EXECUTE
ON FUNCTION public.stock_exit(
  uuid,
  uuid,
  numeric,
  uuid,
  text,
  text
)
TO authenticated;


GRANT EXECUTE
ON FUNCTION public.stock_transfer(
  uuid,
  uuid,
  uuid,
  numeric,
  uuid,
  uuid,
  text,
  text
)
TO authenticated;


-- =========================================================
-- END
-- =========================================================
