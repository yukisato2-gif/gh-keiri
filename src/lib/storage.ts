import { supabase } from './supabase'

const BUCKET = 'receipts'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * Upload a receipt image to Supabase Storage.
 * Path: {userId}/{timestamp}_{filename}
 */
export async function uploadReceiptImage(
  file: File,
  userId: string
): Promise<{ path: string | null; error: string | null }> {
  if (!supabase) {
    // Demo mode: return a fake path
    return { path: `demo/${file.name}`, error: null }
  }

  if (file.size > MAX_SIZE) {
    return { path: null, error: 'ファイルサイズが5MBを超えています' }
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  if (!allowedTypes.includes(file.type)) {
    return { path: null, error: '対応していないファイル形式です（JPEG, PNG, WebP, HEICのみ）' }
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const filePath = `${userId}/${Date.now()}_receipt.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { upsert: false })

  if (error) {
    return { path: null, error: `アップロードに失敗しました: ${error.message}` }
  }

  return { path: filePath, error: null }
}

/**
 * Get a signed URL for a receipt image (valid for 1 hour).
 */
export async function getReceiptImageUrl(
  path: string
): Promise<string | null> {
  if (!supabase) return null
  if (path.startsWith('demo/')) return null

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600) // 1 hour

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}
