import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder'));

const createSupabaseClient = () => {
  if (isSupabaseConfigured) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  
  // Return a safe Proxy that mimics SupabaseClient to silence library startup console warnings
  return new Proxy({} as any, {
    get: (_, prop) => {
      if (prop === 'auth') {
        return {
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          getSession: async () => ({ data: { session: null } }),
          getUser: async () => ({ data: { user: null } }),
          updateUser: async () => ({ data: { user: null }, error: null }),
          refreshSession: async () => ({ data: { session: null } })
        };
      }
      // Mimic chainable query builder
      const dummyChain = () => ({
        select: () => Promise.resolve({ data: [], error: null }),
        insert: () => Promise.resolve({ data: null, error: null }),
        update: () => Promise.resolve({ data: null, error: null }),
        delete: () => Promise.resolve({ data: null, error: null }),
      });
      return dummyChain;
    }
  });
};

export const supabase = createSupabaseClient();
