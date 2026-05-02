-- 1) accounts table
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('corrente','beneficio')),
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_family ON public.accounts(family_id);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view family accounts"
ON public.accounts
FOR SELECT
TO authenticated
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "insert family accounts"
ON public.accounts
FOR INSERT
TO authenticated
WITH CHECK (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "update family accounts"
ON public.accounts
FOR UPDATE
TO authenticated
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "delete family accounts"
ON public.accounts
FOR DELETE
TO authenticated
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE TRIGGER trg_accounts_touch
BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Seed accounts for every existing family
INSERT INTO public.accounts (family_id, name, type, sort_order)
SELECT f.id, 'Conta Corrente', 'corrente', 1 FROM public.families f
ON CONFLICT DO NOTHING;

INSERT INTO public.accounts (family_id, name, type, sort_order)
SELECT f.id, 'Cartão Swile', 'beneficio', 2 FROM public.families f
ON CONFLICT DO NOTHING;

-- 3) Add account_id on transactions (nullable first, then backfill, then NOT NULL)
ALTER TABLE public.transactions
ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE RESTRICT;

-- Backfill: is_benefit=true → benefit account; else → corrente account, scoped to same family
UPDATE public.transactions t
SET account_id = a.id
FROM public.accounts a
WHERE t.account_id IS NULL
  AND a.family_id = t.family_id
  AND a.type = 'beneficio'
  AND t.is_benefit = true;

UPDATE public.transactions t
SET account_id = a.id
FROM public.accounts a
WHERE t.account_id IS NULL
  AND a.family_id = t.family_id
  AND a.type = 'corrente';

ALTER TABLE public.transactions
ALTER COLUMN account_id SET NOT NULL;

CREATE INDEX idx_transactions_account ON public.transactions(account_id);

-- 4) Update create_family_with_two_profiles to also seed default accounts
CREATE OR REPLACE FUNCTION public.create_family_with_two_profiles(_name1 text, _name2 text)
 RETURNS TABLE(family_id uuid, family_code text, profile1_id uuid, profile2_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID := auth.uid();
  _family_id UUID;
  _p1_id UUID;
  _p2_id UUID;
  _code TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT public.get_user_family_id(_user_id) INTO _family_id;
  IF _family_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esta conta já está vinculada a uma família';
  END IF;

  LOOP
    _code := public.generate_family_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.families WHERE code = _code);
  END LOOP;

  INSERT INTO public.families (code) VALUES (_code) RETURNING id INTO _family_id;

  INSERT INTO public.profiles (user_id, family_id, name)
  VALUES (_user_id, _family_id, _name1)
  RETURNING id INTO _p1_id;

  INSERT INTO public.profiles (user_id, family_id, name)
  VALUES (_user_id, _family_id, _name2)
  RETURNING id INTO _p2_id;

  INSERT INTO public.categories (family_id, name, type, sort_order) VALUES
    (_family_id, 'Salário', 'receita', 1),
    (_family_id, 'Freelance', 'receita', 2),
    (_family_id, 'Investimentos', 'receita', 3),
    (_family_id, 'Outros', 'receita', 99);

  INSERT INTO public.categories (family_id, name, type, sort_order) VALUES
    (_family_id, 'Mercado', 'despesa', 1),
    (_family_id, 'Moradia', 'despesa', 2),
    (_family_id, 'Transporte', 'despesa', 3),
    (_family_id, 'Saúde', 'despesa', 4),
    (_family_id, 'Lazer', 'despesa', 5),
    (_family_id, 'Restaurante', 'despesa', 6),
    (_family_id, 'Assinaturas', 'despesa', 7),
    (_family_id, 'Outros', 'despesa', 99);

  INSERT INTO public.categories (family_id, name, type, sort_order) VALUES
    (_family_id, 'Renda Fixa', 'investimento', 1),
    (_family_id, 'Ações', 'investimento', 2),
    (_family_id, 'Fundos', 'investimento', 3),
    (_family_id, 'Cripto', 'investimento', 4),
    (_family_id, 'Outros', 'investimento', 99);

  INSERT INTO public.payment_methods (family_id, name, sort_order) VALUES
    (_family_id, 'Pix', 1),
    (_family_id, 'Débito', 2),
    (_family_id, 'Crédito', 3),
    (_family_id, 'Dinheiro', 4),
    (_family_id, 'Boleto', 5),
    (_family_id, 'Transferência', 6);

  INSERT INTO public.accounts (family_id, name, type, sort_order) VALUES
    (_family_id, 'Conta Corrente', 'corrente', 1),
    (_family_id, 'Cartão Swile', 'beneficio', 2);

  RETURN QUERY SELECT _family_id, _code, _p1_id, _p2_id;
END;
$function$;

-- Also update the single-profile variant for completeness
CREATE OR REPLACE FUNCTION public.create_family_and_profile(_name text)
 RETURNS TABLE(family_id uuid, family_code text, profile_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.accounts (family_id, name, type, sort_order) VALUES
    (_family_id, 'Conta Corrente', 'corrente', 1),
    (_family_id, 'Cartão Swile', 'beneficio', 2);

  RETURN QUERY SELECT _family_id, _code, _profile_id;
END;
$function$;