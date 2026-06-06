-- ============================================================
-- KAMI — Supabase Storage Buckets & Policies Setup
-- Run this script in the Supabase SQL Editor to set up storage
-- ============================================================

-- Create Storage Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/heic']),
  ('journal_images', 'journal_images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/heic']),
  ('letter_images', 'letter_images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/heic']),
  ('memory_images', 'memory_images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/heic']),
  ('goal_images', 'goal_images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/heic'])
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can read own avatar" ON storage.objects FOR SELECT USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Journal storage policies
DROP POLICY IF EXISTS "Users can read own journal images" ON storage.objects;
DROP POLICY IF EXISTS "Users can insert own journal images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own journal images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own journal images" ON storage.objects;

CREATE POLICY "Users can read own journal images" ON storage.objects FOR SELECT USING (bucket_id = 'journal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can insert own journal images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'journal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own journal images" ON storage.objects FOR UPDATE USING (bucket_id = 'journal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own journal images" ON storage.objects FOR DELETE USING (bucket_id = 'journal_images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Letters storage policies
DROP POLICY IF EXISTS "Users can read own letter images" ON storage.objects;
DROP POLICY IF EXISTS "Users can insert own letter images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own letter images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own letter images" ON storage.objects;

CREATE POLICY "Users can read own letter images" ON storage.objects FOR SELECT USING (bucket_id = 'letter_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can insert own letter images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'letter_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own letter images" ON storage.objects FOR UPDATE USING (bucket_id = 'letter_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own letter images" ON storage.objects FOR DELETE USING (bucket_id = 'letter_images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Memories storage policies
DROP POLICY IF EXISTS "Users can read own memory images" ON storage.objects;
DROP POLICY IF EXISTS "Users can insert own memory images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own memory images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own memory images" ON storage.objects;

CREATE POLICY "Users can read own memory images" ON storage.objects FOR SELECT USING (bucket_id = 'memory_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can insert own memory images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'memory_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own memory images" ON storage.objects FOR UPDATE USING (bucket_id = 'memory_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own memory images" ON storage.objects FOR DELETE USING (bucket_id = 'memory_images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Goals storage policies
DROP POLICY IF EXISTS "Users can read own goal images" ON storage.objects;
DROP POLICY IF EXISTS "Users can insert own goal images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own goal images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own goal images" ON storage.objects;

CREATE POLICY "Users can read own goal images" ON storage.objects FOR SELECT USING (bucket_id = 'goal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can insert own goal images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'goal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own goal images" ON storage.objects FOR UPDATE USING (bucket_id = 'goal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own goal images" ON storage.objects FOR DELETE USING (bucket_id = 'goal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
