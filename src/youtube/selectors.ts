/**
 * Every YouTube selector and JSON key we depend on lives here, old and new names side by side.
 * When YouTube changes its markup, this is the file to fix.
 */

/** JSON keys in ytInitialData / youtubei responses. */
export const YT_PATHS = {
  lockup: 'lockupViewModel',
  lockupId: 'contentId',
  badgeViewModel: 'thumbnailBadgeViewModel',
  legacyVideoRenderers: [
    'videoRenderer', 'compactVideoRenderer', 'gridVideoRenderer', 'playlistVideoRenderer',
    'playlistPanelVideoRenderer', 'reelItemRenderer',
  ],
  legacyTimeOverlay: 'thumbnailOverlayTimeStatusRenderer',
  videoDetails: 'videoDetails',
} as const;

/** DOM selectors. */
export const SEL = {
  /** Every element that represents one video/collection tile, newest names first. */
  tile: [
    'ytd-rich-item-renderer', 'yt-lockup-view-model', 'ytd-video-renderer', 'ytd-compact-video-renderer',
    'ytd-grid-video-renderer', 'ytd-playlist-video-renderer', 'ytd-playlist-panel-video-renderer',
    'ytd-radio-renderer', 'ytd-compact-radio-renderer', 'ytd-playlist-renderer', 'ytd-compact-playlist-renderer',
    'ytd-grid-playlist-renderer', 'ytd-reel-item-renderer', 'ytm-shorts-lockup-view-model',
    'ytm-shorts-lockup-view-model-v2',
  ].join(', '),
  badgeText: [
    'yt-thumbnail-badge-view-model .ytBadgeShapeText', '.yt-badge-shape__text', '.badge-shape-wiz__text',
    'ytd-thumbnail-overlay-time-status-renderer #text', 'ytd-thumbnail-overlay-time-status-renderer',
    'badge-shape',
  ].join(', '),
  liveBadge: [
    '.yt-badge-shape--live-now', '.badge-shape-wiz--thumbnail-live', '.badge-style-type-live-now',
    '.badge-style-type-live-now-alternate', 'ytd-thumbnail-overlay-time-status-renderer[overlay-style="LIVE"]',
  ].join(', '),
  collectionTile: [
    'ytd-radio-renderer', 'ytd-compact-radio-renderer', 'ytd-playlist-renderer', 'ytd-compact-playlist-renderer',
    'ytd-grid-playlist-renderer',
  ].join(', '),
  collectionInside: 'yt-collection-thumbnail-view-model, yt-collections-stack',
  shortInside: 'a[href^="/shorts/"], ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2',
  watchLink: 'a[href*="watch?v="]',
} as const;
