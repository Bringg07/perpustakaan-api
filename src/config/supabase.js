const { createClient } = require('@supabase/supabase-js');

/**
 * Klien Supabase dibuat secara lazy (singleton) agar:
 *  1. Environment variable sudah dibaca saat pertama kali dipakai.
 *  2. Koneksi tidak dibuat ulang di setiap request serverless.
 */
let client = null;

/**
 * Mengambil (dan membuat bila belum ada) instance klien Supabase.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getSupabase() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  // Utamakan service role key (bypass RLS) bila tersedia, jika tidak pakai anon key.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Konfigurasi Supabase belum lengkap. Pastikan SUPABASE_URL dan ' +
        'SUPABASE_ANON_KEY (atau SUPABASE_SERVICE_ROLE_KEY) sudah diisi pada file .env ' +
        'atau Environment Variables Vercel.'
    );
  }

  client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return client;
}

/**
 * Menyuntikkan klien palsu saat pengujian (unit test).
 * Hanya dipakai oleh test suite.
 * @param {unknown} fakeClient
 */
function __setSupabaseForTest(fakeClient) {
  client = fakeClient;
}

module.exports = { getSupabase, __setSupabaseForTest };
