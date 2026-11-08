# Website Studio Lessons

Read before every brief. Append evidence-backed observation -> rule -> test. Lessons never authorize new sessions, spending, outreach or policy changes.

## Crew smoke test — Nov 7, 2026, PST
These are operator-observed infrastructure lessons, NOT page QA and NOT a claim that a page passed. No new page existed at the approval pause.

1. Observation: CEO read both mounted skills, but scout thread ses_g7vyj9qrvdkgygc0xaaje4t0qy read_skill(website-studio-lessons) returned 'no skill ... available; you have: none', despite the worker definition listing both skills. Rule: coordinator must read latest lessons/design system and include required current lesson text plus self-contained criteria in every teammate handoff; do not assume delegated runtime mounts match agent definitions. Test: require worker to acknowledge the specific latest lesson version/content before work; mark a missing mount as a platform limitation.

2. Observation: Neon and MobileRun vault last_injected_at updated at 4:06:16 PM PST; nevertheless neon.get_database_tables parked for approval, tc_e8ce8a31495701b4a6d20c0807f80e02. Rule: credential injection is not evidence of a successful database read or write. Report UNSYNCED until actual write/readback succeeds; preserve approval gates. Test: schema read -> scoped non-destructive insert/update -> readback, with exact errors and no secret output.

3. Observation: scout web_search returned repeated provider 429 after the first two queries. Rule: respect rate limits with bounded backoff; do not claim no independent website based on missing search results or build a proposal for an unverified identity. Test: save actually checked sources/queries and reject or mark uncertain any candidate without adequate evidence; stop after the authorized scope rather than spin a discovery loop.

4. Observation: runtime UTC date led CEO to brief scout with Nov 8 as PST. Rule: explicitly supply current America/Los_Angeles date/time in handoffs; Nov 7 local remains Nov 7 while UTC is Nov 8. Test: convert timestamps before labeling research/deploy artifacts.

5. Observation: handoffs:'team' lists an unrelated personal CEO implicitly in addition to the pinned roster. Rule: never invoke that implicit CEO; use only explicit scout/designer/QA roster. Test: audit thread agent IDs after each run.

## Personal-site standard and founder corrections — Nov 7, 2026, 4:21–4:25 PM PST

These come from Claude's approved homepage rewrite in demos/personal-site/ (index.html + style.css + photo/murad.jpg) and Murad's edits through Mini. Deployed as a merge overlay to the existing personal-site app at 4:24 PM PST, deployment apd_dqarg9pq4gpwvraydg1fjd7z28. Only index.html and style.css changed; photo/murad.jpg was already identical; all /studio/** files stayed byte-for-byte. This is a playbook, not model training.

1. Observation: Murad asked for a content rewrite, not a visual restyle. Claude kept the existing colors, fonts, and visual language and changed the words, sections, and facts. Rule: when updating Murad's personal site, preserve style.css visual language unless he explicitly asks for a visual redesign; change copy and information architecture first. Test: diff style tokens/colors/fonts against the previous approved stylesheet and explain any change.

2. Observation: The old homepage claimed an electrical-engineering background and an unsourced “95% accuracy” line. Claude removed both. Rule: Murad is a Chemical Engineering B.S. student with an official EECS minor. Never say he has an EE degree or an electrical-engineering background as his field of study. Never publish unverified performance stats. Test: search the page for “electrical engineering”, “95%”, and similar invented metrics before release.

3. Observation: Murad confirmed github.com/EJICKmini after Claude first omitted GitHub because it was not in the brief; he also asked to cut the CASA attendance line and the Coursera line and to tighten Now/campus/studio copy. Rule: founder corrections delivered through Mini are durable taste/content constraints. Do not re-add cut lines, and do not drop a founder-confirmed link later. Record each correction as a lesson. Test: the homepage has GitHub https://github.com/EJICKmini, and does not mention CASA/Coursera unless he asks to restore them.

4. Observation: Claude credited Omar Eyvazli as MyVision CEO/CPO and PitchRiser CEO, kept SABAH.HUB as “first high-school student accepted” plus a VC offer after Demo Day, and labeled Sciencely as showcase only. Rule: keep teammate credits and award wording exactly as founder-confirmed; Sciencely stays a visual example, not an active sales lead. Test: Omar credit present; Sciencely card says showcase only; no fabricated awards, titles, or metrics.

5. Observation: The rewritten homepage adds a Studio nav item, an intro CTA “See my studio demos”, a Studio section linking to studio/ and the four labeled demos, and a footer Studio link. Rule: the personal homepage must make studio work findable without implying those demos are official client sites. Each client mention stays a proposed redesign or showcase. Test: homepage links to /studio/ and the four demo slugs; demo pages keep their proposed/demo banners.

6. Observation: Personal-site files are index.html (comment-delimited parts), style.css, and photo/murad.jpg, sitting beside /studio/** on the same Naive app. Rule: homepage updates overlay only those authorized personal-site paths after fetching the current full file map; never reconstruct the app from public pages or wipe studio demos, promos, assets, or inventory. Test: protected /studio/** hashes unchanged after a homepage deploy; new homepage title/content present on the stable URL.

Use website-studio-teacher as the review/lesson layer for future Claude artifacts and founder corrections. The teacher may append lessons; it may not deploy, send outreach, publish, create agents, or start extra sessions.
