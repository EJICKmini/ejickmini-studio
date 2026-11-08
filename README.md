# ejickmini Studio

An autonomous website studio for small businesses in Azerbaijan and Kazakhstan, built on the [Naive](https://usenaive.ai) managed-agents platform for the Naive Autonomous Company Hackathon (Y Combinator, San Francisco, Nov 7–8, 2026).

Founder: Murad Gasimov (UC Berkeley, from Baku).

## What it does

Most small businesses in Baku, Almaty and Astana live on Instagram and Google Maps and have no website, or a broken one. The studio:

1. **Finds** them: a scout agent pulls businesses from Google Maps (Apify) and checks their Instagram activity (Monid).
2. **Qualifies** them: real, independent, active, no website or a broken one, with a public contact channel.
3. **Builds** a free, clearly labeled demo website for each one, in their language.
4. **Checks** it: a QA agent tests every page before it goes live.
5. **Ships** it: the CEO agent deploys it to `/studio/<slug>/` without touching any other page.
6. **Sells**: a sales agent writes one personal message per business, and a reviewer agent (Claude plus an independent OpenAI check) must pass it before anything is sent.
7. **Earns**: Stripe payment links. Launch $50 (90 AZN / 30,000 KZT), Care $10/month.

Every step is logged in a Neon Postgres CRM, and a public stats page shows the real numbers.

## Live links

- Studio index: https://personal-site-xs12r15q0hxw.vercel.app/studio/
- Live stats: https://personal-site-xs12r15q0hxw.vercel.app/studio/stats/
- All 15 demo pages: [`crm/demos.csv`](crm/demos.csv)
- Inbound "get a free demo" form: on the studio index page

## The crew (Naive agents)

| Agent | Model | Job |
|---|---|---|
| website-studio-ceo | anthropic/claude-sonnet-5.5 | Coordinator. Runs the pipeline, deploys, owns the CRM |
| website-studio-scout | anthropic/claude-haiku-5.5 | Finds and evidences leads (Apify Maps, Monid Instagram) |
| website-studio-designer | anthropic/claude-sonnet-5.5 | Builds one labeled demo page per business |
| website-studio-qa | anthropic/claude-sonnet-5.5 | Tests pages at phone and desktop widths |
| website-studio-sales | anthropic/claude-sonnet-5.5 | Finds the public contact and writes the pitch; owns hello@ejickmini.com |
| website-studio-reviewer | anthropic/claude-sonnet-5.5 + OpenAI gpt-5.4-mini | Final gate before any message leaves |

Shared skills: `website-studio-operations`, `website-studio-design-system`, `website-studio-lessons` (the lessons skill is updated by the crew after each run).

## Safety rules

- Every demo shows a persistent banner: "Proposed first website / redesign for [business] — demo, not the official website." No business logos, photos or domains.
- Unverified prices, hours and details are labeled as samples. No invented reviews, awards or results.
- Demo forms send nothing and store nothing.
- Outreach: one business, one message, one follow-up at most. Opt-out on every message. New-domain sending caps (20, then 40 per day, growing only while bounces stay under 3% and complaints stay at zero). Europe is draft-only.
- No automated Instagram or WhatsApp DMs (platforms ban bots). Those drafts are sent by a person.
- The agents' database login cannot delete or drop anything. Their Stripe key cannot refund, pay out or read the balance.

## Repository map

| Path | What it is |
|---|---|
| `STUDIO_PLAYBOOK.md` | The operating manual the agents are taught from (pipeline, roles, pricing, autonomy levels, sponsor tools) |
| `DESIGN_SYSTEM.md` | How demo pages are designed and verified |
| `STUDIO_LESSONS.md`, `studio-crew/LESSONS.md` | Lessons learned from each run |
| `STATUS.md` | Append-only log of everything that happened, with times |
| `RUN_REPORT.md`, `AUTONOMY_ROADMAP.md`, `CREW.md` | Run reports and the path to full autonomy |
| `company.js`, `studio-crew/` | Agent prompts and crew configuration |
| `bounded-run/` | Evidence and scripts from a bounded crew run |
| `demos/` | Hand-built redesigns (Don-Dar, Azimut, Fine Cup, Sciencely), originals, previews, personal homepage |
| `stripe-setup.ts`, `stripe-links.json` | Stripe products, test-mode payment links and invoice helper |
| `mobile-shot.ts` | Real-phone screenshots of any URL through MobileRun |
| `load-crm.ts` | Loads a CRM snapshot into Neon |
| `crm/demos.csv` | Index of every live demo |

The 11 agent-built demo pages live in the Naive-hosted app (`personal-site`); the CRM source of truth is the Neon project `website-studio-crm`.

## Running it

```bash
npm install
cp .env.example .env   # fill in your own keys; never commit .env
npm run smoke          # checks the Naive key works
npm run shot -- https://example.com example   # one real-phone screenshot (MobileRun)
```

`run-ceo.ts` is retired on purpose (it exits with a message). The crew is run from Naive itself: one operating-day session for the CEO, plus inbound email waking the sales agent.

## Who built what

- Hand-built redesigns of Don-Dar, Azimut, Fine Cup and Sciencely, and the personal homepage: Claude Code.
- Crew configuration, deployments and run reports: Mini (Grok).
- Playbook, pricing, CRM schema and reviews: Claude.
- Everything under `/studio/` beyond those four pages, the leads, enrichment, QA, deploys and drafts: the Naive crew.

## Sponsors used

Naive (agents, hosting, email), Neon (CRM), Apify (Google Maps), Monid (Instagram data), OpenAI (second reviewer), Stripe (payments), MobileRun (real-phone screenshots).
