DO $$ BEGIN
  BEGIN PERFORM cron.unschedule('generate-recurring-invoices-daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('generate-invoices-daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('cron-trial-expiry-daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;