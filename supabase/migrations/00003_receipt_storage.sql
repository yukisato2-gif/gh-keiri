-- Receipt image storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload receipts
CREATE POLICY "receipts_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');

-- Storage RLS: authenticated users can read receipts
CREATE POLICY "receipts_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipts');

-- Storage RLS: uploaders can delete their own receipts
CREATE POLICY "receipts_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
