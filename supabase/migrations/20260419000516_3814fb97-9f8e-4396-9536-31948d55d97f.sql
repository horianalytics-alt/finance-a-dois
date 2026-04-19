-- 1) Garante precisão financeira: amount tem que ser numeric (não integer)
DO $$
DECLARE
  current_type text;
BEGIN
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'amount';

  IF current_type = 'integer' OR current_type = 'bigint' THEN
    ALTER TABLE public.transactions
      ALTER COLUMN amount TYPE numeric(14,2) USING (amount::numeric / 100);
  END IF;
END $$;

-- 2) Habilita pg_net pra chamadas HTTP a partir do banco
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 3) Função que dispara a edge function send-push
CREATE OR REPLACE FUNCTION public.notify_push_on_tx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _url text := 'https://vsznsyotaonughskoxjl.supabase.co/functions/v1/send-push';
  _payload jsonb;
BEGIN
  _payload := jsonb_build_object(
    'id', NEW.id,
    'family_id', NEW.family_id,
    'profile_id', NEW.profile_id,
    'created_by_id', NEW.created_by_id,
    'description', NEW.description,
    'amount', NEW.amount,
    'type', NEW.type
  );

  PERFORM extensions.http_post(
    url := _url,
    body := _payload,
    headers := jsonb_build_object('Content-Type', 'application/json')
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- nunca falha o INSERT por causa de push
  RETURN NEW;
END;
$$;

-- 4) Trigger AFTER INSERT
DROP TRIGGER IF EXISTS trg_notify_push_on_tx ON public.transactions;
CREATE TRIGGER trg_notify_push_on_tx
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_push_on_tx();