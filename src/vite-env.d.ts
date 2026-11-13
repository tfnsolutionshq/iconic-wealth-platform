/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_PAYSTACK_PUBLIC_KEY: string;
  readonly VITE_DEMO_MODE: string;
  readonly VITE_WA_COMMUNITY_URL: string;
  readonly VITE_WA_SUPPORT_URL: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
