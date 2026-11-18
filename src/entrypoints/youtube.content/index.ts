import '../../youtube/page.css';
import { createOrchestrator } from '../../youtube/orchestrator';

export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  runAt: 'document_start',
  cssInjectionMode: 'manifest',
  main() {
    const orchestrator = createOrchestrator({
      now: () => Date.now(),
      tabKey: crypto.randomUUID(),
      closeTab: () => { browser.runtime.sendMessage({ type: 'closeTab' }).catch(() => {}); },
      navigate: (url) => location.replace(url),
    });
    void orchestrator.start();
  },
});
