import { readFileSync, writeFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version?: string;
};
const appVersion = String(pkg.version ?? '1.0.0');
const buildId = new Date().toISOString().slice(0, 16).replace('T', '-');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'write-app-release-json',
      transformIndexHtml(html) {
        if (html.includes('name="ek-pos-build"')) {
          return html.replace(
            /name="ek-pos-build" content="[^"]*"/,
            `name="ek-pos-build" content="${buildId}"`,
          );
        }
        return html.replace(
          '<meta charset="UTF-8" />',
          `<meta name="ek-pos-build" content="${buildId}" />\n    <meta charset="UTF-8" />`,
        );
      },
      closeBundle() {
        writeFileSync(
          'dist/app-release.json',
          JSON.stringify({ version: appVersion, buildId }, null, 0),
        );
      },
    },
  ],
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    host: '0.0.0.0',
    port: 5180,
  },
});
