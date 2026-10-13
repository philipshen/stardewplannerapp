# Creative organic launch opportunities

## Which product story and communities fit?

### Takeaway
Position this as a free phone/tablet companion for anyone planning a Stardew farm, including PC and console players. The strongest creative campaign is a recurring farm makeover with a useful downloadable result, rather than repeated app announcements.

### Cited Findings
- Local documentation describes touch tools, seasonal views, equipment coverage, on-device named saves, PNG sharing and editable `.stardewplan.json` export. No hosted plan URLs or multiplayer rooms are included. These are source/documentation observations, not runtime verification. [README](/Users/philipshen/Developer/stardewplannerapp/README.md); [file helpers](/Users/philipshen/Developer/stardewplannerapp/src/lib/files.ts)
- Store metadata names the app **Stardew Planner: Dream Farm**, describes it as free with no subscriptions, paid features or ads, and has status `draft-not-submitted`. Public release and exact supported launch platforms are unverified. [listing](/Users/philipshen/Developer/stardewplannerapp/store/listing.en-US.json)
- The community Discord's public command reference explicitly points designers to `#farm-designs`, the official forums' farm-design section, and r/FarmsofStardewValley. Its design advice recommends starting with one small farm area and using a planner. It also lists international Stardew servers. [community command reference](https://stardew.chat/commands.php)
- Official forums have an established resource thread listing farm planners, save tools and calculators. The first post was last edited in 2020, so this is evidence of the resource-list format, not proof its curator accepts new submissions today. [resource thread](https://forums.stardewvalley.net/threads/mega-thread-of-resources.95/)
- A forum conversation about restarting a farm recommends a planner-assisted makeover instead. This demonstrates a specific user problem worth solving, not a market-size estimate. [forum discussion](https://forums.stardewvalley.net/threads/thinking-about-restarting-my-farm.27203/)

### Inferences
- Lead with **"Plan your next farm makeover on your phone"**, followed by **"Free, offline, no ads"** after native release verification. Do not claim first/only mobile planner or imply official affiliation.
- Core audiences: aesthetic decorators; players overwhelmed by redesign; people playing on a TV with a phone nearby; people who want to plan away from their gaming device. “Mobile app users” is broader than “mobile Stardew game players.”
- A farm-design community is a stronger initial fit than generic indie-app promotion because the output itself is relevant there. The maker should be openly identified wherever the app is mentioned.
- The curated-resource route could yield recurring recommendations: ask maintainers whether a native mobile companion belongs alongside existing tools, with a one-line description, tested platform links and two screenshots. Keep this to legitimate editorial requests, not mass link placements.

### Gaps
- Public availability, platform links, and native PNG/plan import/export behavior need release checks before posts are published.
- Current Discord channel rules and resource submission processes were not inspected behind login. Public commands identify places to investigate, not posting permission.
- No conversion/retention evidence establishes which audience or channel will outperform.

## What are specific creative opportunities beyond Reddit?

### Takeaway
Build useful design material once and reuse it as a makeover, short video, downloadable plan, Pinterest image and searchable guide. Small farm-design creators are better initial collaboration prospects than broad gaming personalities.

### Cited Findings
- **TeeRobTV** published a Stardew farm-remodel livestream on April 13, 2026, explicitly focused on paths, buildings, aesthetics and layout ideas. Search-extracted metadata showed a small channel; follower counts should be rechecked before outreach. Direct video fetch failed. [video](https://www.youtube.com/watch?v=cJXZQPUS2Hs)
- **Broken Squirrel** has an indexed farm-makeover video centered on a Golden Clock design and seasonal decorations. This is a topical-fit lead, not evidence of willingness to collaborate; direct video fetch failed. [video](https://www.youtube.com/watch?v=1IguZubmuCo)
- **Fleurs** has published Stardew streams and links social/Discord presences in the video description. The particular verified example is from 2024, so current Stardew activity needs checking; this is a secondary prospect, not a launch dependency. [video](https://www.youtube.com/watch?v=UsbWtDwhgvw)
- Pinterest indexes actual Stardew layout pins, including planner-focused material and farm-layout boards. This proves an existing visual category, not traffic volume. Direct pin fetch failed, so findings rely on indexed page titles. [planner pin](https://www.pinterest.com/pin/838584393101267589/); [layout board](https://ca.pinterest.com/mackenziesoules/stardew-farm-layout/)
- The community command reference includes a Wickedy dice-farm challenge. This supports the existence of creator-led Stardew challenges, not a prediction that our challenge will spread. [reference](https://stardew.chat/commands.php)

### Inferences
1. **Farm makeover clinic — highest priority.** Offer three volunteer redesigns: keep their favorite buildings, work within an agreed map, produce before/after PNGs and an editable plan file. Obtain permission to publish their farm and credit them. End each installment with a new design question rather than a generic download pitch. Manually recreate submitted screenshots if necessary; do not imply automatic screenshot-to-plan import.
2. **Creator recipe packs.** Offer a small creator an editable recreation of one of their own layouts, with their permission, attribution, a static PNG and a 15–30 second phone recording. Their followers get a useful companion to the video. Creator controls the design and whether they mention it. TeeRobTV and Broken Squirrel are specific leads to vet; no messages sent.
3. **“One corner, three moods” challenge.** Publish the same small blank area plus three real designs: cozy orchard, productive workshop, flower garden. Invite screenshots, permit any planner, and feature submissions only with consent. Low effort to join; avoid mandatory installs or referral mechanics.
4. **Pinterest/search library.** Create six genuinely different original layouts, each with full-size image, map/season label, short rationale and an editable file on an owned page. Example search headings: “Forest Farm orchard layout,” “Meadowlands coop courtyard,” “Four Corners farm ideas.” Each page should help someone even without installing. This requires new site content; the current support page is not such a gallery. Search demand/SEO ranking is unmeasured.
5. **Phone beside the controller demo.** Film a hand adjusting a layout on a phone beside a console controller, then show the plan. It communicates the companion use case without needing game-save integration. Clearly say a design plan must be recreated in game; no direct console import claim.
6. **Localized design posts.** After a native speaker checks both copy and app UI, adapt one useful example for a relevant language community. Existing UI localization offers a starting point, not evidence that translated marketing or every community is ready.
7. **Seasonal design calendar.** Repeat evergreen player moments: “Winter renovation before Spring 1,” “new coop without moving everything,” “tiny orchard,” “first Junimo Hut.” Tie to in-game seasons, not real-world season assumptions.

### Gaps
- Creator contact preferences, recent output and willingness to do unpaid collaborations remain unverified.
- No evidence supports a guaranteed Pinterest/search payoff; run a bounded experiment before producing dozens of pages.
- File packs are a proposal, not currently published assets. No claim of direct import into the game or hosted editable web links is justified.

## What should be prepared and when should it ship?

### Takeaway
Prepare a bank of different useful posts, then release over 10–14 days. A staggered launch leaves time to answer questions, catch download problems and improve later posts; this timing is a recommendation, not a measured optimum.

### Cited Findings
- Existing app source supports image and JSON-file sharing, making PNG plus editable-file packs a plausible deliverable after native verification. [file helpers](/Users/philipshen/Developer/stardewplannerapp/src/lib/files.ts)
- The listing explicitly identifies the tool as unofficial and fan-made. Preserve that disclosure in launch material. [listing](/Users/philipshen/Developer/stardewplannerapp/store/listing.en-US.json)

### Inferences
**Preparation inventory:** one 20-second native phone demo; three original makeover pairs; six layout PNGs; three tested editable files; one small landing page with only live platform buttons; five channel-specific post drafts; short replies covering platforms, price, offline saves, import limitations and fan-project status. Creator/media kit can reuse these rather than require a separate video production.

**Proposed cadence:** Day -7 to -1 test links and obtain any community permissions; Day 0 one approved main community post plus own channels; Day 2 design-first showcase on a distinct appropriate community; Day 4 first makeover; Day 6 useful tutorial; Day 8 creator/resource pitch after early fixes; Day 10–14 publish user designs and one concise changelog. One or two strong touches per community beat identical cross-posts. Follow actual community rules from the companion research; this is not authorization to post.

**Draft A — maker introduction, suitable only for permitted promo venues**
> I made a free Stardew farm planner for [LIVE PLATFORM] because I wanted to rearrange my farm on my phone. Here's a 20-second look at planning a [MAP] layout. You can check equipment coverage, save designs locally and export a picture or editable plan file. No ads or paid features. It's an unofficial fan project, and I'd love feedback on how the touch controls feel. [LIVE LINK]

**Draft B — design-first showcase, only where maker/tool disclosure is permitted**
> Three ways to fit an orchard into this [MAP] corner. I kept [SPECIFIC CONSTRAINT] the same in all three; A favors walking space, B leaves room for [ITEM], and C is mostly for the look. Which would you use? I made these in the free mobile planner I'm building. [IMAGE CAROUSEL; LINK ONLY IF ALLOWED]

**Draft C — makeover volunteer call, only with venue permission**
> I'm doing three small Stardew farm makeovers with the free phone planner I made. Share a screenshot, your farm type and one thing you want to keep. I'll pick three I can finish this week and return a before/after design plus an editable plan file. I'll ask separately before featuring your farm publicly. No install needed to submit a screenshot.

**Draft D — short video script**
> Your farm can stay exactly as it is while you try this. [Show existing plan.] Move the coop. Reroute the path. Check the sprinkler coverage. [Show result.] Then keep the version you like. I built this free Stardew planning app for [LIVE PLATFORM]. Unofficial fan project. [LINK/CAPTION]

**Draft E — Pinterest/owned gallery copy**
> [MAP] orchard corner: three layout ideas. Full-size images, layout notes and an editable file made with Stardew Planner: Dream Farm. Free unofficial phone/tablet planning app for [LIVE PLATFORM]. [SPECIFIC GALLERY PAGE]

**Draft F — creator collaboration pitch, preparation only; do not send without authorization**
> Hi [NAME] — I liked [SPECIFIC REAL VIDEO/MOMENT]. I made a free, ad-free Stardew planner for phones and wondered whether an editable companion to your [LAYOUT] would be useful to viewers. With your permission, I can prepare the plan, credited PNG and a short phone demo for you to review. No obligation to cover it. [WORKING LINK + ONE RELEVANT EXAMPLE]

**Measurement:** manually track venue, asset, date, comments asking for links, qualified feedback, reported export problems and public designs shared. If using store campaign attribution, verify setup first; do not imply app analytics already exist. Set a two-week output goal of 10 useful player conversations and 5 voluntarily shared designs as an experiment target, not a forecast. Stop channels generating only views and no use signals.

### Gaps
- The draft pack is copy only: native recordings, original designs, gallery pages, live links and permissions are not created here.
- No posts, messages or account changes were made. No code changed; these research notes do not establish a launch-ready build.
