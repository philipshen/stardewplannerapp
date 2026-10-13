# Stardew Planner

An iOS, Android and web farm planner for Stardew Valley, built with React Native (Expo SDK 57). Everything runs on the device; there is no backend.

## Features

The app is the mobile version of the web planner at <https://v3.stardew.info/planner/>. It uses the web planner as a reference, with controls arranged for touch.

| Web planner | In this app |
| --- | --- |
| Crops, Craftables, Buildings, Misc menus + furniture | Item sheet with the same five menus, season filter for crops, global search, recent items and a hotbar |
| Select, multi select, eraser, undo, redo | Pan, Place, Erase and Select tools; box-select and group move; brush, area and outline shapes |
| Layouts | Official farm layouts and interiors; choose the layout when creating a farm. Community layouts are no longer offered |
| Upload custom layout | Use your own image with explicit tile dimensions |
| Season | Seasonal terrain, trees and grass |
| Sprinkler, scarecrow, Bee House and Junimo Hut highlights | Same toggles, plus pressure-nozzle sprinkler ranges and fruit tree spacing warnings |
| Hide grid, show buildable area, show tillable area, allow placing anywhere, reset view | Same options, saved on the device |
| Display object counts | Object counts with estimated cost, materials and crop care statistics |
| Save (unique URL), plan history | Named saves stored on the device with thumbnails, duplicate, rename; share a plan as a `.stardewplan.json` file |
| Save as image | PNG export through the share sheet |
| Upload save game | Import the farm from a game save file (buildings, crops, trees, flooring, fences, machines, large debris) |
| Language | 12 UI languages |
| Pinch zoom & drag | Always on; two fingers pan and zoom in any tool |

Not included, by decision: Multiplanner rooms, Patreon login, ads, and web links to saved plans. The app does not use the web planner's server. It needs no backend: plans are files on the device, and a plan file can be moved through the share sheet (for example to iCloud Drive).

Items are selected through the editor’s searchable item picker. Item Index is no longer exposed in navigation.

## Music and sound

- **Radio.** The 69 available downloaded Stardew Valley OST tracks are divided among Farming, Foraging, Fighting, Fishing and Mining Radio. "Shuffle all" plays every track in random order. "Farm season" plays the soundtrack songs for the open farm's season. Pause/resume and Next track controls are available, with elapsed time from the audio player.
- **My music.** A player adds audio files from the device.
- **Add a station.** Make a folder `assets/music/stations/<Station Name>/`, put audio files in it, and run `npm run gen:radio`. Use only music that you may ship.
- **Sound effects.** `scripts/gen-music.ts` generates sound effects and legacy synthesized tracks. The activity stations now use the OST.

## Sample farms

`npm run gen:samples` rebuilds the two Reddit-inspired sample farms and their thumbnails using the planner's placement rules. Each sample credits and links its source post. Samples open in a transient, read-only preview; only Customize saves a named editable copy.

`npm run optimize:assets` losslessly recompresses generated PNGs and verifies decoded RGBA pixels before replacing a file. Keep the PNG writer's default deflate strategy so regenerating artwork retains the size improvement. Music remains bundled for offline playback.

## Run it

```bash
npm install
npx expo start          # then press i (iOS), a (Android) or w (web)
```

The app has been exercised in the matching SDK 57 Expo Go on the iOS Simulator. Use native preview builds to run without a development server:

```bash
npx eas-cli@latest build --platform ios --profile preview         # registered iPhone
npx eas-cli@latest build --platform android --profile preview     # installable APK
npx eas-cli@latest build --platform ios --profile preview-simulator
```

EAS requires an Expo login and a linked project. Physical iPhone builds additionally require Apple signing and device registration. `preview-simulator` builds run in the iOS Simulator. The browser target is a development aid; native gesture, audio, safe-area and file-sharing checks must be performed on the mobile build.

## Project layout

```
src/app/            Expo Router screens (home & saves, planner, about, privacy)
src/planner/        Skia canvas, gestures/tools, model (placement rules, coverage, stats), panels
src/lib/            file sharing/import helpers and the game save reader
src/i18n/           UI text: en.ts is the source, lang/ holds the translations
src/store/          zustand stores: saves (AsyncStorage) and editor session (undo/redo)
src/data/           item index + search, maps; generated/ holds build outputs
scripts/            data + art generators
  build-data.ts     merges the item dataset with the curated furniture/decor list
  gen-art.ts        lossless game sprite atlases and source terrain
  art/              pixel raster lib, palettes, item painters, map layouts, UI glyphs
```

To regenerate data and art after editing the scripts, run `npm run gen`.

## Data & art

