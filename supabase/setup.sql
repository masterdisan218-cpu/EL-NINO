CREATE TABLE IF NOT EXISTS public.site_content (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('product', 'update')),
  payload jsonb NOT NULL,
  published boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  published_at timestamptz,
  expires_at timestamptz,
  CONSTRAINT update_expiry_state CHECK (
    (kind = 'update' AND published AND published_at IS NOT NULL AND expires_at IS NOT NULL)
    OR (kind != 'update' AND published_at IS NULL AND expires_at IS NULL)
    OR (kind = 'update' AND NOT published AND published_at IS NULL AND expires_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS site_content_public_kind
  ON public.site_content (kind, published, expires_at);
CREATE INDEX IF NOT EXISTS site_content_updated_at
  ON public.site_content (updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_site_content_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  publication_time timestamptz;
  schedule_value text;
  reset_publication_window boolean;
BEGIN
  NEW.updated_at := statement_timestamp();

  IF NEW.kind = 'update' AND NEW.published THEN
    IF TG_OP = 'INSERT' THEN
      reset_publication_window := true;
    ELSE
      reset_publication_window :=
        OLD.published IS DISTINCT FROM NEW.published
        OR OLD.kind IS DISTINCT FROM NEW.kind
        OR OLD.payload ->> 'scheduledAt' IS DISTINCT FROM NEW.payload ->> 'scheduledAt';
    END IF;

    IF reset_publication_window THEN
      schedule_value := NULLIF(NEW.payload ->> 'scheduledAt', '');
      publication_time := GREATEST(
        statement_timestamp(),
        COALESCE(schedule_value::timestamptz, statement_timestamp())
      );
      NEW.published_at := publication_time;
      NEW.expires_at := publication_time + interval '24 hours';
    ELSE
      NEW.published_at := OLD.published_at;
      NEW.expires_at := OLD.expires_at;
    END IF;
  ELSE
    NEW.published_at := NULL;
    NEW.expires_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS site_content_set_timestamps ON public.site_content;
CREATE TRIGGER site_content_set_timestamps
  BEFORE INSERT OR UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.set_site_content_timestamps();

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_content_read_active_public ON public.site_content;
CREATE POLICY site_content_read_active_public
  ON public.site_content
  FOR SELECT
  TO anon, authenticated
  USING (
    published
    AND (
      kind != 'update'
      OR expires_at > statement_timestamp()
    )
    AND (
      NULLIF(payload ->> 'scheduledAt', '') IS NULL
      OR NULLIF(payload ->> 'scheduledAt', '')::timestamptz <= statement_timestamp()
    )
  );

REVOKE ALL ON public.site_content FROM anon, authenticated;
GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT ALL ON public.site_content TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-media', 'site-media', true, 5242880, ARRAY['image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS site_media_public_read ON storage.objects;
CREATE POLICY site_media_public_read
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'site-media');

DROP POLICY IF EXISTS site_media_block_client_writes ON storage.objects;
CREATE POLICY site_media_block_client_writes
  ON storage.objects
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
