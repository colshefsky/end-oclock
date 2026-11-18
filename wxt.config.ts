import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    permissions: ['storage', 'alarms'],
    web_accessible_resources: [
      { resources: ['fonts/*', 'mascot/*'], matches: ['https://www.youtube.com/*'] },
    ],
  },
});
