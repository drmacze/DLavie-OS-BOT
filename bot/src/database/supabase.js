const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

let supabaseClient = null;
let serviceClient = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    const url = config.supabase.url;
    const key = config.supabase.anonKey;
    if (!url || !key) {
      console.warn('[DLAVIE][DB] Supabase URL atau Anon Key belum di-set. Database belum aktif.');
      return null;
    }
    supabaseClient = createClient(url, key, {
      auth: { autoRefreshToken: true, persistSession: true }
    });
  }
  return supabaseClient;
}

function getServiceClient() {
  if (!serviceClient) {
    const url = config.supabase.url;
    const key = config.supabase.serviceRoleKey;
    if (!url || !key) {
      console.warn('[DLAVIE][DB] Supabase Service Role Key belum di-set. Service client tidak aktif.');
      return null;
    }
    serviceClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
  return serviceClient;
}

function isConnected() {
  return Boolean(config.supabase.url && config.supabase.anonKey);
}

module.exports = { getSupabaseClient, getServiceClient, isConnected };
