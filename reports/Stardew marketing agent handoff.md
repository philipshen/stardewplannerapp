# Stardew Planner launch and ongoing marketing

Owner: Phil. Operator: the AI agent receiving this handoff. Prepared October 13, 2026.

Grow Stardew Planner organically with minimal recurring work for Phil. The app is a free fan project with no revenue. Use useful farm designs, searchable resources, and player sharing to attract users. AI should produce and maintain the marketing operation; Phil should provide account access and any necessary standing permissions once, then receive a concise weekly report and exceptional decisions.

This is an execution specification. It does not mean assets, integrations, schedules, or public posts have already been created. It supersedes the earlier research report's emphasis on manually managed makeovers and creator outreach. Paid creators, paid ads, ongoing manual clinics, and daily owner review are outside the default plan.

## Outcomes and operating boundaries

The initial launch must be prepared before approval and executable once the app is publicly installable. Ongoing marketing should turn a small number of excellent original layouts into reusable content, then make it easy for actual players to share their own versions.

The growth hypothesis is: useful layout → app discovery → player customizes a plan → player shares their version → another player discovers the app. Measure each observable step. Content volume alone does not establish growth.

Use existing tools and hosting first. The default authorized incremental spend is **$0**. Do not start paid APIs, subscriptions, ads, creator payments, or compute jobs without an explicit budget. If existing access cannot support the work, present one concrete capped option and continue the free portions. Free-tier limits and included model usage still need monitoring. There is no obligation to fill a quota when quality or budget is insufficient.

This document authorizes no account access or external communication by itself. Honor explicit instructions in the agent's actual session. If publishing has already been authorized, do not request the same permission again. Otherwise, finish a reviewable launch pack and request one scoped standing authorization covering accounts, destinations, cadence, and routine replies. Capture the answer in the operating configuration. Keep outreach and access to Phil's personal Reddit account outside that scope unless explicitly included.

Once authorized, run routine work autonomously inside that scope. Use the project identity and accurately disclose the maker relationship. Never create supposed independent users, fictional testimonials, staged questions, coordinated votes, or undisclosed promotional comments. Genuine unpaid users can describe their own experience voluntarily.

## Current product and implementation context

Working repository: `/Users/philipshen/Developer/stardewplannerapp`.

The local listing currently names the app **Stardew Planner: Dream Farm** and records `waiting-for-review`. This is a local metadata value, not proof of current App Store status. Recheck the live release before launch.

The documented product includes touch farm editing, local saves, PNG export, editable `.stardewplan.json` file sharing, and supported game-save import. The listing describes a free app with no ads, subscriptions, paid features, or login. Validate claims against the release build before using them. A planner file is not a Stardew game save, and a generated design does not automatically rearrange the player's game.

Public template pages, hosted plan links, an autonomous layout generator, publishing integrations, and an optional branded share card are **proposed work**, not verified shipped features. Public availability on each platform must be established separately. A web development target is not a public web product.

Useful source entry points:

| File | How the agent should use it |
|---|---|
| `store/listing.en-US.json` | Product copy and local review metadata; verify against the actual release |
| `src/planner/model.ts` | Placement rules and model operations for constructing valid designs |
| `scripts/build-templates.ts` | Existing procedural construction examples; it writes bundled templates, so do not run it as a marketing generator without isolating output |
| `scripts/preview-scene.ts` | Existing renderer accepting a plan file and producing a PNG |
| `src/lib/files.ts` | Actual import/export format and native sharing behavior |
| `scripts/test-model.ts` | Existing model verification patterns |

Preserve unrelated work. Inspect the checkout and `AGENTS.md` before implementation. Follow the repository's version-specific Expo documentation rules for app changes. Run lint and typecheck for changes, plus meaningful model/import tests when relevant. Do not merge or release app changes simply to publish marketing content.

# Part 1 Initial launch

## Prepare the launch pack before approval

