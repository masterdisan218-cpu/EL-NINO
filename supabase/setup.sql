CREATE TABLE IF NOT EXISTS public.site_content (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('product', 'update', 'page', 'content')),
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

ALTER TABLE public.site_content
  ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE public.site_content
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.site_content
  DROP CONSTRAINT IF EXISTS site_content_kind_check;
UPDATE public.site_content
SET published_at = GREATEST(
      COALESCE(published_at, updated_at, statement_timestamp()),
      COALESCE(NULLIF(payload ->> 'scheduledAt', '')::timestamptz, statement_timestamp())
    ),
    expires_at = COALESCE(
      expires_at,
      GREATEST(
        COALESCE(published_at, updated_at, statement_timestamp()),
        COALESCE(NULLIF(payload ->> 'scheduledAt', '')::timestamptz, statement_timestamp())
      ) + interval '24 hours'
    )
WHERE kind = 'update' AND published;
UPDATE public.site_content
SET published_at = NULL, expires_at = NULL
WHERE kind != 'update' OR NOT published;
ALTER TABLE public.site_content
  ADD CONSTRAINT site_content_kind_check CHECK (kind IN ('product', 'update', 'page', 'content'));
ALTER TABLE public.site_content
  DROP CONSTRAINT IF EXISTS update_expiry_state;
ALTER TABLE public.site_content
  ADD CONSTRAINT update_expiry_state CHECK (
    (kind = 'update' AND published AND published_at IS NOT NULL AND expires_at IS NOT NULL)
    OR (kind != 'update' AND published_at IS NULL AND expires_at IS NULL)
    OR (kind = 'update' AND NOT published AND published_at IS NULL AND expires_at IS NULL)
  );

CREATE INDEX IF NOT EXISTS site_content_public_kind
  ON public.site_content (kind, published, expires_at);
CREATE INDEX IF NOT EXISTS site_content_updated_at
  ON public.site_content (updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_site_content_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
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

CREATE TABLE IF NOT EXISTS public.admin_users (
  username text PRIMARY KEY,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_username_case_insensitive
  ON public.admin_users (lower(username));
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_users FROM anon, authenticated;
GRANT ALL ON public.admin_users TO service_role;

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  sid text PRIMARY KEY,
  sess jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON public.admin_sessions (expires_at);
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_sessions FROM anon, authenticated;
GRANT ALL ON public.admin_sessions TO service_role;

CREATE TABLE IF NOT EXISTS public.site_state (
  key text PRIMARY KEY,
  value text NOT NULL
);
ALTER TABLE public.site_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_state FROM anon, authenticated;
GRANT ALL ON public.site_state TO service_role;
CREATE TABLE IF NOT EXISTS public.admin_audit (
  id uuid PRIMARY KEY,
  actor text NOT NULL,
  action text NOT NULL,
  content_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE INDEX IF NOT EXISTS admin_audit_created_at ON public.admin_audit (created_at DESC);
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit FROM anon, authenticated;
GRANT ALL ON public.admin_audit TO service_role;

CREATE TABLE IF NOT EXISTS public.page_views (
  day date NOT NULL,
  page_path text NOT NULL,
  views bigint NOT NULL DEFAULT 0 CHECK (views >= 0),
  PRIMARY KEY (day, page_path)
);
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.page_views FROM anon, authenticated;
GRANT ALL ON public.page_views TO service_role;

CREATE OR REPLACE FUNCTION public.record_site_page_view(view_day date, view_path text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.page_views (day, page_path, views)
  VALUES (view_day, view_path, 1)
  ON CONFLICT (day, page_path)
  DO UPDATE SET views = public.page_views.views + 1;
$$;
REVOKE ALL ON FUNCTION public.record_site_page_view(date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_site_page_view(date, text) TO service_role;

CREATE TABLE IF NOT EXISTS public.admin_login_limits (
  key text PRIMARY KEY,
  hit_count integer NOT NULL CHECK (hit_count > 0),
  reset_at timestamptz NOT NULL
);
ALTER TABLE public.admin_login_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_login_limits FROM anon, authenticated;
GRANT ALL ON public.admin_login_limits TO service_role;

CREATE OR REPLACE FUNCTION public.record_admin_login_attempt(limit_key text, window_seconds integer)
RETURNS TABLE(total_hits integer, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  now_at timestamptz := statement_timestamp();
BEGIN
  INSERT INTO public.admin_login_limits AS limits (key, hit_count, reset_at)
  VALUES (limit_key, 1, now_at + make_interval(secs => window_seconds))
  ON CONFLICT (key) DO UPDATE SET
    hit_count = CASE
      WHEN limits.reset_at <= now_at THEN 1
      ELSE limits.hit_count + 1
    END,
    reset_at = CASE
      WHEN limits.reset_at <= now_at THEN now_at + make_interval(secs => window_seconds)
      ELSE limits.reset_at
    END
  RETURNING limits.hit_count, limits.reset_at
  INTO total_hits, reset_at;

  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.record_admin_login_attempt(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_admin_login_attempt(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.decrement_admin_login_attempt(limit_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.admin_login_limits
  WHERE key = limit_key AND hit_count <= 1;

  UPDATE public.admin_login_limits
  SET hit_count = hit_count - 1
  WHERE key = limit_key AND hit_count > 1;
END;
$$;
REVOKE ALL ON FUNCTION public.decrement_admin_login_attempt(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_admin_login_attempt(text) TO service_role;

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
