-- 1.1: owner column
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS owner TEXT NOT NULL DEFAULT 'casal'
  CHECK (owner IN ('heitor', 'carol', 'casal'));

-- 1.2: futile fields
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_futile BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS futile_label TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_is_futile
  ON public.transactions (family_id, date) WHERE is_futile = true;

-- 1.3: account_goals (scoped by family via account)
CREATE TABLE IF NOT EXISTS public.account_goals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID NOT NULL,
  account_id  UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,  -- formato 'YYYY-MM'
  goal_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, month)
);

ALTER TABLE public.account_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view family account_goals" ON public.account_goals
  FOR SELECT TO authenticated
  USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "insert family account_goals" ON public.account_goals
  FOR INSERT TO authenticated
  WITH CHECK (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "update family account_goals" ON public.account_goals
  FOR UPDATE TO authenticated
  USING (family_id = public.get_user_family_id(auth.uid()))
  WITH CHECK (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "delete family account_goals" ON public.account_goals
  FOR DELETE TO authenticated
  USING (family_id = public.get_user_family_id(auth.uid()));

CREATE TRIGGER trg_account_goals_updated_at
  BEFORE UPDATE ON public.account_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 1.4: category_budgets with category_id FK
CREATE TABLE IF NOT EXISTS public.category_budgets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,  -- formato 'YYYY-MM'
  budget      NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, month)
);

ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view family category_budgets" ON public.category_budgets
  FOR SELECT TO authenticated
  USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "insert family category_budgets" ON public.category_budgets
  FOR INSERT TO authenticated
  WITH CHECK (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "update family category_budgets" ON public.category_budgets
  FOR UPDATE TO authenticated
  USING (family_id = public.get_user_family_id(auth.uid()))
  WITH CHECK (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "delete family category_budgets" ON public.category_budgets
  FOR DELETE TO authenticated
  USING (family_id = public.get_user_family_id(auth.uid()));

CREATE TRIGGER trg_category_budgets_updated_at
  BEFORE UPDATE ON public.category_budgets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 1.5: family_settings (per-family key/value)
CREATE TABLE IF NOT EXISTS public.family_settings (
  family_id  UUID NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, key)
);

ALTER TABLE public.family_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view family settings" ON public.family_settings
  FOR SELECT TO authenticated
  USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "insert family settings" ON public.family_settings
  FOR INSERT TO authenticated
  WITH CHECK (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "update family settings" ON public.family_settings
  FOR UPDATE TO authenticated
  USING (family_id = public.get_user_family_id(auth.uid()))
  WITH CHECK (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "delete family settings" ON public.family_settings
  FOR DELETE TO authenticated
  USING (family_id = public.get_user_family_id(auth.uid()));

CREATE TRIGGER trg_family_settings_updated_at
  BEFORE UPDATE ON public.family_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed defaults for existing families
INSERT INTO public.family_settings (family_id, key, value)
SELECT f.id, k.key, k.value
FROM public.families f
CROSS JOIN (VALUES
  ('futile_label', 'Bobeiras'),
  ('interest_poupanca', '6'),
  ('interest_cdi', '10'),
  ('interest_custom', '12'),
  ('interest_custom_label', 'Personalizada'),
  ('monthly_income', '0')
) AS k(key, value)
ON CONFLICT (family_id, key) DO NOTHING;