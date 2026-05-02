# PixelForge Phase 6.5 Release Notes

Status: Draft

## Summary

Phase 6.5 tracks Tier 2 feature parity behind `uiPrefs.tier2Flags`. Flags default on in local development and off in production/test builds until the release flip.

## Planned User-Facing Areas

- Filters and adjustments
- HSL/HSV color picker and saved palettes
- Advanced raster selections
- Gradient tool
- Expanded vector shapes and multi-select
- Workspace aids: grid, snap, rulers, guides, 1:1 preview
- Pressure brush dynamics

## Release Gate

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run budget`
- Bundle delta no more than +25 kB gzip from the Phase 6 baseline
