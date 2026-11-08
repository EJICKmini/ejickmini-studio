# Website Studio Playbook v1 (source text for Naive skills)

Written by Claude for Murad, Nov 7 2026, 5:51 PM PST. Purpose: everything the Naive crew must know to run the studio without Murad, Claude or Mini. Grok/Mini converts sections into Naive skills; section numbers stay stable so lessons can reference them.

## 0. Honest state today
- Live demos (Don-Dar, Azimut, Sciencely, Fine Cup) were built by Claude Code and deployed by Mini. NOT Naive output.
- Naive crew output so far: scout research + CEO insert of 3 leads (Melisa Flowers, Soviet Bakery, Sewel atelier) on Nov 7 4:28 PM. Melisa HTML exists only as board comments (card crd_smb41qmkprmzrexyk3ehndw1j0), never published or tested.
- Run 2 (ses_2yg162k88nhs0z6rr9nsrpywmt) stopped: file-write gate after reading CRM data; runtime offered no teammates; no outreach drafts. Spend $0.91.
- Sales clients: Azimut Travel, Don-Dar Hotel, Melisa Flowers. Showcase only: Fine Cup, Sciencely.

## 1. The full cycle (state machine in Neon `businesses.status`)
| # | Stage | Owner | Exit criteria |
|---|---|---|---|
| 1 | lead | scout | real business, city, category, 1+ source URL |
| 2 | researched | scout | evidence quote + URL from a page actually opened; site status: broken/outdated OR no independent site found (list sources checked) |
| 3 | qualified | CEO | AZ/KZ preferred; not a chain/franchise; public contact channel exists; fits capacity |
| 4 | demo_built | designer | labeled demo HTML, visitor task works locally, all unverified facts tagged sample |
| 5 | qa_passed | QA | checklist in section 6 of DESIGN_SYSTEM passes with evidence; fabrication check passes |
| 6 | deployed | CEO | live at /studio/<slug>/, live bytes = QA'd bytes, protected routes unchanged |
| 7 | pitch_drafted | sales | one message, one recipient, contact source recorded, screenshot + link attached |
| 8 | approved | Murad (later: policy, section 8) | approval recorded with time |
| 9 | contacted | sales | sent_at, channel, message id recorded |
| 10 | replied / no_reply | sales | reply logged within 7 days or marked no_reply; max 1 follow-up |
| 11 | won / lost | sales + Murad | price agreed in writing; lost reason recorded |
| 12 | paid | CEO | payment confirmed by the payment provider, amount recorded |
| 13 | live_client | designer + CEO | client-approved facts, client's domain/hosting, banner removed only with written client approval |
| 14 | care | ops agent (later) | monthly updates (hours, FAQ, posts as drafts for client approval) |

Rules: one stage at a time; every transition writes a row to `pipeline_events`; no stage is skipped; a failure writes the exact error and stops.

## 2. Agent roster and models
| Agent | Job | Model (recommended) | Why |
|---|---|---|---|
| CEO | coordinator, Neon writer, deployer | anthropic/claude-sonnet-5.5 (keep) | judgment + long rules |
| scout | find and evidence leads | cheap fast model (GLM 5.3 Flash ok; claude-haiku-5.5 if listed) | high volume; QA re-checks facts. 429s were the search provider, not the model |
| designer | build demo pages | anthropic/claude-sonnet-5.5 (keep) | HTML/CSS quality |
| QA | gatekeeper replacing human review | UPGRADE to anthropic/claude-sonnet-5.5 | a weak QA lets invented facts through; QA is what makes autonomy safe |
| sales | contact finding, pitch, follow-up, reply logging | anthropic/claude-sonnet-5.5 | native-quality AZ/RU/KZ/EN copy |
| reviewer (NEW) | final gate before any email leaves; checks facts, rules, caps | anthropic/claude-sonnet-5.5 | replaces Murad's approval; must be strict |
Verify every id exists in client.models.list() before applying. Do not use a model whose id is not listed.

