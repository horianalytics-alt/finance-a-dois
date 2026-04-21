
-- Enable the http extension if not already enabled
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Create trigger function that calls the send-push edge function
CREATE OR REPLACE FUNCTION public.notify_push_on_tx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
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
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_push_on_transaction_insert ON public.transactions;

-- Create trigger on INSERT
CREATE TRIGGER trg_push_on_transaction_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_on_tx();
