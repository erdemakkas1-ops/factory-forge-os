-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','patron','hr','production_manager','warehouse','unit_manager','staff');

-- UPDATED_AT
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- DEPARTMENTS
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  manager_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  manager_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_no text UNIQUE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  position text,
  avatar_url text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  shift text,
  hired_at date,
  is_active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ADD CONSTRAINT departments_manager_fk FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.units ADD CONSTRAINT units_manager_fk FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ROLES / PERMISSIONS
CREATE TABLE public.roles (
  role public.app_role PRIMARY KEY,
  label text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.permissions (
  key text PRIMARY KEY,
  module text NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL REFERENCES public.roles(role) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission_key)
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL REFERENCES public.roles(role) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  module text NOT NULL,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_units_department ON public.units(department_id);
CREATE INDEX idx_profiles_department ON public.profiles(department_id);
CREATE INDEX idx_profiles_unit ON public.profiles(unit_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_module ON public.audit_logs(module);

-- SECURITY DEFINER HELPERS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id AND rp.permission_key = _permission
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_roles()
RETURNS SETOF public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid();
$$;

-- NEW USER TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE seq int;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(employee_no, '\D', '', 'g'), '')::int), 0) + 1 INTO seq FROM public.profiles;
  INSERT INTO public.profiles (id, email, first_name, last_name, employee_no)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'PER-' || lpad(seq::text, 6, '0')
  );
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT ON public.roles TO authenticated;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.role_permissions TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.departments, public.units, public.profiles, public.user_roles, public.roles, public.permissions, public.role_permissions, public.audit_logs TO service_role;

-- RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "departments_read" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments_write" ON public.departments FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'org.manage')) WITH CHECK (public.has_permission(auth.uid(), 'org.manage'));

CREATE POLICY "units_read" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "units_write" ON public.units FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'org.manage')) WITH CHECK (public.has_permission(auth.uid(), 'org.manage'));

CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_manage" ON public.profiles FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'employees.manage')) WITH CHECK (public.has_permission(auth.uid(), 'employees.manage'));

CREATE POLICY "roles_read" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions_read" ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "role_permissions_read" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions_manage" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_read_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'roles.view'));
CREATE POLICY "user_roles_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "audit_logs_read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'audit.view'));
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- SEED ROLES
INSERT INTO public.roles (role, label, description) VALUES
  ('admin','Admin','Sistem yöneticisi, tüm yetkilere sahiptir'),
  ('patron','Patron / Yönetici','Tüm operasyonları görüntüler ve raporlara erişir'),
  ('hr','İnsan Kaynakları','Personel işlemlerini yönetir'),
  ('production_manager','Üretim Müdürü','Üretim emirlerini yönetir ve iş atar'),
  ('warehouse','Depo / Stok Sorumlusu','Stok ve depo işlemlerini yönetir'),
  ('unit_manager','Birim Sorumlusu','Birimine gelen işleri yönetir'),
  ('staff','Personel','Kendisine atanan işleri görür');

INSERT INTO public.permissions (key, module, label) VALUES
  ('dashboard.view','Dashboard','Dashboard görüntüleme'),
  ('org.view','Organizasyon','Departman ve birimleri görüntüleme'),
  ('org.manage','Organizasyon','Departman ve birim yönetimi'),
  ('employees.view','Personel','Personel görüntüleme'),
  ('employees.manage','Personel','Personel yönetimi'),
  ('roles.view','Yetkilendirme','Kullanıcı rollerini görüntüleme'),
  ('roles.manage','Yetkilendirme','Rol ve yetki yönetimi'),
  ('products.view','Ürün','Ürün görüntüleme'),
  ('products.manage','Ürün','Ürün yönetimi'),
  ('stock.view','Stok','Stok görüntüleme'),
  ('stock.manage','Stok','Stok hareketi yönetimi'),
  ('orders.view','Sipariş','Sipariş görüntüleme'),
  ('orders.manage','Sipariş','Sipariş yönetimi'),
  ('production.view','Üretim','Üretim emirlerini görüntüleme'),
  ('production.manage','Üretim','Üretim emri yönetimi'),
  ('tasks.view','Görev','Görev görüntüleme'),
  ('tasks.assign','Görev','Görev atama'),
  ('reports.view','Rapor','Raporlara erişim'),
  ('audit.view','Denetim','Denetim kayıtlarını görüntüleme'),
  ('settings.manage','Ayarlar','Sistem ayarları yönetimi');

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'admin', key FROM public.permissions;

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'patron', key FROM public.permissions
WHERE key IN ('dashboard.view','org.view','employees.view','roles.view','products.view','stock.view','orders.view','orders.manage','production.view','tasks.view','reports.view','audit.view');

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'hr', key FROM public.permissions
WHERE key IN ('dashboard.view','org.view','employees.view','employees.manage','reports.view');

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'production_manager', key FROM public.permissions
WHERE key IN ('dashboard.view','org.view','org.manage','employees.view','products.view','stock.view','orders.view','production.view','production.manage','tasks.view','tasks.assign','reports.view');

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'warehouse', key FROM public.permissions
WHERE key IN ('dashboard.view','org.view','products.view','products.manage','stock.view','stock.manage','orders.view','reports.view');

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'unit_manager', key FROM public.permissions
WHERE key IN ('dashboard.view','org.view','employees.view','production.view','tasks.view','tasks.assign','stock.view');

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'staff', key FROM public.permissions
WHERE key IN ('dashboard.view','tasks.view');

-- DEMO ORGANIZATION
INSERT INTO public.departments (name, code, description, is_demo) VALUES
  ('Üretim','DEP-URE','Ana üretim departmanı', true),
  ('Depo & Lojistik','DEP-DEP','Hammadde ve mamul depoları', true),
  ('Kalite Kontrol','DEP-KAL','Ürün kalite denetimi', true),
  ('İnsan Kaynakları','DEP-IK','Personel ve bordro işlemleri', true),
  ('Bakım & Onarım','DEP-BAK','Makine bakım ekibi', true);

INSERT INTO public.units (department_id, name, code, description, is_demo)
SELECT d.id, u.name, u.code, u.description, true
FROM public.departments d
JOIN (VALUES
  ('DEP-URE','Kesim','BIR-KES','CNC ve giyotin kesim hattı'),
  ('DEP-URE','Montaj','BIR-MON','Ürün montaj hattı'),
  ('DEP-URE','Paketleme','BIR-PAK','Paketleme ve etiketleme'),
  ('DEP-URE','Boya','BIR-BOY','Toz boya fırın hattı'),
  ('DEP-DEP','Hammadde Deposu','BIR-HAM','Sac ve profil stoğu'),
  ('DEP-DEP','Mamul Deposu','BIR-MAM','Sevkiyata hazır ürünler'),
  ('DEP-KAL','Giriş Kalite','BIR-GKL','Gelen malzeme kontrolü'),
  ('DEP-BAK','Mekanik Bakım','BIR-MEK','Mekanik arıza ekibi')
) AS u(dep_code, name, code, description) ON u.dep_code = d.code;