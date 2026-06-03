INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
WHERE email IN ('sandro@maissabor.ind.br','sandro.rodigheiro.pereira@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;