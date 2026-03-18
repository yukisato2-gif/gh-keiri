import { supabase } from './supabase'

export interface OCRResult {
  amount: number
  date?: string
  storeName?: string
  description?: string
}

/**
 * Resize image to max dimension and convert to base64 JPEG.
 * Reduces upload size and API cost.
 */
async function resizeAndConvert(file: File, maxDim = 1024): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      const base64 = dataUrl.split(',')[1]
      resolve({ base64, mimeType: 'image/jpeg' })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('画像の読み込みに失敗しました'))
    }

    img.src = url
  })
}

/**
 * Extract receipt data using OCR (Claude Vision API via Edge Function).
 * Falls back to demo mock data when Supabase is not connected.
 */
export async function extractReceiptData(file: File): Promise<OCRResult> {
  // Demo mode: return mock data after delay
  if (!supabase) {
    await new Promise((r) => setTimeout(r, 1500))
    return {
      amount: 1580,
      date: new Date().toISOString().split('T')[0],
      storeName: 'デモストア',
      description: '食料品',
    }
  }

  // Resize and convert to base64
  const { base64, mimeType } = await resizeAndConvert(file)

  // Call Edge Function
  const { data, error } = await supabase.functions.invoke('ocr-receipt', {
    body: { image_base64: base64, mime_type: mimeType },
  })

  if (error) {
    throw new Error(error.message || 'OCR処理に失敗しました')
  }

  if (!data?.success) {
    throw new Error(data?.error || 'レシートを読み取れませんでした')
  }

  const result = data.data
  return {
    amount: result.amount,
    date: result.date ?? undefined,
    storeName: result.store_name ?? undefined,
    description: result.description ?? undefined,
  }
}
