ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_benefit boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_transactions_is_benefit
  ON public.transactions (family_id, is_benefit)
  WHERE is_benefit = true;