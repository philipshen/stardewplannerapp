# Readability revision

Six iPhone and six matching iPad screenshots uploaded and verified in App Store Connect on October 13, 2026. Build 12 was withdrawn and replaced with processed build 15. App Review submission verified Waiting for Review at 12:41 PM.

Both platforms use the same headlines, subtitles, selling points, and order:

1. Design your dream farm
2. Made for your fingertips
3. Make the inside yours, too
4. Bring your farm with you
5. Get inspired. Make it yours.
6. Every tile covered — Sprinkler, Junimo Hut & scarecrow ranges.

Bold system sans-serif typography, fixed spacing, cream background, forest-green headlines, and native captures. iPad uses its landscape interface and ON iPAD branding. Coverage cards show actual Highlights controls; no simulated overlays. Header and search art use matching typography and remain attached.

The active iPad files are ipad-01-dream-farm.png, ipad-02-touch.png, ipad-03-interiors.png, ipad-04-import.png, ipad-05-inspiration.png, and ipad-06-coverage.png. Older three-card iPad files are historical, not the uploaded set.

Run `swift -module-cache-path /tmp/stardew-swift-cache scripts/render-store-creative.swift`, then `node scripts/finalize-store-creative.cjs`. Open index.html to compare the set. All outputs are RGB PNG without alpha. iPhone: 1206 x 2622; iPad: 2732 x 2048. Lint and typecheck passed.

Submission: https://appstoreconnect.apple.com/apps/6822014482/distribution/reviewsubmissions/details/d06732d9-5710-4be8-89a9-8c58f0d27d4b
