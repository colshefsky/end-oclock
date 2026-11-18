import { readTile, verdict, applyTiles, hideShortsChips } from '../../src/youtube/tiles';

const MIN = 60_000;

const lockupTile = (id: string, badge: string | null, extra = '') => `
  <ytd-rich-item-renderer>
    <yt-lockup-view-model>
      <a href="/watch?v=${id}">thumb</a>
      ${badge == null ? '' : `<yt-thumbnail-badge-view-model><badge-shape><div class="ytBadgeShapeText">${badge}</div></badge-shape></yt-thumbnail-badge-view-model>`}
      ${extra}
    </yt-lockup-view-model>
  </ytd-rich-item-renderer>`;

const legacyTile = (id: string, badge: string) => `
  <ytd-video-renderer>
    <a id="thumbnail" href="/watch?v=${id}"></a>
    <ytd-thumbnail-overlay-time-status-renderer><span id="text"> ${badge} </span></ytd-thumbnail-overlay-time-status-renderer>
  </ytd-video-renderer>`;

const mount = (html: string) => {
  document.body.innerHTML = html;
  return document.body;
};

const states = () => [...document.querySelectorAll('[data-eoc-tile]')].map((e) => e.getAttribute('data-eoc-tile'));

test('a 3:15 tile shows with 10 minutes left and hides with 2', () => {
  const root = mount(lockupTile('a', '3:15'));
  applyTiles(root, 10 * MIN, new Map());
  expect(states()).toEqual(['show']);
  applyTiles(root, 2 * MIN, new Map());
  expect(states()).toEqual(['hide']);
});

test('legacy renderer badges work', () => {
  const root = mount(legacyTile('b', '1:02:03'));
  expect(readTile(root.firstElementChild!, new Map())).toEqual({ videoId: 'b', kind: 'video', seconds: 3723 });
});

test('falls back to the data map by video id', () => {
  const root = mount(lockupTile('c', null));
  applyTiles(root, 5 * MIN, new Map([['c', 615]]));
  expect(states()).toEqual(['hide']);
  applyTiles(root, 15 * MIN, new Map([['c', 615]]));
  expect(states()).toEqual(['show']);
});

test('unknown length stays hidden', () => {
  const root = mount(lockupTile('d', null));
  applyTiles(root, 60 * MIN, new Map());
  expect(states()).toEqual(['hide']);
});

test('live tiles show', () => {
  const root = mount(lockupTile('e', 'LIVE', '<badge-shape class="yt-badge-shape--live-now"></badge-shape>'));
  expect(readTile(root.firstElementChild!, new Map()).kind).toBe('live');
  applyTiles(root, 5 * MIN, new Map());
  expect(states()).toEqual(['show']);
});

test('mixes and playlists show', () => {
  const root = mount(`
    ${lockupTile('f', 'Mix').replace('/watch?v=f', '/watch?v=f&list=RDf&start_radio=1')}
    <ytd-playlist-renderer><a href="/playlist?list=PL1">pl</a><span>12 videos</span></ytd-playlist-renderer>`);
  applyTiles(root, 5 * MIN, new Map());
  expect(states()).toEqual(['show', 'show']);
});

test('shorts tiles hide', () => {
  const root = mount('<ytd-rich-item-renderer><a href="/shorts/xyz">s</a></ytd-rich-item-renderer>');
  expect(readTile(root.firstElementChild!, new Map()).kind).toBe('short');
  applyTiles(root, 60 * MIN, new Map());
  expect(states()).toEqual(['hide']);
});

test('only the outermost tile is marked', () => {
  const root = mount(lockupTile('g', '1:00'));
  applyTiles(root, 10 * MIN, new Map());
  expect(root.querySelector('yt-lockup-view-model')!.hasAttribute('data-eoc-tile')).toBe(false);
});

test('re-judges a tile whose link changed', () => {
  const root = mount(lockupTile('h', '2:00'));
  applyTiles(root, 10 * MIN, new Map());
  expect(states()).toEqual(['show']);
  root.querySelector('a')!.setAttribute('href', '/watch?v=other');
  root.querySelector('.ytBadgeShapeText')!.textContent = '40:00';
  applyTiles(root, 10 * MIN, new Map());
  expect(states()).toEqual(['hide']);
});

test('verdict rules', () => {
  expect(verdict({ videoId: 'x', kind: 'video', seconds: 600 }, 10 * MIN)).toBe('show');
  expect(verdict({ videoId: 'x', kind: 'video', seconds: 601 }, 10 * MIN)).toBe('hide');
  expect(verdict({ videoId: null, kind: 'collection', seconds: null }, 0)).toBe('show');
});

test('hides the Shorts filter chip by its text', () => {
  const root = mount(`
    <yt-chip-cloud-chip-renderer><div>All</div></yt-chip-cloud-chip-renderer>
    <yt-chip-cloud-chip-renderer><div> Shorts </div></yt-chip-cloud-chip-renderer>
    <chip-view-model><button><div>Shorts</div></button></chip-view-model>`);
  hideShortsChips(root);
  expect([...root.children].map((c) => (c as HTMLElement).hidden)).toEqual([false, true, true]);
});
