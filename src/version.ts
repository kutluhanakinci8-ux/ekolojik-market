declare const __APP_BUILD_ID__: string;

export const APP_BUILD_ID: string =
  typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev';

/** Ayarlar ekranında deploy doğrulaması için */
export const APP_FEATURE_TAG = 'idle-notes-broadcast';
