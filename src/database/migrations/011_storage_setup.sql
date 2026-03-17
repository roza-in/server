-- ============================================================
-- ROZX Healthcare Platform — Migration 011
-- Supabase Storage Setup (Buckets & Policies)
-- ============================================================
-- Depends on: 010 (RLS helper functions)
-- ============================================================

-- ======================== BUCKETS ========================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public', 'public', true, 5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'private', 'private', false, 10485760,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- ======================== PUBLIC BUCKET POLICIES ========================

-- Avatars: anyone can view
CREATE POLICY "Public Avatars View"
ON storage.objects FOR SELECT
USING (bucket_id = 'public' AND (storage.foldername(name))[1] = 'avatars');

CREATE POLICY "User Avatar Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'public'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "User Avatar Update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'public'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "User Avatar Delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'public'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Covers
CREATE POLICY "Public Covers View"
ON storage.objects FOR SELECT
USING (bucket_id = 'public' AND (storage.foldername(name))[1] = 'covers');

CREATE POLICY "User Cover Manage"
ON storage.objects FOR ALL
USING (
  bucket_id = 'public'
  AND (storage.foldername(name))[1] = 'covers'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Photos
CREATE POLICY "Public Photos View"
ON storage.objects FOR SELECT
USING (bucket_id = 'public' AND (storage.foldername(name))[1] = 'photos');

CREATE POLICY "User Photos Manage"
ON storage.objects FOR ALL
USING (
  bucket_id = 'public'
  AND (storage.foldername(name))[1] = 'photos'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Medicines: anyone views, pharmacy/admin manage
CREATE POLICY "Public Medicines View"
ON storage.objects FOR SELECT
USING (bucket_id = 'public' AND (storage.foldername(name))[1] = 'medicines');

CREATE POLICY "Pharmacy Medicine Manage"
ON storage.objects FOR ALL
USING (
  bucket_id = 'public'
  AND (storage.foldername(name))[1] = 'medicines'
  AND (public.is_pharmacy() OR public.is_admin())
);

-- ======================== PRIVATE BUCKET POLICIES ========================

-- Hospital documents
CREATE POLICY "Hospital Docs View"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'private'
  AND (storage.foldername(name))[1] = 'documents'
  AND (
    public.is_admin()
    OR (storage.foldername(name))[2]::uuid IN (
      SELECT id FROM public.hospitals WHERE admin_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Hospital Docs Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'private'
  AND (storage.foldername(name))[1] = 'documents'
  AND (storage.foldername(name))[2]::uuid IN (
    SELECT id FROM public.hospitals WHERE admin_user_id = auth.uid()
  )
);

-- Prescriptions
CREATE POLICY "Prescription View"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'private'
  AND (storage.foldername(name))[1] = 'prescriptions'
  AND (
    auth.uid()::text = (storage.foldername(name))[2]
    OR public.is_pharmacy()
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.doctors WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Prescription Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'private'
  AND (storage.foldername(name))[1] = 'prescriptions'
  AND EXISTS (SELECT 1 FROM public.doctors WHERE user_id = auth.uid())
);

-- Patient reports
CREATE POLICY "Reports View"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'private'
  AND (storage.foldername(name))[1] = 'reports'
  AND (
    auth.uid()::text = (storage.foldername(name))[2]
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.doctors WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Reports Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'private'
  AND (storage.foldername(name))[1] = 'reports'
  AND (
    auth.uid()::text = (storage.foldername(name))[2]
    OR EXISTS (SELECT 1 FROM public.doctors WHERE user_id = auth.uid())
  )
);
