/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ACTIVITY_API_BASE?: string;
  readonly VITE_ACTIVITY_DEFAULT_USER_ID?: string;
  readonly VITE_ACTIVITY_BASIC_AUTH_USER?: string;
  readonly VITE_ACTIVITY_BASIC_AUTH_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
