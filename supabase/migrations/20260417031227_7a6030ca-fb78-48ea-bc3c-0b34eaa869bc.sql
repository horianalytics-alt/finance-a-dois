
-- Enum para tipo de transação
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');

-- Tabela families
CREATE TABLE public.families (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela family_members (relação usuário <-> família)
CREATE TABLE public.family_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_family_members_family ON public.family_members(family_id);

-- Tabela transactions
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  type public.transaction_type NOT NULL,
  category TEXT,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_family ON public.transactions(family_id);
CREATE INDEX idx_transactions_date ON public.transactions(occurred_on DESC);

-- Função SECURITY DEFINER para checar se o usuário é membro de uma família
-- (evita recursão infinita nas RLS policies)
CREATE OR REPLACE FUNCTION public.is_family_member(_user_id UUID, _family_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = _user_id AND family_id = _family_id
  )
$$;

-- Função para retornar a família atual do usuário
CREATE OR REPLACE FUNCTION public.get_user_family(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM public.family_members WHERE user_id = _user_id LIMIT 1
$$;

-- Função para gerar invite_code único
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER families_updated_at BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- POLICIES: families
-- Membros podem ver sua família
CREATE POLICY "Members can view their family"
  ON public.families FOR SELECT
  TO authenticated
  USING (public.is_family_member(auth.uid(), id));

-- Qualquer autenticado pode buscar família por invite_code (necessário para join)
-- Implementado via uma view/função separada abaixo. Mantemos SELECT restrito.
-- Para join, usamos uma função SECURITY DEFINER.

-- Usuários autenticados podem criar família (eles mesmos como created_by)
CREATE POLICY "Users can create a family"
  ON public.families FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Apenas membros podem atualizar a família
CREATE POLICY "Members can update their family"
  ON public.families FOR UPDATE
  TO authenticated
  USING (public.is_family_member(auth.uid(), id));

-- POLICIES: family_members
-- Membros podem ver os outros membros da mesma família
CREATE POLICY "Members can view family members"
  ON public.family_members FOR SELECT
  TO authenticated
  USING (public.is_family_member(auth.uid(), family_id));

-- Usuários podem se adicionar a uma família (via insert direto após validar código no cliente)
CREATE POLICY "Users can join a family"
  ON public.family_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem sair de uma família (deletar seu próprio registro)
CREATE POLICY "Users can leave their family"
  ON public.family_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- POLICIES: transactions
-- Membros podem ver todas as transações da família
CREATE POLICY "Members can view family transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (public.is_family_member(auth.uid(), family_id));

-- Membros podem criar transações na sua família
CREATE POLICY "Members can create transactions in their family"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_family_member(auth.uid(), family_id)
  );

-- Apenas o criador pode atualizar
CREATE POLICY "Owners can update their transactions"
  ON public.transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Apenas o criador pode deletar
CREATE POLICY "Owners can delete their transactions"
  ON public.transactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Função SECURITY DEFINER para entrar em família via código de convite
-- (permite buscar a família sem expor toda a tabela)
CREATE OR REPLACE FUNCTION public.join_family_by_code(_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _family_id UUID;
  _user_id UUID := auth.uid();
  _existing_family UUID;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verifica se o usuário já está em uma família
  SELECT family_id INTO _existing_family
  FROM public.family_members WHERE user_id = _user_id LIMIT 1;

  IF _existing_family IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to a family';
  END IF;

  -- Busca a família pelo código
  SELECT id INTO _family_id
  FROM public.families WHERE invite_code = upper(_invite_code) LIMIT 1;

  IF _family_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  -- Adiciona o usuário à família
  INSERT INTO public.family_members (family_id, user_id)
  VALUES (_family_id, _user_id);

  RETURN _family_id;
END;
$$;

-- Função para criar família e adicionar criador como membro automaticamente
CREATE OR REPLACE FUNCTION public.create_family(_name TEXT)
RETURNS TABLE(family_id UUID, invite_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _new_family_id UUID;
  _new_code TEXT;
  _existing_family UUID;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verifica se o usuário já está em uma família
  SELECT fm.family_id INTO _existing_family
  FROM public.family_members fm WHERE fm.user_id = _user_id LIMIT 1;

  IF _existing_family IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to a family';
  END IF;

  -- Gera código único
  LOOP
    _new_code := public.generate_invite_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.families WHERE families.invite_code = _new_code);
  END LOOP;

  -- Cria família
  INSERT INTO public.families (name, invite_code, created_by)
  VALUES (_name, _new_code, _user_id)
  RETURNING id INTO _new_family_id;

  -- Adiciona criador como membro
  INSERT INTO public.family_members (family_id, user_id)
  VALUES (_new_family_id, _user_id);

  RETURN QUERY SELECT _new_family_id, _new_code;
END;
$$;
