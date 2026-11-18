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
