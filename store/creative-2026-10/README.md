# October 2026 App Store creative

Real build 12 simulator captures with marketing typography. Four iPhone (1206×2622) and two iPad (2732×2048) screenshots; header 3840×1646 and search 3840×2560. Final files are RGB PNG without alpha. Duo assets are managed in another session.

Marigold Gardens adapts the lush paths, trees and garden composition of [u/mondaymarigolds' 15 year perfection farm](https://www.reddit.com/r/FarmsofStardewValley/comments/1n3bii8/), observed among the subreddit top posts (about 5.9K votes). It is a newly built valid planner layout, not the Reddit image. The Garden Cafe is an original interior arrangement. Game artwork belongs to ConcernedApe.

Sources: `plans/` contains importable planner fixtures; `captures/` contains native screenshots; `renders/` contains app-rendered farm/interior artwork.

Regeneration:

```sh
node --import tsx scripts/build-marketing-plan.ts
node --import tsx scripts/preview-scene.ts --plan store/creative-2026-10/plans/marigold.stardewplan.json --out store/creative-2026-10/renders/marigold.png
node --import tsx scripts/preview-scene.ts --plan store/creative-2026-10/plans/cafe.stardewplan.json --out store/creative-2026-10/renders/cafe.png --scale 3
swift -module-cache-path /tmp/stardew-swift-cache scripts/render-store-creative.swift
```

After Swift rendering, strip the alpha channel before uploading (PNGJS RGB colorType 2 with inputColorType 6). Native captures are retained; recapture through the app if the UI changes.

Verified in App Store Connect: all six screenshots replaced their respective old iPhone/iPad placements. Header and search assets attached. Apple's iPhone product-page and search previews visually checked. Old images remain in the Asset Library. Lint and typecheck passed.

Resubmitted version 1.0.0 build 12 on October 13, 2026 at 10:37 AM. Verified **Waiting for Review**. [Submission](https://appstoreconnect.apple.com/apps/6822014482/distribution/reviewsubmissions/details/2d079346-e5b8-4955-952b-20f8b9feba20). Automatic release after approval remains selected.
