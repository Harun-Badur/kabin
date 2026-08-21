/// <reference types="node" />

declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_VTON_PROXY_URL?: string;
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_AFFILIATE_TAGS_JSON?: string;
    AFFILIATE_TAGS_JSON?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
  }
}
