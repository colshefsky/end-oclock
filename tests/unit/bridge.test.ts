import { onBridge, wrapFetch, isDataUrl } from '../../src/youtube/bridge';

const send = (data: unknown, source: unknown = window) =>
  window.dispatchEvent(new MessageEvent('message', { data, source: source as Window }));

test('onBridge delivers valid messages only', () => {
  const got: unknown[] = [];
  const off = onBridge((m) => got.push(m));
  send({ src: 'eoc', kind: 'lengths', entries: [['a', 60]] });
  send({ src: 'other', kind: 'lengths', entries: [] });
  send({ src: 'eoc', kind: 'bogus' });
  send({ src: 'eoc', kind: 'lengths', entries: [['b', 1]] }, null);
  send('hello');
  off();
  send({ src: 'eoc', kind: 'lengths', entries: [['c', 2]] });
  expect(got).toEqual([{ src: 'eoc', kind: 'lengths', entries: [['a', 60]] }]);
});

test('isDataUrl matches the youtubei endpoints we read', () => {
  expect(isDataUrl('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false')).toBe(true);
  expect(isDataUrl('/youtubei/v1/player?key=x')).toBe(true);
  expect(isDataUrl('https://www.youtube.com/youtubei/v1/log_event')).toBe(false);
});

test('wrapFetch returns the original response untouched and reports matching JSON', async () => {
  const body = { videoDetails: { videoId: 'z', lengthSeconds: '10' } };
  const orig = vi.fn(async () => {
    const r = new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
    Object.defineProperty(r, 'url', { value: 'https://www.youtube.com/youtubei/v1/player' });
    return r;
  });
  const seen: Array<[unknown, string]> = [];
  const wrapped = wrapFetch(orig as unknown as typeof fetch, (json, url) => seen.push([json, url]));
  const res = await wrapped('https://www.youtube.com/youtubei/v1/player');
  expect(await res.json()).toEqual(body);
  await new Promise((r) => setTimeout(r, 0));
  expect(seen).toEqual([[body, 'https://www.youtube.com/youtubei/v1/player']]);
});

test('wrapFetch ignores other URLs and never throws from the observer', async () => {
  const orig = vi.fn(async () => new Response('not json'));
  const onJson = vi.fn(() => { throw new Error('observer bug'); });
  const wrapped = wrapFetch(orig as unknown as typeof fetch, onJson);
  const res = await wrapped('https://www.youtube.com/youtubei/v1/next');
  expect(await res.text()).toBe('not json');
  await new Promise((r) => setTimeout(r, 0));
  expect(onJson).not.toHaveBeenCalled();
});