Build these artifacts in a dedicated marketing directory, separate from bundled app assets. Recommended structure: `marketing/config/`, `marketing/layouts/`, `marketing/launch/`, `marketing/queue/`, and `marketing/reports/`. These are proposed paths to create during execution, not existing infrastructure.

1. **Release fact sheet.** Record exact public name, verified platforms, store URLs, supported maps, pricing, offline behavior, import limitations, support URL, release version, and verification date. Store credentials in the supported secret mechanism, never in this sheet.
2. **Three original designs.** A cozy Forest Farm corner, a compact animal area on a verified map, and an orderly orchard/workshop layout. Choose attractive feasible designs rather than claiming maximum efficiency. Use new compositions; existing samples inspired by other players are not automatically original marketing material.
3. **Asset kit.** For each design, produce an editable file, full layout PNG, detail crop, and concise explanation of one useful design decision. Include one 15–25 second actual app demonstration. A rendered plan is suitable for a layout image; it does not substitute for a recording proving touch interactions.
4. **Destination page.** Prepare a simple public landing page with the correct store link, three images, a clear description, unofficial-fan-project notice, and existing support/privacy links. Put editable downloads here only after the complete download/import flow works. If the gallery is unfinished, launch with the existing verified destination and postpone template-download copy.
5. **Post queue.** Finalize the channel-specific copy below with real attachments and URLs. No unresolved placeholders may reach publishing. Each item needs its account, destination, eligibility, earliest posting time, and unique content ID.
6. **Short support answers.** Prepare verified answers for price, supported devices, saving, exporting, importing, and whether a design changes the game. Do not promise Android, cloud sync, multiplayer, or future dates unless confirmed.

If additional accounts are useful, bundle setup needs into one request. Start with the existing permitted community presence and at most one image-friendly project social account. Prioritize a project Pinterest account if available and usable through a supported integration; otherwise use an existing authorized visual channel. Do not create a dozen empty accounts.

## Publication destinations

The following rules were researched October 13, 2026. Recheck the actual rules, AI-content restrictions, and posting permissions immediately before launch; store the relevant URL and check date with each destination.