- The web planner was the feature reference. `scripts/data/layouts.json` holds tile rule layers. The local game atlas and map images provide game artwork; atlas coordinates are indexed in `scripts/data/game-sprites.json`.
- Game facts (ranges, building sizes, crop data, rug sizes) were checked against the [Stardew Valley Wiki](https://stardewvalleywiki.com). `npm test` contains these checks.
- Item facts (names, prices, seasons, recipes) come from the MIT-licensed [`stardew-valley-data`](https://www.npmjs.com/package/stardew-valley-data) package, plus a hand-curated furniture and decor list in `scripts/supplemental.ts`. Item descriptions are generated from those facts.
- Game sprites are extracted by `scripts/art/game.ts`; some unmatched items still use procedural fallback artwork. Run `npm run gen:art` to rebuild lossless sprite atlases and terrain from `assets/game/maps-src`; it does not repaint official farm terrain. Inventory icons come from the pinned game-data package through `scripts/art/game-icons.ts`. The explicit `--procedural-art` flag is for developing replacement terrain and UI artwork only. Game artwork and soundtrack belong to ConcernedApe.

Stardew Valley is a trademark of ConcernedApe LLC. This is an unofficial fan project and is not affiliated with or endorsed by ConcernedApe.

## iOS releases

`.github/workflows/ios-release.yml` checks lint, types and model tests, then runs Fastlane on a GitHub macOS runner to compile locally and submit the exact resulting IPA to the internal TestFlight group `Phil`. It runs on pushes/merges to `main` and manual dispatches on `main`. Public App Store review remains a separate step.

Before enabling it, add an Expo access token as the GitHub Actions repository secret `EXPO_TOKEN`, with access to the `shenberg/stardew-planner` EAS project. Signing and App Store Connect credentials remain managed by EAS. Fastlane invokes `eas build --local`, so compilation does not use EAS cloud build quota; `eas submit --path` uploads that exact artifact. GitHub macOS runner usage has its own billing. Never commit Apple credentials or tokens. The release branch is `main`; merges to it automatically build and upload to App Store Connect. Screenshots and public App Review are managed separately from binary submission.

All release runs share one concurrency group. An active run is never automatically canceled; only the newest pending commit is retained. The runner waits for both the build and submission before releasing its lock. It also refuses to start if EAS reports another active iOS build/submission, including work left behind by a manually canceled or timed-out runner. Check EAS and retry once that operation finishes. Start releases through this workflow to avoid races with independent manual builds.

Build numbers use EAS remote versioning and automatic increments (initialized at iOS build 2). The CLI is pinned to 24.12.1. A successful submission still needs Apple's processing before it appears in TestFlight. To release locally with the same preflight checks, install Ruby 3.3+, Xcode and CocoaPods, run `bundle install`, authenticate with Expo (or set `EXPO_TOKEN` securely), then run `bash scripts/release-ios.sh`. A file lock prevents simultaneous local releases. GitHub uses Xcode 26.6; local EAS builds use the selected local Xcode and ignore the cloud image setting. Do not start a local release during a GitHub release; GitHub concurrency does not span local machines.

## Public support pages

The App Store listing uses https://stardew-planner-support.vercel.app/ and its `/privacy.html` policy. Sources are `store/support.html` and `store/privacy.html`. Only those two HTML files are deployed to the `stardew-planner-support` Vercel project in `philipshens-projects`; the mobile app and release metadata are not hosted there.

To update them, copy support.html as index.html and privacy.html into `.scratch/support-site`, link that directory explicitly to the project, verify it with `vercel project inspect --non-interactive --cwd .scratch/support-site`, then deploy with `vercel deploy --prod --non-interactive --cwd .scratch/support-site`. Keep its `.vercelignore` restricted to `*`, `!index.html`, and `!privacy.html` so only the public pages ship. The staging directory is ignored by Git.


### Visual fidelity

- All eight official farm layouts use the reference planner terrain in all four seasons. Terrain is copied at its native tile scale, without palette reduction. Interior crops use the same origin as the placement grid.
- Grass follows the reference planner's four overlapping tufts, three variants, and 0–9 pixel offsets. Offsets are seeded by tile so redraws and exports stay consistent.
- `scripts/test-art.ts` checks source pixels against shipped terrain and sprite atlases. Do not quantize the combined atlas: its palette exceeds 256 colors.
- Smiling Robin comes from [Robin Happy](https://stardewvalleywiki.com/File:Robin_Happy.png). The build enlarges her portrait on a flat background; the app, splash and tutorial reuse it.
- Community layouts are removed from creation choices. Legacy layout metadata remains readable for existing saves. The Cabin uses the original starter farmhouse artwork and tile rules, with two non-buildable padding columns to preserve its legacy canvas width. Slime Hutch terrain is compiled from its pinned TMX and original tilesheets; its 122 usable floor tiles exclude the fixed troughs and pipes. The initial incubator is a removable object. Source URLs and hashes are in `assets/game/slime-hutch/sources.json`. The Trellis Marker is a planner helper with custom artwork. Two old placeholder furniture sprites remain readable only for legacy saves and are excluded from the item picker; do not count them as missing game items.
- Local preview images use a new cache namespace so older saves do not keep showing the superseded terrain.

### Resizable iPhone layouts

EAS iOS profiles use `macos-tahoe-26.6-xcode-27.1` for iPhone Duo dynamic resizing. The editor sizes controls from current window bounds and safe-area insets, uses a compact left HUD for wide windows, preserves the centered farm tile on resize, and cancels in-progress placement when the viewport changes. Sheets and item columns reflow with available width.

Simulator build `8586ea73-6951-4a7c-9dc7-31c74eb02c05` compiled successfully on October 13, 2026. Its Info.plist confirms `iphonesimulator27.1`, all four orientations, and `UIRequiresFullScreen=false`. Responsive web previews were checked at 390x844 and 844x390. Actual Duo fold/unfold behavior still requires an iPhone Duo or the Xcode 27.1 Duo simulator; these checks do not substitute for that native test.

### Bundle size maintenance

`npm run optimize:maps` creates lossless WebP runtime maps from the PNG masters and updates the static asset manifest. It requires `cwebp` and `dwebp` (libwebp). Every image is decoded again and checked for identical dimensions and RGBA pixels before its reference changes; thumbnails and sprite atlases stay PNG. `npm run gen:art` includes this step. Commit both the generated manifest and WebP files; EAS does not regenerate art.

`npm run optimize:music` keeps all soundtrack tracks in stereo at 96 kbps AAC, checks duration and decodability, and skips files already at the target bitrate. It requires ffmpeg/ffprobe. Originals are kept locally in ignored `.scratch/music-sources`, outside the EAS upload. Radio now supports bundled stations only; older personal-music preferences fall back to season radio.
