# TwinLink V2 — Product Vision & Production Roadmap

## What TwinLink Is

TwinLink is an **autonomous AI creative director** that generates production-ready ad creatives — static images, UGC videos, carousels, and full campaigns — for brands. It competes with Superscale.ai, Arcads.ai, and TryHolo.

**Unique positioning:** Arabic-first + autonomous agent + image-first video pipeline + editorial UX.

---

## Current State (March 2026)

### What Works
- 19 agent tools (script, image, video, avatar, voiceover, music, composition, character, storyboard, scheduling)
- 8 video models (Sora T2V/I2V/Remix, Veo 3.1/Fast, Kling Pro/Standard, HeyGen Avatar)
- Real-time SSE streaming agent chat with markdown rendering
- Brand analysis (URL scraping → auto-extract identity)
- Competitor research (Meta Ad Library scraping)
- Content calendar with scheduling
- Multi-language (English + Arabic with RTL)
- Editorial "Digital Curator" design system

### What's Broken / Incomplete
- Agent sometimes stops after script (doesn't continue to generation)
- Video composition (Remotion Lambda) needs deployment
- No real platform publishing (OAuth stubs only)
- No billing/payments
- No team collaboration
- No analytics
- Storyboard editor exists but not fully connected to agent flow

---

## Production Roadmap

### PHASE 1: STABILIZE (3-5 days)
*Make what exists actually work reliably.*

#### 1.1 Agent Reliability
- [ ] Fix agent stopping after script/storyboard — ensure it continues full pipeline
- [ ] Add retry logic for 529 overloaded errors (already partial — verify it works)
- [ ] Add timeout handling per tool with graceful degradation
- [ ] Save partial results when a tool fails mid-pipeline
- [ ] Test: Static ad flow end-to-end (prompt → brief → image → done)
- [ ] Test: UGC video flow end-to-end (prompt → script → character → avatar → voiceover → B-roll → music → compose)

#### 1.2 Remotion Deployment
- [ ] Deploy Remotion Lambda function to AWS
- [ ] Create Remotion S3 site with latest compositions
- [ ] Set env vars: REMOTION_FUNCTION_NAME, REMOTION_SERVE_URL, REMOTION_REGION
- [ ] Test compose_video end-to-end
- [ ] Test captions rendering

#### 1.3 UI Bugs
- [ ] Fix user input showing in chat (DONE)
- [ ] Fix empty video thumbnails on generations list
- [ ] Fix generation detail preview sizing
- [ ] Fix "every conversation becomes a generation" — add ability to continue chat
- [ ] Test all pages in both English and Arabic

#### 1.4 Cost Tracking
- [ ] Verify credits are deducted for every tool call
- [ ] Add costs for new models (Veo 3.1, Sora I2V, Kling Standard)
- [ ] Show credits used in generation detail page
- [ ] Show cost estimate before generation starts

---

### PHASE 2: COMPETITOR AD LIBRARY (1 week)
*Superscale's killer feature. Users discover what competitors run, then replicate.*

#### 2.1 Enhanced Competitor Research
- [ ] Upgrade `research_competitor` tool to return structured ad data:
  - Ad thumbnail URL, video URL
  - Run duration (how long the ad has been active)
  - Ad copy (headline, body, CTA)
  - Platform (Meta, TikTok, etc.)
  - Visual composition type detection (social proof grid, UGC testimonial, product hero, etc.)
- [ ] Score algorithm: longer run = higher score, engagement signals, visual quality
- [ ] Store results in `competitor_ads` table with scores

#### 2.2 Ad Library UI (`/dashboard/competitors`)
- [ ] Redesign competitor page with two sections:
  1. **Search** — Enter competitor name/URL, find their ads
  2. **Ad Gallery** — Grid of discovered ads with:
     - Thumbnail (image or video preview with play button)
     - Score badge (0-100, like Superscale's green/orange badges)
     - Brand name + run duration ("4mo", "2w")
     - Composition type label
     - "REPLICATE" button
- [ ] Composition grouping — group similar ads by layout type
- [ ] Filter by: platform, score range, composition type, date range
- [ ] Clicking an ad → expanded view with full analysis

#### 2.3 One-Click Replication
- [ ] New tool: `replicate_ad` — takes competitor ad data, generates brand-matched version
- [ ] Reverse-engineer: visual composition, copy structure, emotional arc
- [ ] Generate matching creative with user's brand identity
- [ ] UX: "Replicate" button → agent runs → output appears

---

### PHASE 3: STORYBOARD EDITOR (1 week)
*The visual planning layer before expensive rendering.*

#### 3.1 Storyboard Flow
- [ ] Agent creates storyboard via `create_storyboard` tool
- [ ] Storyboard appears INLINE in chat (not redirect), with "Edit Storyboard" link
- [ ] Storyboard editor page (`/dashboard/generate/storyboard`):
  - Scene cards with drag-and-drop reorder
  - Per-scene: image prompt editor, duration slider, audio notes, text overlay
  - Model recommendation per scene (Sora/Veo/Kling)
  - Remove/add scenes
  - Total duration indicator
  - Voiceover script section
  - Music mood selector
- [ ] "Render Video" → triggers agent to generate all assets and compose

#### 3.2 Storyboard Preview
- [ ] Generate low-res draft images for each scene (fast, cheap)
- [ ] Show image thumbnails in scene cards
- [ ] Optional: Remotion Player live preview of rough cut

---

### PHASE 4: PUBLISHING PIPELINE (2 weeks)
*Generate → Preview → Schedule → Publish. The complete loop.*

#### 4.1 Platform OAuth
- [ ] Meta (Instagram/Facebook): OAuth token exchange, page selection
- [ ] TikTok Business: OAuth, video upload
- [ ] LinkedIn: OAuth, post publishing
- [ ] X/Twitter: OAuth v2, tweet/media upload
- [ ] Token refresh logic, expiry handling
- [ ] Store encrypted tokens in `platform_connections`

#### 4.2 Publishing API
- [ ] `POST /api/publish` — publish asset to connected platform
  - Platform-specific formatting (aspect ratio, caption limits, hashtags)
  - Media upload (image → platform CDN, video → platform CDN)
  - Error handling for rate limits, token expiry
  - Retry with exponential backoff
- [ ] `POST /api/publish/schedule` — schedule for future publish
- [ ] Supabase Edge Function or cron for auto-publishing at scheduled time

#### 4.3 Post Tracking
- [ ] After publish: store platform post ID in `scheduled_posts`
- [ ] Poll platform APIs for metrics (impressions, likes, comments, shares)
- [ ] Update `post_metrics` table
- [ ] Show metrics in calendar and generation detail

#### 4.4 Calendar Enhancement
- [ ] Click-to-schedule: click calendar day → "New Post" dialog
- [ ] Drag asset from library to calendar day
- [ ] Week view + list view (not just month)
- [ ] Right sidebar: "Upcoming Deliverables" with next 5 scheduled posts
- [ ] Post status indicators: scheduled → publishing → live → metrics available

---

### PHASE 5: BILLING & MONETIZATION (1 week)
*No revenue without this.*

#### 5.1 Stripe Integration
- [ ] `POST /api/billing/checkout` — create Stripe Checkout session
- [ ] `POST /api/webhooks/stripe` — handle payment webhooks
- [ ] Subscription plans:
  - **Free**: 500 credits (one-time), basic models, 1 brand
  - **Pro** ($49/mo): 5,000 credits/mo, all models, 5 brands, priority queue
  - **Enterprise** ($199/mo): 20,000 credits/mo, unlimited brands, team features, API access
- [ ] Credit top-up: buy additional credits ($10 = 1,000 credits)
- [ ] Auto-refill option

#### 5.2 Billing UI
- [ ] Settings page → "Billing & Credits" section:
  - Current plan card (dark bg, plan name, "Upgrade" button)
  - Available credits with refill countdown
  - Recent transactions list
  - Invoice history
- [ ] Pricing page (`/pricing`) for marketing site
- [ ] Upgrade prompts when credits low or feature gated

#### 5.3 Feature Gating
- [ ] Free: basic image gen, basic video gen (Kling Standard only)
- [ ] Pro: all models (Sora, Veo, Kling Pro), music, composition, competitor research
- [ ] Enterprise: team workspace, API access, white-label

---

### PHASE 6: ANALYTICS & PERFORMANCE (1-2 weeks)
*Users can't optimize without data.*

#### 6.1 Analytics Schema
- [ ] `campaign_metrics` table: per-asset impressions, clicks, CTR, spend, ROAS
- [ ] `ab_tests` table: test variants, winner, metrics
- [ ] Platform webhook receivers for automated metric sync

#### 6.2 Analytics Dashboard (`/dashboard/analytics`)
- [ ] Overview cards: total impressions, clicks, CTR, total spend, average ROAS
- [ ] Time series chart (recharts): performance over time
- [ ] Top performing creatives (sorted by ROAS or CTR)
- [ ] Platform breakdown: Meta vs TikTok vs LinkedIn
- [ ] Creative type breakdown: static vs video vs carousel

#### 6.3 A/B Testing
- [ ] Create A/B test from generation variants
- [ ] Track per-variant performance
- [ ] Auto-declare winner after threshold (statistical significance)
- [ ] "Generate more like winner" one-click action
- [ ] Budget allocation recommendation (scale winner, pause losers)

#### 6.4 Creative Intelligence
- [ ] Ad creative score (0-100) before publishing
  - Hook strength, visual hierarchy, copy clarity, platform fit
  - Suggestions for improvement
- [ ] Trend radar: detect trending formats, alert user
- [ ] Performance predictions based on historical data

---

### PHASE 7: TEAM COLLABORATION (1-2 weeks)
*Enterprise deal-killer without this.*

#### 7.1 User Management
- [ ] `org_members` table with roles: owner, admin, editor, viewer
- [ ] Invite flow: email invite → signup → auto-join org
- [ ] Role-based permissions:
  - Viewer: see generations, download assets
  - Editor: generate, edit, schedule
  - Admin: manage brands, team, billing
  - Owner: full access, delete org

#### 7.2 Collaboration
- [ ] Comments on generation assets
- [ ] Approval workflow: draft → review → approved → published
- [ ] Activity feed: who generated what, when
- [ ] @mentions in comments
- [ ] Notification system (in-app + email)

#### 7.3 Multi-brand Workspace
- [ ] Brand-level permissions
- [ ] Client workspace view (agency mode)
- [ ] Branded reports for clients

---

### PHASE 8: LANDING PAGE & MARKETING (1 week)

#### 8.1 Landing Page Redesign
- [ ] Hero section with video demo of the product
- [ ] Feature showcase with real generated examples
- [ ] Pricing table (Free / Pro / Enterprise)
- [ ] Testimonials / social proof
- [ ] FAQ section
- [ ] "Start free — 500 credits" CTA
- [ ] Competitor comparison table

#### 8.2 SEO
- [ ] Meta tags, Open Graph images per page
- [ ] Blog structure (`/blog/[slug]`) for content marketing
- [ ] Documentation pages (`/docs`)

---

### PHASE 9: DEVOPS & PRODUCTION (1 week)

#### 9.1 Deployment
- [ ] Vercel production deployment
- [ ] Custom domain (twinlink.ai)
- [ ] SSL certificate
- [ ] CDN configuration

#### 9.2 CI/CD
- [ ] GitHub Actions: lint → typecheck → build → deploy
- [ ] Preview deployments on PRs
- [ ] Database migration automation

#### 9.3 Monitoring
- [ ] Sentry error tracking
- [ ] Uptime monitoring (Uptime Robot / Better Uptime)
- [ ] API response time tracking
- [ ] Credit usage alerts
- [ ] Generation failure rate dashboard

#### 9.4 Security
- [ ] Rate limiting per user, per IP
- [ ] Input sanitization audit (XSS, injection)
- [ ] API key rotation strategy
- [ ] CORS configuration
- [ ] CSP headers
- [ ] Supabase RLS policy audit

---

### PHASE 10: ADVANCED FEATURES (Ongoing)

#### 10.1 Studio Mode
- [ ] Step-by-step video creation (non-agent flow)
- [ ] Remotion Player for live preview
- [ ] Manual clip reordering with drag-and-drop
- [ ] Text overlay editor
- [ ] Audio mixing controls

#### 10.2 Brand Intelligence
- [ ] Competitor ad monitoring (auto-refresh weekly)
- [ ] Trend alerts
- [ ] Performance benchmarking vs competitors
- [ ] Auto-suggest creatives based on analysis

#### 10.3 E-commerce
- [ ] Shopify product sync
- [ ] Auto-generate ads for new products
- [ ] Inventory-aware (pause ads for out-of-stock)

#### 10.4 API for Developers
- [ ] Public REST API with API key auth
- [ ] Webhook system for generation events
- [ ] JavaScript/Python SDK
- [ ] API documentation page

#### 10.5 White-Label / Agency
- [ ] Custom branding per workspace
- [ ] Client-facing reports
- [ ] Multi-workspace management
- [ ] Revenue share model

#### 10.6 Mobile
- [ ] Responsive dashboard (priority: generate + generations)
- [ ] PWA support
- [ ] Push notifications

---

## Competitive Feature Matrix

| Feature | TwinLink | Superscale | Arcads | TryHolo |
|---------|----------|------------|--------|---------|
| AI Agent Loop | ✅ | ✅ | ❌ | ❌ |
| Static Image Gen | ✅ | ✅ | ✅ | ✅ |
| UGC Video Gen | ✅ | ✅ | ✅ | ✅ |
| Avatar/Talking Head | ✅ | ❓ | ❌ | ✅ |
| Sora 2 Integration | ✅ | ❌ | ❌ | ❌ |
| Veo 3.1 Integration | ✅ | ❌ | ❌ | ❌ |
| Video Storyboard Editor | ✅ | ❌ | ❌ | ❌ |
| Competitor Ad Library | 🔄 Phase 2 | ✅ | ✅ | ❌ |
| One-Click Ad Replication | 🔄 Phase 2 | ✅ | ❌ | ❌ |
| Publishing to Platforms | 🔄 Phase 4 | ✅ | ✅ | ✅ |
| Analytics/Performance | 🔄 Phase 6 | ✅ | ✅ | ✅ |
| A/B Testing | 🔄 Phase 6 | ✅ | ✅ | ✅ |
| Team Collaboration | 🔄 Phase 7 | ✅ | ✅ | ✅ |
| Billing/Subscription | 🔄 Phase 5 | ✅ | ✅ | ✅ |
| Arabic Native | ✅ | ❌ | ❌ | ❌ |
| Shopify Integration | 🔄 Phase 10 | ✅ | ✅ | ❓ |
| API for Developers | 🔄 Phase 10 | ✅ | ❓ | ❌ |
| Background Music Gen | ✅ | ❌ | ❌ | ❌ |
| Remotion Composition | ✅ | ❌ | ❌ | ❌ |

---

## Architecture

```
User → Next.js Frontend → API Routes → Agent Loop (Claude) → Tool Registry
                                                                    ↓
                                        ┌───────────────────────────┤
                                        ↓                           ↓
                                   fal.ai APIs              External APIs
                                   ├─ Nano Banana 2         ├─ HeyGen (avatar)
                                   ├─ Sora 2 (T2V/I2V)     ├─ Suno (music)
                                   ├─ Veo 3.1               ├─ ElevenLabs (TTS)
                                   ├─ Kling v3 (Pro/Std)    ├─ Firecrawl (scraping)
                                   └─ Whisper (transcribe)   └─ Remotion Lambda
                                                                    ↓
                                                              Supabase (DB + Auth + Storage)
```

## Tech Stack
- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, shadcn/ui
- **Backend**: Next.js API routes, Supabase (Postgres + Auth + Storage + RLS)
- **AI**: Claude Opus 4.6 / Sonnet 4.6 (agent + structured output)
- **Image Gen**: fal.ai Nano Banana 2 (edit endpoint for consistency)
- **Video Gen**: fal.ai Sora 2, Veo 3.1, Kling v3
- **Avatar**: HeyGen Avatar4
- **Audio**: Suno (music), ElevenLabs + Gemini (voiceover)
- **Composition**: Remotion Lambda
- **Design**: "Digital Curator" editorial system, Deep Forest Green (#4D5D4B)

---

## Timeline Estimate

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 1. Stabilize | 3-5 days | Week 1 |
| 2. Competitor Ad Library | 1 week | Week 2 |
| 3. Storyboard Editor | 1 week | Week 3 |
| 4. Publishing Pipeline | 2 weeks | Week 5 |
| 5. Billing | 1 week | Week 6 |
| 6. Analytics | 1-2 weeks | Week 8 |
| 7. Teams | 1-2 weeks | Week 10 |
| 8. Landing Page | 1 week | Week 11 |
| 9. DevOps | 1 week | Week 12 |
| 10. Advanced | Ongoing | - |

**MVP launch** (Phases 1-5): ~6 weeks
**Full competitive product** (Phases 1-9): ~12 weeks
