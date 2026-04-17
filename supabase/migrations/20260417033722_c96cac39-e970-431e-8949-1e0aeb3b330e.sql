-- ============================================================
-- RESET TOTAL: drop tabelas e funções antigas
-- ============================================================
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.family_members CASCADE;
DROP TABLE IF EXISTS public.families CASCADE;

DROP FUNCTION IF EXISTS public.create_family(text) CASCADE;
DROP FUNCTION IF EXISTS public.join_family_by_code(text) CASCADE;
DROP FUNCTION IF EXISTS public.is_family_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_family(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.generate_invite_code() CASCADE;

DROP TYPE IF EXISTS public.transaction_type CASCADE;

-- ============================================================
-- ENUM
-- ============================================================
CREATE TYPE public.transaction_type AS ENUM ('receita', 'despesa', 'investimento');

-- ============================================================
-- FAMILIES
-- ============================================================
CREATE TABLE public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES (1 por usuário, ligado à família)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_family ON public.profiles(family_id);
CREATE INDEX idx_profiles_user ON public.profiles(user_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECURITY DEFINER helpers (evitam recursão em RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_family_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_in_family(_user_id UUID, _family_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND family_id = _family_id
  )
$$;

CREATE OR REPLACE FUNCTION public.generate_family_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.transaction_type NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_family ON public.categories(family_id);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PAYMENT METHODS
-- ============================================================
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_methods_family ON public.payment_methods(family_id);
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type public.transaction_type NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  -- DATE puro: sem timezone, exatamente o que o usuário digitou
  date DATE NOT NULL,
  -- timestamp original de inserção (mantém-se mesmo nas parcelas geradas para mostrar quando foi cadastrada)
  created_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  is_benefit BOOLEAN NOT NULL DEFAULT false,
  recurrence_months INT NOT NULL DEFAULT 1,
  recurrence_index INT NOT NULL DEFAULT 1,
  recurrence_parent_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  paid_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_family ON public.transactions(family_id);
CREATE INDEX idx_transactions_date ON public.transactions(date);
CREATE INDEX idx_transactions_family_date ON public.transactions(family_id, date);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- RPC: criar família + perfil em uma única transação
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_family_and_profile(_name TEXT)
RETURNS TABLE(family_id UUID, family_code TEXT, profile_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _family_id UUID;
  _profile_id UUID;
  _code TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'User already has a profile';
  END IF;

  LOOP
    _code := public.generate_family_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.families WHERE code = _code);
  END LOOP;

  INSERT INTO public.families (code) VALUES (_code) RETURNING id INTO _family_id;

  INSERT INTO public.profiles (user_id, family_id, name)
  VALUES (_user_id, _family_id, _name)
  RETURNING id INTO _profile_id;

  RETURN QUERY SELECT _family_id, _code, _profile_id;
END;
$$;

-- ============================================================
-- RPC: entrar em família via código
-- ============================================================
CREATE OR REPLACE FUNCTION public.join_family_and_create_profile(_code TEXT, _name TEXT)
RETURNS TABLE(family_id UUID, profile_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _family_id UUID;
  _profile_id UUID;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'User already has a profile';
  END IF;

  SELECT id INTO _family_id FROM public.families WHERE code = upper(_code) LIMIT 1;

  IF _family_id IS NULL THEN
    RAISE EXCEPTION 'Invalid code';
  END IF;

  INSERT INTO public.profiles (user_id, family_id, name)
  VALUES (_user_id, _family_id, _name)
  RETURNING id INTO _profile_id;

  RETURN QUERY SELECT _family_id, _profile_id;
END;
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- families
CREATE POLICY "view own family" ON public.families
FOR SELECT TO authenticated
USING (public.is_in_family(auth.uid(), id));

-- profiles
CREATE POLICY "view family profiles" ON public.profiles
FOR SELECT TO authenticated
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "delete own profile" ON public.profiles
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- profiles INSERT é feito pelas RPC SECURITY DEFINER, não precisa policy de insert do cliente
-- Mas precisamos de uma para o caso direto:
CREATE POLICY "insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- categories
CREATE POLICY "view family categories" ON public.categories
FOR SELECT TO authenticated
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "insert family categories" ON public.categories
FOR INSERT TO authenticated
WITH CHECK (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "update family categories" ON public.categories
FOR UPDATE TO authenticated
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "delete family categories" ON public.categories
FOR DELETE TO authenticated
USING (family_id = public.get_user_family_id(auth.uid()));

-- payment_methods
CREATE POLICY "view family pms" ON public.payment_methods
FOR SELECT TO authenticated
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "insert family pms" ON public.payment_methods
FOR INSERT TO authenticated
WITH CHECK (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "update family pms" ON public.payment_methods
FOR UPDATE TO authenticated
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "delete family pms" ON public.payment_methods
FOR DELETE TO authenticated
USING (family_id = public.get_user_family_id(auth.uid()));

-- transactions
CREATE POLICY "view family transactions" ON public.transactions
FOR SELECT TO authenticated
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "insert family transactions" ON public.transactions
FOR INSERT TO authenticated
WITH CHECK (
  family_id = public.get_user_family_id(auth.uid())
  AND user_id = auth.uid()
);

CREATE POLICY "update own transactions" ON public.transactions
FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "delete own transactions" ON public.transactions
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- ============================================================
-- STORAGE: bucket público para avatares
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);