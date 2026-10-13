# Grow Stardew Planner Through Useful Makeovers

**The strongest zero-budget launch is a small farm-makeover campaign that produces useful designs, supported by permanent resource listings and complementary-app partnerships.** Start with players who want to design on a phone, including people playing Stardew on Switch or another console. Your established Reddit account helps establish continuity, but the app should always be introduced openly as your work. Prepare the posts together, then release them over two weeks so you can answer questions and fix problems. Competitors already offer mobile planning, so demonstrate what feels good about your touch workflow instead of claiming an empty market. The initial success criterion is people making and sharing farms, rather than a large announcement view count.

Research checked October 13, 2026. No posts, messages, or outreach were sent. Local store metadata is still marked `draft-not-submitted`; public availability and launch platforms are unverified. Product statements below draw on the local source and draft listing, rather than runtime testing. Any launch draft must wait for tested platform links and confirmation that its claimed features work. ([Draft listing](/Users/philipshen/Developer/stardewplannerapp/store/listing.en-US.json), [file handling](/Users/philipshen/Developer/stardewplannerapp/src/lib/files.ts))

## Phone-based farm design already has demand and competition

The audience is broader than people playing the mobile game. A September 2026 Switch player wanted help arranging a farm, had no computer, and found their familiar planner poor on mobile. An April 2026 question explicitly sought a mobile-friendly layout planner. These are concrete examples of a problem, not a market-size estimate. **“Plan your next farm makeover on your phone”** addresses that problem without promising unsupported game integration. ([Switch-player request](https://www.reddit.com/r/FarmsofStardewValley/comments/1wp4e2e/anyone_want_to_toy_with_my_farm_layout/), [mobile-planner request](https://www.reddit.com/r/StardewValley/comments/1sq4tdf/is_there_a_mobile_friendly_farm_layout_planner/))

Existing options matter both for positioning and finding users. This comparison is based on product pages, listings, and developer statements; it is not a hands-on usability ranking.

| Existing tool | What the evidence establishes | Implication for us |
|---|---|---|
| [Stardew Planner by WisnuNug](https://play.google.com/store/apps/details?hl=en_US&id=com.wisnunug.stardewplanner) | Native Android visual planner; listing shows farm/interior editing, community sharing, in-app purchases, and 10K+ downloads. Exact paid boundaries unverified. | Android already has a native competitor; free status alone needs a good demo beside it. |
| [StardewPlan.com](https://stardewplan.com/) | Its [developer announcement](https://forums.stardewvalley.net/threads/a-modern-farm-planner-desktop-mobile.50930/) describes a free, ad-free mobile/desktop web planner with farm/interior editing and saved share links. | Direct competitor. Our editable-file sharing should not be described as equivalent to its hosted links. |
| [Stardew Planner V3](https://v3.stardew.info/planner/) | Browser planner with Patreon-based ad removal; [maintainer README](https://github.com/hpeinar/planner_v3/blob/main/README.md) describes mobile support as work in progress. | A familiar reference point; old complaints do not prove its present behavior. |
| [stardew.build](https://stardew.build/) | Site describes a free browser planner with eight maps, interiors, coverage checks, and save-file import. Mobile usability unverified. | Another visual alternative; avoid implying every competitor needs a desktop. |
| [The Valley Planner / Stardew Valley Tracker & Guide](https://apps.apple.com/us/app/stardew-valley-tracker-guide/id1424338563) | iPhone/iPad companion with planning/checklist features and in-app purchases; no general visual layout editor verified here. | Adjacent audience and category confusion: say **“visual farm layout planner.”** |

No standalone iOS visual layout planner was verified in this bounded search; that is not evidence none exists. Likewise, listing download counts do not establish active users. Avoid “first,” “only,” or “official mobile planner.”

For ongoing audience research, watch new discussions containing “planner on mobile,” “no PC,” “farm layout,” “iPad,” “rearrange,” and “organize my farm.” The older [2024 mobile-planner thread](https://www.reddit.com/r/StardewValley/comments/1b25vr8) is especially useful language research: the user wanted to organize a messy farm without a PC and described the in-game clock interrupting decoration. Do not turn old threads into a mass-reply list. Collect recurring problems, then make useful layouts that address them.

## Four community routes deserve most launch effort

**Lead with farm-design communities and use each venue's explicit resource or promotion route.** Being free does not exempt an app from self-promotion rules. Recheck rules shortly before publishing; competitor posts demonstrate precedent, not permission for this launch.

| Priority and destination | Appropriate contribution | Current boundary |
|---|---|---|
| 1. [r/FarmsofStardewValley](https://www.reddit.com/r/FarmsofStardewValley/) | Original layout carousel, phone demo, then a permitted makeover clinic. | Sidebar focuses on layouts and crediting creators. No explicit promotion rule appeared in the fetched sidebar; ask moderators to classify an app launch before relying on that silence. |
| 2. [Official Guides & Resources forum](https://forums.stardewvalley.net/forums/guides-resources.14/) | One substantial resource/support thread with usage steps, limits, screenshots, and updates. | [Forum rules](https://forums.stardewvalley.net/pages/rules/) prohibit spam, duplicate threads, and posts primarily intended as advertising. [Category guidance](https://forums.stardewvalley.net/threads/guides-resources-guidelines.11/) asks for context. Frame and maintain a useful resource. |
| 3. [r/StardewValley Tuesday self-promotion thread](https://www.reddit.com/r/StardewValley/wiki/promo/) | One concise maker introduction with working link and demo. | One comment per person. Current policy prohibits promotion under another user's post. Its original-art exception is not a general app-launch exemption. |
| 4. [Community Discord resource maintainers](https://stardew.chat/commands.php) | Request consideration for the planner command or an appropriate resource pin. | Public commands identify `#farm-designs` and planner resources; actual posting permissions and promotion rules were not verified behind login. |

Skip promotional posts on **r/StardewHomeDesign** under its current rules: rule 5 prohibits promotional posts and outside links apart from an Imgur exception. An older planner announcement or invitation does not override that policy. ([Current community rules](https://www.reddit.com/r/StardewHomeDesign/))

Durable placement is the cleverer second step. The official forum already has a [resource megathread](https://forums.stardewvalley.net/threads/mega-thread-of-resources.95/), although its first post was last edited in 2020, so curator responsiveness is unknown. More promisingly, **a complementary-app partnership has actually shipped**: Gunther's Library's August 2026 release notes record adding a StardewPlan.com link. That proves this distribution pattern exists, not that it delivers a particular number of users. Look for guide, gift-tracker, calendar, and checklist makers whose users still need visual layout design. Gunther's Library already links a competitor; any approach needs a concrete additional benefit. ([Gunther's Library release notes](https://apps.apple.com/us/app/gunthers-library-for-stardew/id6754466392))

## Five useful formats can outlive the announcement

**The farm makeover clinic is the core campaign.** Offer three small redesigns: one awkward orchard, one overcrowded animal area, and one path/building arrangement. Ask volunteers for their farm type, screenshot, and one thing they want preserved. Return a before/after PNG and an editable `.stardewplan.json` file, after verifying native export and import. Manually recreate a submitted layout where necessary; do not imply screenshot recognition or game-save editing. Get separate permission before publishing someone's farm, and credit them. The image is useful even to someone who never installs.

**Creator recipe packs** extend a creator's existing work. With permission, recreate one original layout as a credited image, editable file, and short phone recording. Farm-remodel videos by [TeeRobTV](https://www.youtube.com/watch?v=cJXZQPUS2Hs) and [Broken Squirrel](https://www.youtube.com/watch?v=1IguZubmuCo) are topical prospect leads from indexed video descriptions, not vetted partners; direct video fetching failed. Check their current work and contact preferences before approaching. The offer is a useful companion asset with no obligation to promote it.

**“One corner, three moods”** makes participation easy. Show the same small area as an orchard, workshop, and flower garden, with a specific tradeoff under each. Invite alternatives made with any tool, including sketches. This creates a design conversation rather than an install requirement. Run it only in a venue that permits the associated maker disclosure and activity.

**A small searchable layout library** gives posts a lasting destination. Start with three original designs, each on an owned page containing a full-size PNG, farm-map label, short explanation, and editable file. Pinterest has existing [Stardew layout boards](https://ca.pinterest.com/mackenziesoules/stardew-farm-layout/), but this research does not establish search volume or likely referral traffic. Treat three pages and a few original pins as an experiment. This gallery needs to be built; it is not an existing app feature. File downloads are not hosted editable plan URLs, and device import instructions must be tested.

**The phone-beside-the-controller demo** communicates the broader audience immediately. Film a phone adjusting a farm layout beside a console controller, then show the exported reference image. A caption can say “Try your farm makeover on your phone before moving everything in game.” State that the design must be recreated in Stardew. A proposed future deep link could eventually simplify template opening, but there is no basis to promise one now.

## Prepare six drafts and release them over two weeks

The following copy is **unsent and ready to adapt**, not ready to publish unchanged. Replace every bracketed field, verify all feature statements on the released build, and obtain any required venue permission. The draft listing describes no ads, subscriptions, paid features, or login; confirm those remain true at release. Native recordings, finished designs, live links, and the proposed gallery are still preparation work.

### Draft 1: Main subreddit Tuesday comment

> I made **Stardew Planner: Dream Farm**, a free visual farm planner for [VERIFIED PLATFORM]. If you play on a console and plan on your phone, that's the use case I built it around.
>
> You can arrange a layout with touch controls, save it on your device, and export a PNG to reference while playing. There are no ads, subscriptions, or paid features, and no login is required. Here's a short real-device demo: [DEMO].
>
> It's an unofficial fan project. I'd especially like feedback on placing and moving objects on smaller screens. [LIVE STORE LINK]

### Draft 2: Approved farm-design showcase

**Title:** Three orchard ideas for the same [MAP] corner — which would you keep?

> I kept [SPECIFIC CONSTRAINT] unchanged in these three layouts. A leaves the widest walking path; B makes room for [VERIFIED DESIGN DETAIL]; C is the decorative option.
>
> [THREE ORIGINAL IMAGES]
>
> I made these with the free phone planner I'm developing, Stardew Planner: Dream Farm. Which arrangement would you use, and what would you change? [LINK ONLY WHERE PERMITTED]

### Draft 3: Official-forum resource thread

**Title:** Free phone farm-layout planner — touch demo, image exports, and feedback

> I made an unofficial visual farm planner for [VERIFIED PLATFORM], especially for people who want to sketch a redesign on their phone. It is free, with no ads or paid features. [LIVE LINK]
>
> Here's a walkthrough using [SUPPORTED MAP]: choose the map, place a few objects, rearrange the area, then export a PNG to keep beside the game. [NATIVE DEMO AND EXAMPLE IMAGE]
>
> Designs save on the device. You can also export an editable `.stardewplan.json` file; [TESTED DEVICE-SPECIFIC IMPORT INSTRUCTIONS]. That file opens in this planner—it does not change your Stardew game save. Current limits: [VERIFIED LIMITATIONS].
>
> I'll keep updates and known issues in this thread. If something behaves oddly, the device model, operating-system version, and steps to reproduce would help. Thanks for trying it.

### Draft 4: Permitted makeover volunteer call

> Have one farm corner you keep putting off fixing? I'm doing three small makeovers with the free mobile planner I made.
>
> Share your farm type, a screenshot, and one thing you want to keep. I'll choose three I can finish this week and return an image of the proposed layout plus an editable planner file. You don't need to install anything to submit a screenshot or use the image.
>
> I'll ask separately before featuring your farm publicly, and credit you if you agree. This is a design exercise; you'll recreate any changes you like in the game. [ONLY INCLUDE A LINK IF THE VENUE PERMITS IT]

### Draft 5: Creator collaboration outreach

> Hi [NAME] — I liked [SPECIFIC VERIFIED MOMENT] in your [VIDEO/LAYOUT]. I make a free, ad-free Stardew farm-layout app for [PLATFORM].
>
> Would an editable companion to that design be useful for your viewers? With your permission, I can prepare a credited PNG, planner file, and short phone demo for you to review. You control whether it is published, and there's no obligation to cover the app.
>
> Here's one finished example and the working app link: [EXAMPLE] [LINK].

### Draft 6: Resource or complementary-app maintainer outreach

> Hi [NAME] — your [SPECIFIC RESOURCE/APP] helps Stardew players with [SPECIFIC TASK]. I maintain Stardew Planner: Dream Farm, a free unofficial visual layout planner for [VERIFIED PLATFORM].
>
> I wondered whether it would be useful alongside your existing resources for people planning on a phone. The workflow is [ONE VERIFIED DISTINCTIVE BENEFIT], and users can export a reference image without making an account. Here's the live listing, a 20-second demo, and current limitations: [LINKS].
>
> Would you be open to evaluating it for your resource list? Happy to provide a short description and keep you informed if support changes.

**Prepare a compact asset kit:** one 20-second native recording, three original layout PNGs, one completed makeover pair, three import-tested plan files, confirmed store links, and short answers covering platform support, pricing, saving, and game-import limitations. A creator kit can reuse these assets. The app's draft localization claims are not a reason to scatter unreviewed translated posts across communities.

| Timing | Action |
|---|---|
| Before day 1 | Test downloads and file workflows; finish assets; check community rules and seek needed classifications/permissions. |
| Days 1–2 | Publish one approved primary-community contribution and the forum resource thread; use the next Tuesday thread when its calendar date falls. |
| Days 3–4 | Answer questions, fix discovered problems, and open the permitted three-slot clinic. |
| Days 5–7 | Publish the first consented makeover and a precise touch-control demonstration on owned channels. |
| Days 8–10 | Send authorized, individually tailored creator/resource pitches; publish a useful how-to or original layout page. |
| Days 11–14 | Share consented results and a concise update where allowed; review which channels produced actual use. |

This cadence is a practical recommendation, not a measured optimum. Keep one thread alive where appropriate rather than repeatedly launching into the same community.

## Learn from finished farms before expanding distribution

Use a simple manual log: venue, date, asset, link if available, substantive player conversations, reported installation/export failures, and voluntarily shared finished designs. Record store-attributed downloads only if attribution is actually configured; this plan assumes no existing analytics. A reasonable two-week experiment target is **10 useful player conversations and five voluntarily shared designs**, explicitly a target rather than a forecast. A high-view post with no evidence of use should not automatically become the template for the next campaign.

The first clinic will also reveal what deserves development effort. If people enjoy the images but struggle to open the editable files, simplify that workflow before producing dozens of packs. If a guide-app maintainer repeatedly encounters the same phone-planning need, that relationship can become a steady discovery path. Concentrating on those demonstrated needs gives a free fan project a manageable way to grow without an endless posting schedule.
