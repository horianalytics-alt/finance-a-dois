-- 1. Adicionar created_by_id em transactions (perfil que inseriu de fato)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS created_by_id UUID;

-- Backfill: created_by_id := profile_id pra dados existentes
UPDATE public.transactions SET created_by_id = profile_id WHERE created_by_id IS NULL;

ALTER TABLE public.transactions
  ALTER COLUMN created_by_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON public.transactions(created_by_id);
CREATE INDEX IF NOT EXISTS idx_transactions_family_date ON public.transactions(family_id, date DESC);

-- 2. Tabela push_subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_family ON public.push_subscriptions(family_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_profile ON public.push_subscriptions(profile_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view family push subs"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "insert own push subs"
  ON public.push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "update own push subs"
  ON public.push_subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "delete own push subs"
  ON public.push_subscriptions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER touch_push_subs
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Nova RPC: criar família + 2 perfis (mesma conta controla os dois)
CREATE OR REPLACE FUNCTION public.create_family_with_two_profiles(
  _name1 TEXT,
  _name2 TEXT
)
RETURNS TABLE(family_id UUID, family_code TEXT, profile1_id UUID, profile2_id UUID)
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

  -- Se a conta já tem profile, recupera a família ao invés de criar de novo
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

  -- Categorias padrão de receita
  INSERT INTO public.categories (family_id, name, type, sort_order) VALUES
    (_family_id, 'Salário', 'receita', 1),
    (_family_id, 'Freelance', 'receita', 2),
    (_family_id, 'Investimentos', 'receita', 3),
    (_family_id, 'Outros', 'receita', 99);

  -- Categorias padrão de despesa
  INSERT INTO public.categories (family_id, name, type, sort_order) VALUES
    (_family_id, 'Mercado', 'despesa', 1),
    (_family_id, 'Moradia', 'despesa', 2),
    (_family_id, 'Transporte', 'despesa', 3),
    (_family_id, 'Saúde', 'despesa', 4),
    (_family_id, 'Lazer', 'despesa', 5),
    (_family_id, 'Restaurante', 'despesa', 6),
    (_family_id, 'Assinaturas', 'despesa', 7),
    (_family_id, 'Outros', 'despesa', 99);

  -- Categorias padrão de investimento
  INSERT INTO public.categories (family_id, name, type, sort_order) VALUES
    (_family_id, 'Renda Fixa', 'investimento', 1),
    (_family_id, 'Ações', 'investimento', 2),
    (_family_id, 'Fundos', 'investimento', 3),
    (_family_id, 'Cripto', 'investimento', 4),
    (_family_id, 'Outros', 'investimento', 99);

  -- Formas de pagamento padrão
  INSERT INTO public.payment_methods (family_id, name, sort_order) VALUES
    (_family_id, 'Pix', 1),
    (_family_id, 'Débito', 2),
    (_family_id, 'Crédito', 3),
    (_family_id, 'Dinheiro', 4),
    (_family_id, 'Boleto', 5),
    (_family_id, 'Transferência', 6);

  RETURN QUERY SELECT _family_id, _code, _p1_id, _p2_id;
END;
$function$;

-- 4. Realtime: habilitar replica identity full e adicionar à publication
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;