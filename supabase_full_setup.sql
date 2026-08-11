-- ============================================================
-- SatyaKavach Complete Supabase Database Setup Script
-- Copy and run this entire script in Supabase SQL Editor
-- (Supabase Dashboard -> SQL Editor -> New Query -> Run)
-- ============================================================

-- 1. Enable vector extension for AI semantic caching
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Custom Users Table (for JWT authentication)
CREATE TABLE IF NOT EXISTS public.users_custom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. User Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Analysis History Table
CREATE TABLE IF NOT EXISTS public.analysis_history (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        REFERENCES public.users_custom(id) ON DELETE CASCADE NOT NULL,
  content      TEXT        NOT NULL,
  input_hash   TEXT        NOT NULL DEFAULT '',
  verdict      TEXT        NOT NULL DEFAULT 'UNVERIFIED'
                           CHECK (verdict IN ('REAL', 'FAKE', 'MISLEADING', 'UNVERIFIED')),
  confidence   INTEGER     NOT NULL DEFAULT 0,
  risk_score   INTEGER     NOT NULL DEFAULT 0,
  explanation  TEXT        NOT NULL DEFAULT '',
  key_points   JSONB       NOT NULL DEFAULT '[]',
  sources      JSONB       NOT NULL DEFAULT '[]',
  categories   JSONB       NOT NULL DEFAULT '{}',
  flagged      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Global AI Hybrid Cache Table
CREATE TABLE IF NOT EXISTS public.analysis_cache (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query_text        TEXT NOT NULL,
  query_embedding   vector(768) NOT NULL,
  url_hash          TEXT,
  source_urls       TEXT[] NOT NULL DEFAULT '{}',
  result            JSONB NOT NULL,
  credibility_score INTEGER NOT NULL DEFAULT 0,
  search_count      INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Admin Activity Logs Table
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id    UUID        REFERENCES public.users_custom(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL CHECK (action IN ('delete', 'flag', 'unflag', 'role_change')),
  target_type TEXT        NOT NULL CHECK (target_type IN ('analysis', 'user')),
  target_id   TEXT        NOT NULL,
  details     TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_analysis_user ON public.analysis_history(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_created ON public.analysis_history(created_at DESC);
CREATE INDEX IF NOT EXISTS analysis_cache_url_hash_idx ON public.analysis_cache (url_hash);

-- 8. Vector Similarity Match Function for AI Cache
CREATE OR REPLACE FUNCTION public.match_analysis_cache(
  query_embedding vector(768),
  match_threshold float,
  match_count int DEFAULT 1
)
RETURNS TABLE (
  id uuid,
  query_text text,
  url_hash text,
  source_urls text[],
  result jsonb,
  credibility_score integer,
  search_count integer,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.id,
    ac.query_text,
    ac.url_hash,
    ac.source_urls,
    ac.result,
    ac.credibility_score,
    ac.search_count,
    ac.created_at,
    1 - (ac.query_embedding <=> query_embedding) AS similarity
  FROM public.analysis_cache ac
  WHERE 1 - (ac.query_embedding <=> query_embedding) > match_threshold
  ORDER BY ac.query_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 9. Row Level Security & Access Policies
ALTER TABLE public.users_custom ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_cache ENABLE ROW LEVEL SECURITY;

-- Allow service_role access for backend API operations
DROP POLICY IF EXISTS "Allow service_role access users" ON public.users_custom;
CREATE POLICY "Allow service_role access users" ON public.users_custom FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Public cache select" ON public.analysis_cache;
CREATE POLICY "Public cache select" ON public.analysis_cache FOR SELECT USING (true);
