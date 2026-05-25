
CREATE TABLE public.regional_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regional text NOT NULL,
  nome text NOT NULL,
  email text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.regional_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage regional_managers" ON public.regional_managers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated read regional_managers" ON public.regional_managers
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.system_config (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage system_config" ON public.system_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated read system_config" ON public.system_config
  FOR SELECT TO authenticated USING (true);