## 3. Sales agent spec
Input from CEO (sanitized brief): business name, city, category, demo_url, evidence_quote, evidence_url, language. Sales agent finds the contact itself.
Contact rules:
- Use only a channel the business publishes for customers: email on their site, contact form, or a phone/WhatsApp listed on their own site or profile. Record contact_source_url.
- Never scrape lists, buy lists, guess emails, or message staff personally.
- Europe: only a published inquiry address or form, and say where it was found.
Channel order: (1) published email, (2) website contact form, (3) published WhatsApp: draft only, human sends (cold automated WhatsApp/Instagram DMs risk account bans and break platform rules).
Message structure (max 120 words, the business's language, no em-dashes):
1. Who: Murad Gasimov, small studio, Baku roots.
2. What we noticed: one specific, verifiable problem with a quote or screenshot.
3. What we built: link to the labeled demo + phone screenshot.
4. Offer: price from section 7, plain.
5. One easy reply: "Reply yes and I'll send the details" / "not interested" ends it.
Never: invented results, fake urgency, discounts that expire, claims of being their official site, attachments other than the screenshot.
Follow-up: at most one, 5-7 days later, shorter. Then no_reply. Opt-out is permanent (suppression list).
Screenshot: MobileRun read-only capture of demo_url on a phone (CEO-only tool, approve per run).

## 4. Fixes for run 2 blockers (do these before run 3)
1. File-write gate after reading people's data: the CRM rows contain phone numbers inside evidence_quote. Move contact data to a separate `contacts` table that only the sales agent reads. CEO reads only non-personal columns. Designer never receives contact data. Order: delegate build first, write Neon last.
2. No teammates at runtime: run 1 (handoffs "team" + coordinator) DID create scout/designer/QA threads. Run 2 broke after handoffs changed to an explicit array. Most likely cause: that change. Test: revert to the run-1 config with only roster version pins updated; keep the prompt rule "never contact personal CEO or site-editor"; audit thread agent ids after the run.
3. "No verified contact": contacts were never part of scout's job. Azimut publishes info@azimut-travel.kz and Don-Dar publishes dondarhotel@gmail.com on their homepages (seen Nov 7). This is now the sales agent's job (section 3).
4. Salvage: give the designer the Melisa HTML from board card crd_smb41qmkprmzrexyk3ehndw1j0 as a starting draft instead of rebuilding.

## 5. CRM additions (APPLIED Nov 7 2026 5:58 PM PST, approved by Murad)
```sql
alter table businesses add column if not exists price_offered numeric, add column if not exists currency text,
  add column if not exists contacted_at timestamptz, add column if not exists replied_at timestamptz,
  add column if not exists won_at timestamptz, add column if not exists revenue numeric,
  add column if not exists build_cost_usd numeric;
create table if not exists contacts (business_id text references businesses(id), channel text, value text,
  source_url text, verified_at timestamptz, suppressed boolean default false, primary key (business_id, channel));
create table if not exists pipeline_events (id bigserial primary key, business_id text, from_status text,
  to_status text, actor text, note text, cost_usd numeric, created_at timestamptz default now());
```

## 6. Public progress page: /studio/stats/
Static page + stats.json regenerated by the CEO at the end of every run from Neon (no DB credentials in the browser). Shows "last updated" time.
Metrics (definitions fixed so numbers stay honest):
- Businesses researched = count status >= researched
- Demos live = count status >= deployed
- Businesses contacted = count contacted_at not null
- Response rate = replied / contacted (show "n/a" until contacted >= 10)
- Websites sold = count won_at not null
- Revenue = sum(revenue) where payment confirmed, by currency
- Spend = Naive session spend + phone minutes, from pipeline_events.cost_usd
- Cost per live demo = spend / demos live
Show zeros as zeros. Never estimate, round up, or show projected numbers.

## 7. Pricing v0 (hypothesis to test, Murad decides final)
Market seen Nov 7 2026:
- Almaty agencies on Workspace: typical site 200,000-800,000 KZT; Kaspi freelance Tilda landing 40,000-300,000 KZT; OLX low end "from 5,000 KZT".
- Baku freelancers on Lalafo: "from 120 AZN" common; some listings 12-100 AZN.
- DIY: Tilda Personal $10/mo yearly ($15 monthly).
Proposal (cheap, done-for-you):
- Demo: free (we build it before asking).
- Launch (one page, their facts, their domain): 90 AZN / 30,000 KZT / $50 one-time. Domain at cost.
- Care: 15 AZN / 5,000 KZT / $10 per month: hosting, hours/FAQ/price updates, 4 draft posts per month for their approval.
Guardrail: measure real cost per finished site from runs first. Target: build cost < 20% of the Launch price. If not, change the model mix before raising prices.
Prices APPROVED by Murad Nov 7 2026.
Payment rail (hackathon): Stripe Payment Links. Test mode now (free, email signup, test card 4242 4242 4242 4242); live mode later after Murad verifies his identity with Stripe. Price links in USD to avoid Stripe's currency-conversion fee: Launch $50 / 90 AZN / 30,000 KZT one-time; Care $10 / 15 AZN / 5,000 KZT per month (rounded by Murad Nov 7). US account fees: 2.9% + $0.30, +1.5% for non-US cards, no monthly fee. Agents never handle card data; they only send the link and read payment status. Local rails (Kaspi KZ, AZ bank links) are a later step.

## 8. Autonomy (DECIDED by Murad Nov 7 2026 5:59 PM PST: no human approval for sends)
Sends are approved by the reviewer agent, not a person. Gate (all must be true, else no send):
- QA passed the demo; reviewer checked the message against the evidence row and the live demo; contact source URL recorded; business not suppressed; message <= 120 words, business language, no em-dashes, no invented facts, opt-out line present.
- Caps (raised by Murad for the hackathon, Nov 7 8:11 PM PST): new-domain ramp of max 20 first-contact emails on day 1 and 40 on day 2, spread out (at least 3 minutes apart), then +50%/day only while bounce rate < 3% and spam complaints = 0. Pause all sending if either threshold is crossed. Max 1 follow-up per business after 3+ days; never contact the same business on 2 automated channels. Every email still needs its own business-specific demo.
- Auto-send only to Azerbaijan and Kazakhstan businesses. Europe: draft only (stricter unsolicited-email law) until Murad changes this.
- Reviewer writes an approval row to pipeline_events (actor='reviewer', to_status='approved', note=message hash). Sender sends only a message whose hash matches an approval row.
- Any reply that is not a simple yes/no/price question is forwarded to Murad's inbox, not answered by an agent.
Older plan below is kept for reference.

### Previous levels
- L0 (now): crew drafts; Murad approves every send.
- L1: auto-send allowed only if QA passed, contact source verified, business not suppressed, max 5 sends/day, max 1 follow-up. Unlock after 20 approved drafts with zero factual corrections.
- L2: auto-reply to inbound replies with facts only (price, what's included); anything else goes to Murad. Unlock after L1 runs 2 weeks with no complaints.
- L3: auto-onboard paid clients. Requires payment confirmation webhook + client written approval of all facts.
Hard stops at every level: no invented facts, no paid actions above budget, no new agents/schedules without Murad.

## 9. Open decisions for Murad
Decided Nov 7: schema applied, prices approved, payment = Stripe Payment Links (test mode first). Sales agent created (agt_v5y3qfxdj5s3rmgxyjbbfen0pa). Auto-send decided: reviewer agent gate, section 8. Still open: sending domain/inbox for email.send; Stripe account + Payment Links.

## 10. Sponsor credits: what each is for (Nov 7 2026, 7:35 PM PST)
- Apify ($50): PRIMARY lead source. Google Maps scraper actor (third-party actors list ~$0.25-$4 per 1,000 places) for "category + city" in Baku/Almaty/Astana. Keep only places with NO website field or a broken one; that is the qualify signal. Use returned public business phone/site only as a published business channel (contacts table, source_url = the Maps listing). Hard cap: 200 places per run, 1 run/day. Replaces scout's web_search, which hit 429s.
- Monid ($20): Instagram profile lookups for no-website leads (followers, bio, link-in-bio, last post date) to rank them. Pay-per-call; cap $2/run.
- OpenAI ($100): independent second reviewer. Reviewer agent runs on Claude; a check script calls an OpenAI model on the same draft + evidence and must also say PASS. Two vendors agreeing lowers the chance of an invented fact getting through. Cap $1/day.
- Stripe ($1,000): fee credit, only matters in live mode. Test mode is free. Live mode blocked until Murad has an ITIN or a company (see chat Nov 7).
All keys live in .env / Naive vault only. Never in prompts, HTML, Neon or logs.

## 11. Live wiring status (Nov 7 2026, 7:55 PM PST)
- Stripe TEST mode done (Claude Code, stripe-links.json): Launch $50 https://buy.stripe.com/test_7sY4gBflMbK5gNK1GZdby00 ; Care $10/mo https://buy.stripe.com/test_cNi7sN1uWeWh9lidpHdby01 . automatic_tax=false. Restricted STRIPE_AGENT_KEY verified: can create/read Payment Links, Customers, Invoices; cannot refund, capture, pay out or read balance.
- Monid CLI 0.1.9 + key "main" configured in Claude's Mac sandbox, but that sandbox cannot reach api.monid.ai. Monid runs must happen from Claude Code (normal network) or inside a Naive session.
- OPENAI_API_KEY, MONID_API_KEY, APIFY_API_TOKEN written to .env (never committed; .gitignore has .env).
