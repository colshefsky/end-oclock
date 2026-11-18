# Contributing

Thanks for helping! End O'Clock is small on purpose. Its job is a planned, pressure-free ending to YouTube sessions.

## Ground rules

- **Mockups first for anything visual.** New or changed screens, overlays, icons or mascot poses get mocked up and agreed on in an issue before code.
- **No countdowns, no rushing.** The UI shows when you're done, never a ticking timer. A video someone started always gets to finish (live streams excepted).
- **No data collection, ever.** No analytics, no remote calls.
- **Original art only.** The clock mascot is our own; don't copy existing characters.
- **Clean-room code.** Many YouTube extensions are GPL. This project is MIT, so don't copy code from them.

## Development

```bash
npm install
npm run dev
npm test && npm run lint && npm run typecheck
npm run build && npm run test:e2e
```

When YouTube changes its markup, fixes usually belong in `src/youtube/selectors.ts`, with a test in `tests/unit/tiles.test.ts` or `tests/unit/ytdata.test.ts`.

Please include tests with changes and run the [live smoke test](docs/smoke-test.md) for anything that touches YouTube.