| Destination | Launch contribution | Operating condition |
|---|---|---|
| [r/FarmsofStardewValley](https://www.reddit.com/r/FarmsofStardewValley/) | One original layout showcase with maker disclosure and short demo | Layout-focused rules and competing launch precedent do not constitute permission. Resolve any ambiguous promotion or AI-assisted-content restriction before posting |
| [r/StardewValley](https://www.reddit.com/r/StardewValley/wiki/promo/) | One comment in the current Tuesday self-promotion thread | Research found one comment per person and a ban on promotion under other users' posts; use the explicit promotion route |
| [Official Guides and Resources](https://forums.stardewvalley.net/forums/guides-resources.14/) | One substantial resource thread with instructions, screenshots, and limitations | Follow [forum rules](https://forums.stardewvalley.net/pages/rules/) and [category guidance](https://forums.stardewvalley.net/threads/guides-resources-guidelines.11/); maintain the thread instead of duplicating it |
| Authorized project social account | Layout carousel or pin linking to the relevant destination | Verify account, publishing integration, and platform rules; no claim of guaranteed reach |
| Project website | Landing page, later a small layout gallery | Verify deployment destination and public links; preserve support and privacy pages |

Skip promotional posts in r/StardewHomeDesign under the previously checked rules. Discord has a [planner resource command](https://stardew.chat/commands.php), but resource-list inclusion is an optional later opportunity, not a required launch dependency. Do not assume a Discord channel permits promotion.

## Launch copy to finalize

Use the first-person versions only when posting through Phil's expressly authorized maker account. Project accounts should say “We made” or use the product name. If local rules require AI-assistance disclosure, include it plainly. Never claim an AI-created design is a customer's farm.

### Farm layout showcase

**Title:** A cozy Forest Farm orchard I planned on my phone

**Body:**

> I wanted an orchard that felt tucked into the forest while keeping a clear route through it. Here's the full plan and a close-up of the paths.
>
> I made the free, unofficial app used for this, Stardew Planner: Dream Farm. It lets you try arrangements on your phone and export an image to reference while playing. This is a planned design; you still make the changes yourself in Stardew.
>
> [Verified platform and link, only where permitted.] Which part would you change?

Match the title and design description to the actual asset. Attach the full image first and detail crop second. Use a different layout if Forest Farm is not validated.

### Main subreddit Tuesday comment

> I made Stardew Planner: Dream Farm, a free visual farm planner for [verified platform]. You can arrange a farm with touch controls, save designs on your device, and export a reference image. No ads, subscriptions, paid features, or login.
>
> Here's a quick demo and an example layout: [links]. If you play Stardew on a console, you can use the planner on your phone beside the game. It's an unofficial fan project: [store link].

### Official forum resource thread

**Title:** Free phone farm planner with touch editing and image exports

> Stardew Planner: Dream Farm is an unofficial visual layout planner for [verified platform]. I made it for planning arrangements on a phone or tablet before moving things around in the game.
>
> Choose a supported map, place and rearrange objects, save the design locally, and export a PNG. Here's a short walkthrough: [demo]. These are three example designs: [images].
>
> It's free, with no ads or paid features. Download: [store link].
>
> Editable files use the planner's own format. [Verified import instructions, if offered.] They do not automatically change your game save. Current limitations: [specific verified limits].
>
> I'll keep this thread updated with important fixes. For problems, include your device, app version, and the steps that caused the issue. Please do not post private files or account details.

### Project image post or pin

**Title:** Cozy Forest Farm orchard layout

> A tucked-away orchard with a clear walking route and a small seating corner. Designed in Stardew Planner: Dream Farm, a free unofficial phone planner. See the full layout and [download the editable plan / get the app]: [matching destination].

Use only the call to action that actually works. Include descriptive alt text where supported. Avoid pretending there is an editable web viewer when the destination only offers a file.

## Release trigger and sequence

App approval is necessary but not sufficient: a manually held or still-propagating release may not be installable. Verify the public store listing in the target market and a successful install/open of the intended version. An email, local metadata field, or successful TestFlight upload does not satisfy this gate.

Before setting the campaign to ready, verify all of the following:

- Public store link and supported-platform wording are correct.
- The release build supports every advertised action; exported files open successfully where promised.
- Assets pass design and visual checks; image links resolve publicly.
- Destination rules and account authorization are recorded.
- Final copy contains no placeholders or unverified superlatives.
- Publishing is deduplicated and the agent can inspect the resulting remote post.

| Window relative to public availability | Work |
|---|---|
| Day 0 | Verify release, activate landing page links, publish one authorized project post |
| Days 1–2 | Publish the eligible farm-design showcase and forum resource thread; separate them enough to monitor responses |
| Next Tuesday | Use that week's main subreddit promotion thread once; verify thread date rather than posting into an old one |
| Days 3–7 | Publish a second distinct design on the project channel; answer routine questions in the project's threads where permitted; correct broken links or inaccurate copy |
| Days 8–14 | Publish the third design and one useful how-to; update an existing resource thread only for a substantive change; assess the first results |

Post once per destination for the launch unless its rules and a substantive new contribution justify more. A blocked venue should not delay permitted channels. Do not delay the entire launch waiting for the complete ongoing automation system.

Launch completion means remote post URLs and statuses are recorded, links work, permitted destinations are covered or have an explicit skip reason, and the first follow-up check is scheduled. It does not mean a target download count was achieved.

# Part 2 Ongoing marketing

## Build an autonomous layout production pipeline

Begin with a prototype that creates **one** attractive, valid, importable layout end to end. Then build a small reusable set of motifs and expand output. Do not start with unlimited model calls or dozens of accounts.

1. **Choose a brief.** Use a rotation of maps, seasons, styles, and real design problems. Examples: compact animal area, winding orchard, flower courtyard, workshop corner, or a seasonal version of an existing layout. Read public discussions for aggregate needs; do not turn them into unsolicited reply targets.
2. **Construct a plan.** Have the model propose a structured composition using known maps/items and bounded parameters. Apply it through deterministic planner operations. Validate coordinates and item IDs. Use code-generated motifs where they improve reliability. Write to marketing outputs, never silently overwrite the app's bundled templates.
3. **Validate playability.** Reject illegal placement and unintended collisions. Check map bounds, entrances, walking routes, and reachable interactive objects. Check crop access, tree spacing, and any coverage claim. Existing placement validation is not proof that a route is usable; add missing checks explicitly or avoid claims they cannot substantiate.
4. **Render and inspect.** Use the real planner assets and renderer. Inspect the full image and crops for clutter, missing sprites, obscured entrances, awkward empty areas, and readable composition. Reject failed assets. Do not generate an imaginary farm picture and present it as an app export.
5. **Round-trip the file.** Verify the candidate in the actual import format. For the initial pipeline, each newly supported map/format, and relevant app changes, open the file in the native app and confirm expected objects and rendering. Use automated schema/model checks for routine candidates after that path is established.
6. **Package.** Produce the full PNG, useful detail crops, editable plan, alt text, and a short factual explanation. Optional videos can show actual app interaction or an accurately labeled rendered build sequence; do not fabricate gestures or app functionality.
7. **Publish through the queue.** Generate distinct channel copy from the same design, respect destination limits, publish only after all gates pass, and record the remote result.

Keep at most two revision attempts per design. If it still fails, quarantine it and use another brief. Begin with at most six candidate designs per week to obtain up to three accepted designs. These are operating caps, not guaranteed output or growth forecasts. Human review should be reserved for the initial style calibration and unresolved exceptions; routine model, visual, and fact checks belong to the agent.

## Cadence and channel priorities

Default to **up to three accepted designs per week**. Launch at a lower rate if needed. A design can produce a gallery entry and one primary social post; additional crops should serve a different useful purpose rather than flooding feeds with duplicates.

- **Weekly:** publish up to three original gallery pages and corresponding project posts once those channels exist. Maintain a one-week backlog of accepted assets.
- **Community threads:** contribute only at the venue's permitted cadence. Do not interpret three designs per week as three Reddit promotions per week. Use substantive updates and appropriate promotion threads.
- **Short videos:** add at most one weekly reveal/how-to once reliable capture and publishing work. They are optional; do not block image publishing on video automation.
- **Monitoring:** check the project's recent posts and support discussions daily during launch, then three times weekly. Reply automatically only within established authorization and verified support facts. Escalate security/privacy issues, disputes, or commitments of money and roadmap dates.
- **Resource partnerships:** prepare highly relevant submissions opportunistically. Send only when authorized. Do not make creator outreach or manual makeovers a recurring dependency.

Use supported APIs or connected publishing tools. Check current capabilities before choosing a service. If a destination has no reliable permitted integration, retain an exportable ready-to-post pack and prioritize automated channels; do not turn it into a daily task for Phil or bypass platform controls.

## Build the player sharing loop

Implement in this order, subject to normal code/release authorization:

1. **Share-ready exports.** Offer a clean image and an optional tasteful “Made with Stardew Planner” version. Do not obscure the farm or force a promotional caption. Let players edit or omit attribution.
2. **Public layout pages.** Give each original design a stable URL, map/season labels, full image, useful explanation, correct store link, and downloadable file with tested import instructions. Start static and inexpensive. Public marketing assets are separate from private on-device saves.
3. **Easier template opening.** Investigate deep links or native file association after proving that people download templates. Do not promise one-tap opening before it works across supported devices.
4. **Voluntary player submissions.** Add only when moderation and consent are manageable. Obtain permission to publish and credit submissions; never upload private saved farms automatically. The gallery must distinguish project-created designs from player submissions.

The image must be useful even without installing the app. The editable version gives interested players a reason to install. Search pages should contain distinct, helpful designs rather than mass-produced keyword variations. No ranking or viral-growth guarantee is assumed.

## Reliable scheduling and minimal owner involvement

Persist a queue record for every destination-specific post: content ID, layout/version, asset hashes, final text, account, destination, rule-check date, authorization scope, scheduled time/timezone, status, attempt count, and remote post ID/URL. Recommended states: draft, validated, ready, publishing, published, unknown, failed, skipped.

Use a stable idempotency key derived from campaign, content ID, and destination. After a timeout or ambiguous response, mark the post unknown and inspect the remote account or scheduler before retrying. Never automatically duplicate a post whose result is uncertain. Verify publication remotely and retain evidence. Record removals and warnings; pause that destination until the cause is resolved rather than reposting.

Use the existing scheduler if available. Otherwise propose the smallest durable scheduled job with persistent storage and logs. Do not leave an interactive agent or paid machine running indefinitely. Add a global stop switch and per-channel disable controls. On exhausted quotas or a missing cost estimate for a paid operation, stop that operation and preserve the queue.

The owner should receive one weekly digest: published links, useful engagement, app/template interest, failures, cost, what the agent will change next, and at most a few decisions genuinely requiring owner input. Missing optional metrics or a rejected layout should not trigger a message. Group account setup and standing authorization into one initial handoff.

## Measure results and decide what to repeat

Record channel impressions/clicks where available, gallery visits, template downloads, store-link clicks, store-reported installs where accessible, and voluntarily shared player designs. Treat unavailable data as unavailable. Store clicks are not installs, and a download is not proof that a player opened a plan. Cross-platform attribution will be incomplete unless explicitly implemented.

Use campaign-tagged links or supported store campaign links where available. Avoid adding invasive tracking for a free utility. If app analytics are later introduced, handle that as a separate product/privacy change rather than silently adding it to marketing work.

At day 14 and every four weeks thereafter, compare **useful outcomes per design and per dollar**, not just post count. Repeat themes that produce template downloads, relevant questions, store interest, or genuine player shares. If posts receive attention but no downstream activity, improve the destination and call to action before increasing frequency. If templates are downloaded but users struggle to import, fix the workflow before producing more.

Do not scale from one viral post or assume missing metrics are zero. If a channel repeatedly produces no observable downstream interest and takes substantial maintenance, reduce or pause it and retain the reusable assets.

## Agent execution order and acceptance criteria

1. Inspect current release state, repository instructions, existing accounts, integrations, and already-granted permissions. Preserve unrelated changes.
2. Prepare the release fact sheet, three verified designs, native demo, destination, finalized post queue, and support answers.
3. Present only the remaining account/access/standing-permission needs, with the actual launch pack ready to inspect. Continue independent preparation while waiting.
4. When the public-availability gate passes, execute authorized launch posts and verify each remote result. Report any skipped channel with a reason.
5. Prototype one generated layout through construction, validation, rendering, import, and packaging. Then add the persistent queue and one supported publishing integration.
6. Build the small layout gallery and optional attribution export. Establish the weekly cadence only after an end-to-end run works.
7. Run a two-week trial, issue the concise results digest, and adjust themes/cadence without requiring routine owner intervention.

**Initial launch is ready** when the complete pack is prepared, claims and attachments are verified, and the only remaining dependencies are explicitly recorded release/account gates. **Ongoing automation is ready** when a scheduled run can create or select a validated asset, publish within its authorized scope, verify the remote result, avoid duplicate retries, respect cost limits, and produce a useful report without Phil operating the workflow.

## Reference material

- [Earlier research and channel evidence](Stardew%20organic%20launch%20strategy.md): retain as background; this handoff takes precedence on low-touch execution and zero default spend.
- [Mobile planner demand from a Switch player](https://www.reddit.com/r/FarmsofStardewValley/comments/1wp4e2e/anyone_want_to_toy_with_my_farm_layout/): supports the broader phone-as-companion audience.
- [StardewPlan](https://stardewplan.com/) and [Android Stardew Planner](https://play.google.com/store/apps/details?id=com.wisnunug.stardewplanner): existing alternatives; do not claim this app is the first or only mobile planner.
- Community rule links above are launch checks, not permanent permissions. Recheck live rules and platform capabilities at execution time.
