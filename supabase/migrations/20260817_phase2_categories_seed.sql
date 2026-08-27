-- =========================================================
-- FAZ 2 - HAZIR ÜRÜN KATEGORİLERİ
-- Fabrika Yönetim Sistemi
-- =========================================================

INSERT INTO public.product_categories (
  code,
  name,
  description,
  is_active
)
VALUES
  (
    'HAM',
    'Hammadde',
    'Üretimde kullanılan ana hammaddeler',
    true
  ),
  (
    'YRM',
    'Yarı Mamul',
    'Üretim süreci devam eden yarı mamuller',
    true
  ),
  (
    'MAM',
    'Mamul',
    'Üretimi tamamlanmış ürünler',
    true
  ),
  (
    'ELK',
    'Elektrik',
    'Elektrik ve elektronik malzemeleri',
    true
  ),
  (
    'MEK',
    'Mekanik',
    'Mekanik parça ve malzemeler',
    true
  ),
  (
    'AMB',
    'Ambalaj',
    'Paketleme ve ambalaj malzemeleri',
    true
  ),
  (
    'SAR',
    'Sarf Malzeme',
    'Üretim ve bakım süreçlerinde tüketilen sarf malzemeleri',
    true
  ),
  (
    'YDP',
    'Yedek Parça',
    'Makine ve ekipman yedek parçaları',
    true
  ),
  (
    'KIM',
    'Kimyasal',
    'Üretim, temizlik ve bakımda kullanılan kimyasallar',
    true
  ),
  (
    'DIG',
    'Diğer',
    'Diğer ürün ve malzemeler',
    true
  )
ON CONFLICT (code) DO NOTHING;