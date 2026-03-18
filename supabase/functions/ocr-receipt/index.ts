import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OCRRequest {
  image_base64: string
  mime_type: string
}

interface OCRResult {
  amount: number
  date?: string
  store_name?: string
  description?: string
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: '認証が必要です' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: '認証に失敗しました' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request
    const { image_base64, mime_type } = await req.json() as OCRRequest

    if (!image_base64 || !mime_type) {
      return new Response(JSON.stringify({ success: false, error: '画像データが必要です' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Call Claude Vision API
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      return new Response(JSON.stringify({ success: false, error: 'API設定エラー' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mime_type,
                  data: image_base64,
                },
              },
              {
                type: 'text',
                text: `この画像はレシートまたは領収書です。以下の情報をJSON形式で抽出してください。

必須:
- amount: 税込の合計金額（整数、日本円）。「合計」「お買上合計」「合計(税込)」「お支払い」付近の金額を優先。小計ではなく最終合計を返してください。

任意（読み取れる場合のみ）:
- date: 日付（YYYY-MM-DD形式）
- store_name: 店舗名
- description: 購入内容の要約（20文字以内）

JSONのみを返してください。他のテキストは不要です。
例: {"amount": 1580, "date": "2025-03-14", "store_name": "セブンイレブン", "description": "食料品"}

読み取れない場合は {"amount": 0} を返してください。`,
              },
            ],
          },
        ],
      }),
    })

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text()
      console.error('Claude API error:', errorText)
      return new Response(JSON.stringify({ success: false, error: '画像の読み取りに失敗しました' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const claudeData = await claudeResponse.json()
    const textContent = claudeData.content?.find((c: { type: string }) => c.type === 'text')?.text ?? ''

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = textContent.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return new Response(JSON.stringify({ success: false, error: 'レシートの内容を読み取れませんでした' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result: OCRResult = JSON.parse(jsonMatch[0])

    if (!result.amount || result.amount <= 0) {
      return new Response(JSON.stringify({ success: false, error: '金額を読み取れませんでした。手入力してください。' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('OCR function error:', error)
    return new Response(JSON.stringify({ success: false, error: '処理中にエラーが発生しました' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
