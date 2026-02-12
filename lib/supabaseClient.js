import { createClient } from '@supabase/supabase-js'

// 1. .env.local에 저장한 환경 변수를 불러옵니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

// 2. 외부에서 사용할 수 있도록 'supabase'라는 이름으로 내보냅니다.
export const supabase = createClient(supabaseUrl, supabasePublishableKey)