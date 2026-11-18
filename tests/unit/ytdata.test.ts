import { collectLengths, readWatchDetails } from '../../src/core/ytdata';

// Shapes mirror current /youtubei/v1 responses, trimmed to the fields we read.
const lockup = (id: string, badge: string) => ({
  lockupViewModel: {
    contentId: id,
    contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
    contentImage: {
      thumbnailViewModel: {
        overlays: [
          { thumbnailOverlayBadgeViewModel: { thumbnailBadges: [{ thumbnailBadgeViewModel: { text: badge } }] } },
        ],
      },
    },
  },
});

const browse = {
  contents: {
    twoColumnBrowseResultsRenderer: {
      tabs: [{ tabRenderer: { content: { richGridRenderer: { contents: [
        { richItemRenderer: { content: lockup('abc', '10:15') } },
        { richItemRenderer: { content: lockup('mix1', 'Mix') } },
      ] } } } }],
    },
  },
};

const search = {
  contents: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: [
    { videoRenderer: { videoId: 'def', lengthText: { simpleText: '1:02:03' } } },
    { videoRenderer: { videoId: 'ghi', thumbnailOverlays: [{ thumbnailOverlayTimeStatusRenderer: { text: { simpleText: '4:00' } } }] } },
    { playlistVideoRenderer: { videoId: 'jkl', lengthSeconds: '95' } },
    { videoRenderer: { videoId: 'live1', badges: [{ metadataBadgeRenderer: { label: 'LIVE' } }] } },
  ] } }] } },
};

test('reads lockup badge lengths', () => {
  const m = new Map<string, number>();
  collectLengths(browse, m);
  expect(m.get('abc')).toBe(615);
  expect(m.has('mix1')).toBe(false);
});

test('reads legacy renderers', () => {
  const m = new Map<string, number>();
  collectLengths(search, m);
  expect(m.get('def')).toBe(3723);
  expect(m.get('ghi')).toBe(240);
  expect(m.get('jkl')).toBe(95);
  expect(m.has('live1')).toBe(false);
});

test('survives nulls, primitives and deep nesting', () => {
  const m = new Map<string, number>();
  let deep: unknown = lockup('deep', '2:00');
  for (let i = 0; i < 50; i++) deep = { a: [null, 3, 'x', deep] };
  collectLengths(deep, m);
  collectLengths(null, m);
  collectLengths('text', m);
  expect(m.get('deep')).toBe(120);
});

test('reads watch details from a player response', () => {
  expect(readWatchDetails({ videoDetails: { videoId: 'xyz', lengthSeconds: '2880', isLiveContent: false } }))
    .toEqual({ videoId: 'xyz', lengthSeconds: 2880, isLive: false });
});

test('reads watch details nested in a navigation response', () => {
  expect(readWatchDetails({ playerResponse: { videoDetails: { videoId: 'n1', lengthSeconds: '60' } } }))
    .toEqual({ videoId: 'n1', lengthSeconds: 60, isLive: false });
});

test('live streams have no length', () => {
  expect(readWatchDetails({ videoDetails: { videoId: 'L', lengthSeconds: '0', isLive: true, isLiveContent: true } }))
    .toEqual({ videoId: 'L', lengthSeconds: null, isLive: true });
});

test('no video details is null', () => {
  expect(readWatchDetails({ foo: 1 })).toBeNull();
});
