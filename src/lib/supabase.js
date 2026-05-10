import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SUPABASE_URL = 'https://sipgqpgbztskzfhbirse.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_PMKNCJwkvTS2jXTDKbuTVg_VICSXD2g'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
