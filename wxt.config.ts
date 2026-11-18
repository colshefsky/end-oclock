import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    permissions: ['storage', 'alarms'],
    // Same site the content scripts run on; lets the background find open YouTube tabs to reload.
    host_permissions: ['https://www.youtube.com/*'],
    web_accessible_resources: [
      { resources: ['fonts/*', 'mascot/*'], matches: ['https://www.youtube.com/*'] },
    ],
  },
});
