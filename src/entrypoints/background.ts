import { handleEndAlarm, scheduleEnd, END_ALARM, onInstalledReason } from '../background/logic';
import { sessionItem } from '../shared/storage';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(({ reason }) => void onInstalledReason(reason));

  browser.runtime.onMessage.addListener((msg: unknown, sender) => {
    if ((msg as { type?: string } | null)?.type === 'closeTab' && sender.tab?.id != null) {
      void browser.tabs.remove(sender.tab.id);
    }
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === END_ALARM) void handleEndAlarm(Date.now());
  });

  sessionItem.watch((s) => void scheduleEnd(s, Date.now()));
  void sessionItem.getValue().then((s) => scheduleEnd(s, Date.now()));
});
