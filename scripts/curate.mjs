#!/usr/bin/env node
/**
 * curate.mjs
 *
 * Reads scripts/candidates.json (output of scrape-candidates.mjs),
 * picks a curated subset of scrape entries, appends manual entries
 * for known marketing AI products that the scrape missed (especially
 * comms + media), and writes everything back with approved:true.
 *
 * After running, scripts/import-approved.mjs will write .md files for
 * exactly this curated set.
 *
 * Usage:
 *   node scripts/curate.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CANDIDATES = join(__dirname, 'candidates.json');

// Names from the scrape we want to KEEP (case-insensitive match on name).
// These are products (not announcements/blog posts) that fit MyAgentStack.
const APPROVED_FROM_SCRAPE = new Set(
  [
    // Content
    'Jasper',
    'Copy.ai',
    'copy.ai',
    'Rytr',
    'wordtune',
    'Compose AI',
    'Hypotenuse AI',
    // SEO/GEO
    'Phind',
    'You.com',
    'Komo AI',
    'Consensus',
    'MemFree',
    'Quick Creator',
    'Trolly.ai',
    // Brand
    'Brandmark',
    'Ponzu',
    'Gamma',
    'Clickable',
    'Diagram',
    'Freepik AI',
    // Martech / automation
    'n8n',
    'Taskade',
    'MindPal',
    'AgentDock',
    'Tiledesk',
    'Pieces',
    // Social
    'Taplio',
    'Socialsonic',
    'Podify.io',
  ].map((s) => s.toLowerCase())
);

// Manual entries — known marketing AI products to fill gaps and seed
// strong SEO terms. Each becomes a community-tier .md file.
const MANUAL = [
  // ===== COMMS (PR / media relations) =====
  {
    name: 'Cision',
    url: 'https://www.cision.com',
    category: 'comms',
    tagline:
      'PR platform with AI-powered media database, journalist matching, and earned media measurement.',
    description:
      'Cision is the dominant PR software platform — journalist database, media monitoring, and earned media analytics, with AI built in for journalist matching, message optimization, and impact measurement.',
    maker: 'Cision',
    pricing: 'Enterprise',
  },
  {
    name: 'Muck Rack',
    url: 'https://muckrack.com',
    category: 'comms',
    tagline: 'AI-powered journalist database and PR software for finding and pitching reporters.',
    description:
      'Muck Rack is the modern PR platform — journalist search, AI-driven pitch matching, media monitoring, and reporting. Used by PR teams to find the right journalists and track coverage.',
    maker: 'Muck Rack',
    pricing: 'Custom',
  },
  {
    name: 'Prowly',
    url: 'https://prowly.com',
    category: 'comms',
    tagline: 'PR software with AI assist for press releases, media database, and contact management.',
    description:
      'Prowly is a SaaS PR platform from Semrush — press release builder, media database, contact CRM, and AI-assisted writing for in-house PR and small agency teams.',
    maker: 'Prowly (Semrush)',
    pricing: 'Paid',
  },
  {
    name: 'Notified',
    url: 'https://www.notified.com',
    category: 'comms',
    tagline:
      'Comms cloud with AI-driven press release distribution, IR, social listening, and earned media.',
    description:
      'Notified offers an integrated comms platform — wire distribution, social listening, investor relations, and AI tools for content optimization and audience targeting.',
    maker: 'Notified',
    pricing: 'Enterprise',
  },
  {
    name: 'Beatrix Studio',
    url: 'https://www.beatrixstudio.ai',
    category: 'comms',
    tagline: 'AI press release writer trained on real PR practitioner output.',
    description:
      'Beatrix is an AI press release and media pitch writer focused on PR-quality output rather than generic AI sludge — trained on press releases that have actually run on the wires.',
    maker: 'Beatrix',
    pricing: 'Paid',
  },
  {
    name: 'PressHook',
    url: 'https://presshook.io',
    category: 'comms',
    tagline: 'AI-powered platform connecting brands with journalists and media outlets.',
    description:
      'PressHook is a brand-to-media matching platform with AI pitch optimization, journalist discovery, and direct press kit distribution.',
    maker: 'PressHook',
    pricing: 'Paid',
  },

  // ===== MEDIA (distribution / wire) =====
  {
    name: 'GlobeNewswire',
    url: 'https://www.globenewswire.com',
    category: 'media',
    tagline: 'Global press release wire — distribution, indexing, and SEO-optimized newsroom hosting.',
    description:
      "GlobeNewswire (Notified) is one of the world's largest press release distribution wires — SEC filings, IR releases, multimedia, and AI-indexed newsroom hosting that reaches journalists, retail investors, and search engines.",
    maker: 'Notified',
    pricing: 'Per-release pricing',
  },
  {
    name: 'PR Newswire',
    url: 'https://www.prnewswire.com',
    category: 'media',
    tagline: 'Press release distribution and earned media platform from Cision.',
    description:
      'PR Newswire is the wire arm of Cision — global press release distribution, multimedia syndication, IR releases, and earned media measurement.',
    maker: 'Cision',
    pricing: 'Per-release pricing',
  },
  {
    name: 'Business Wire',
    url: 'https://www.businesswire.com',
    category: 'media',
    tagline: 'Berkshire Hathaway-owned press release distribution wire with global reach.',
    description:
      'Business Wire is a leading press release distribution platform owned by Berkshire Hathaway — full-text indexing on major search engines, financial reporting, and patented news distribution technology.',
    maker: 'Berkshire Hathaway',
    pricing: 'Per-release pricing',
  },
  {
    name: 'Newswire.com',
    url: 'https://www.newswire.com',
    category: 'media',
    tagline: 'Press release distribution with AI-powered Media Studio for SMB-friendly PR.',
    description:
      'Newswire offers press release distribution with bundled media database access, AI-assisted release writing, and Earned Media Advantage Program for SMBs.',
    maker: 'Newswire',
    pricing: 'Subscription / per-release',
  },
  {
    name: 'EIN Presswire',
    url: 'https://www.einpresswire.com',
    category: 'media',
    tagline: 'Affordable press release distribution to news search engines and journalists.',
    description:
      "EIN Presswire is one of the most affordable wire services — distributes to Google News, AP feeds, and journalist databases. Best for SMBs and frequent-release programs.",
    maker: 'EIN News Service',
    pricing: 'From $99/release',
  },
  {
    name: 'Send2Press',
    url: 'https://www.send2press.com',
    category: 'media',
    tagline: 'Press release distribution with strong SEO and Google News indexing.',
    description:
      'Send2Press distributes press releases to Google News-indexed publishers, journalists, and trade outlets, with social media amplification and reporting.',
    maker: 'Neotrope',
    pricing: 'From $199/release',
  },
  {
    name: '24-7 Press Release',
    url: 'https://www.24-7pressrelease.com',
    category: 'media',
    tagline: 'Budget-friendly press release distribution to news sites and search engines.',
    description:
      "24-7 Press Release Newswire offers economical wire distribution with Google News indexing, journalist outreach, and tiered packages from $49 to enterprise pricing.",
    maker: '24-7 Press Release',
    pricing: 'From $49/release',
  },

  // ===== CONTENT (additional famous tools) =====
  {
    name: 'ChatGPT',
    url: 'https://chat.openai.com',
    category: 'content',
    tagline: 'OpenAI conversational AI — the universal AI agent for writing, research, and analysis.',
    description:
      "ChatGPT is OpenAI's conversational AI — used by marketers for everything from blog drafts to ad copy to research. The default starting point for AI-assisted content work.",
    maker: 'OpenAI',
    pricing: 'Free / $20mo Plus / Team / Enterprise',
  },
  {
    name: 'Claude',
    url: 'https://claude.ai',
    category: 'content',
    tagline: 'Anthropic Claude — long-form AI content, research, and brand-voice writing.',
    description:
      "Claude (Anthropic) is the long-context AI assistant favored for editorial writing, research synthesis, and brand-voice work. Strong on long-form content quality and following style contracts.",
    maker: 'Anthropic',
    pricing: 'Free / $20mo Pro / Team / Enterprise',
  },
  {
    name: 'Notion AI',
    url: 'https://www.notion.com/product/ai',
    category: 'content',
    tagline: 'AI writing and brainstorming inside Notion docs and databases.',
    description:
      'Notion AI brings drafting, summarizing, and translating into Notion workspaces — used for content briefs, internal documentation, and research collation.',
    maker: 'Notion Labs',
    pricing: 'Add-on $10/seat/mo',
  },
  {
    name: 'Sudowrite',
    url: 'https://www.sudowrite.com',
    category: 'content',
    tagline: 'AI writing partner for long-form fiction and narrative content.',
    description:
      'Sudowrite is the AI writing tool focused on narrative, voice, and long-form storytelling — used by content teams who care about voice, not just word count.',
    maker: 'Sudowrite',
    pricing: 'From $19/mo',
  },
  {
    name: 'Hemingway Editor',
    url: 'https://hemingwayapp.com',
    category: 'content',
    tagline: 'Readability and clarity editor with AI-assisted rewriting.',
    description:
      'Hemingway Editor flags hard-to-read sentences, passive voice, and adverb overuse, with AI rewrite suggestions. Standard QA tool for content teams.',
    maker: '38 Ideas',
    pricing: 'Free / $19.99 Plus',
  },

  // ===== SOCIAL (additional famous tools) =====
  {
    name: 'Hootsuite OwlyWriter',
    url: 'https://www.hootsuite.com/products/owlywriter',
    category: 'social',
    tagline: 'AI social copywriter built into Hootsuite for cross-platform posts.',
    description:
      'OwlyWriter AI generates social copy across LinkedIn, X, Facebook, Instagram, and TikTok directly inside Hootsuite — branded for marketers who manage multiple channels at once.',
    maker: 'Hootsuite',
    pricing: 'Included with Hootsuite plans',
  },
  {
    name: 'Buffer AI Assistant',
    url: 'https://buffer.com/ai-assistant',
    category: 'social',
    tagline: 'AI-powered post generator and repurposer inside Buffer.',
    description:
      'Buffer AI Assistant drafts and adapts social posts across networks — built for solo creators and small teams already in Buffer.',
    maker: 'Buffer',
    pricing: 'Free / Paid Buffer plans',
  },
  {
    name: 'Lately.ai',
    url: 'https://lately.ai',
    category: 'social',
    tagline: 'AI social content generator that learns brand voice from long-form content.',
    description:
      'Lately turns blog posts, podcasts, and webinars into dozens of on-brand social posts — claimed brand-voice training based on prior content.',
    maker: 'Lately',
    pricing: 'Paid',
  },
  {
    name: 'Tweet Hunter',
    url: 'https://tweethunter.io',
    category: 'social',
    tagline: 'AI-powered Twitter/X growth tool with content generation and scheduling.',
    description:
      "Tweet Hunter is an AI Twitter/X tool — content generation, scheduling, automation, and a database of high-performing tweets to study.",
    maker: 'Tweet Hunter',
    pricing: 'Paid',
  },

  // ===== SEO/GEO (additional famous tools) =====
  {
    name: 'Surfer SEO',
    url: 'https://surferseo.com',
    category: 'seo-geo',
    tagline: 'AI content optimization for SERP-aligned, on-page-perfect articles.',
    description:
      'Surfer SEO scores drafts against the top-ranking pages for a target query and tells you exactly what to add, remove, and structure differently. Standard SEO content tool.',
    maker: 'Surfer',
    pricing: 'From $79/mo',
  },
  {
    name: 'Frase',
    url: 'https://www.frase.io',
    category: 'seo-geo',
    tagline: 'AI SEO content brief generator and optimization tool.',
    description:
      "Frase researches a query, generates a content brief from the top-ranking pages, and grades drafts against SERP requirements — a popular SEO content workflow tool.",
    maker: 'Frase',
    pricing: 'From $15/mo',
  },
  {
    name: 'ClearScope',
    url: 'https://www.clearscope.io',
    category: 'seo-geo',
    tagline: 'Premium content optimization platform for SERP-aligned AI writing.',
    description:
      "ClearScope is the premium SEO content optimization tool — known for clean recommendations, accurate scoring, and integrations with Google Docs and WordPress.",
    maker: 'ClearScope',
    pricing: 'From $189/mo',
  },
  {
    name: 'AlsoAsked',
    url: 'https://alsoasked.com',
    category: 'seo-geo',
    tagline: 'People Also Ask research tool for SEO and AI search content.',
    description:
      'AlsoAsked maps the People Also Ask network for any query — essential for content built to win AI Overviews and ChatGPT search citations.',
    maker: 'AlsoAsked',
    pricing: 'From $15/mo',
  },
  {
    name: 'Otterly.ai',
    url: 'https://otterly.ai',
    category: 'seo-geo',
    tagline: 'AI brand visibility tracker for ChatGPT, Perplexity, and Google AI Overviews.',
    description:
      "Otterly.ai monitors how your brand appears in AI search engines — citation tracking, prompt monitoring, and competitive AI visibility benchmarks. Pure-play GEO tool.",
    maker: 'Otterly.ai',
    pricing: 'From $29/mo',
  },
  {
    name: 'Profound',
    url: 'https://www.tryprofound.com',
    category: 'seo-geo',
    tagline: 'Enterprise AI search visibility platform — track and influence brand mentions in LLMs.',
    description:
      'Profound is the enterprise GEO platform — measures how brands surface in ChatGPT, Perplexity, Gemini, and other LLMs, and recommends content moves to increase citation share.',
    maker: 'Profound',
    pricing: 'Enterprise',
  },
  {
    name: 'Semrush ContentShake',
    url: 'https://www.semrush.com/contentshake',
    category: 'seo-geo',
    tagline: 'AI content writer with built-in SEO scoring from Semrush.',
    description:
      'ContentShake AI is Semrush\'s AI writer — produces SEO-optimized articles with topic research, brand voice, and content scoring tied to Semrush keyword data.',
    maker: 'Semrush',
    pricing: 'From $60/mo',
  },

  // ===== BRAND (additional famous tools) =====
  {
    name: 'Canva Magic Studio',
    url: 'https://www.canva.com/magic-studio',
    category: 'brand',
    tagline: "Canva's AI design suite — Magic Write, Magic Design, brand kit enforcement.",
    description:
      "Canva Magic Studio bundles AI image generation, copywriting, design templating, and brand kit enforcement — the most accessible AI design platform for non-designers and brand teams.",
    maker: 'Canva',
    pricing: 'Free / Pro $15/mo',
  },
  {
    name: 'Adobe Firefly',
    url: 'https://www.adobe.com/products/firefly.html',
    category: 'brand',
    tagline: "Adobe's commercially-safe generative AI for images, video, and design.",
    description:
      "Firefly is Adobe's generative AI — trained on licensed content, designed for commercial use, and integrated across Photoshop, Illustrator, Premiere, and Express.",
    maker: 'Adobe',
    pricing: 'Included with Creative Cloud / Standalone',
  },
  {
    name: 'Looka',
    url: 'https://looka.com',
    category: 'brand',
    tagline: 'AI logo and brand identity generator for SMBs and startups.',
    description:
      'Looka generates logos, brand kits, and full visual identity systems from a few prompts — used by SMBs, startups, and side-project founders who need a fast brand without a designer.',
    maker: 'Looka',
    pricing: 'From $20 one-time',
  },
  {
    name: 'Beautiful.ai',
    url: 'https://www.beautiful.ai',
    category: 'brand',
    tagline: 'AI presentation builder with brand-locked templates and auto-formatting.',
    description:
      'Beautiful.ai produces on-brand presentation decks fast — Smart Slides auto-format, brand kits enforce visual identity, and AI-assisted content generation handles drafting.',
    maker: 'Beautiful.ai',
    pricing: 'From $12/mo',
  },

  // ===== MARTECH (additional famous tools) =====
  {
    name: 'HubSpot Breeze',
    url: 'https://www.hubspot.com/products/breeze',
    category: 'martech',
    tagline: "HubSpot's embedded AI agents for marketing, sales, and service automation.",
    description:
      'Breeze is HubSpot\'s suite of AI agents for content drafting, prospecting, customer service, and CRM data quality — embedded across the HubSpot platform.',
    maker: 'HubSpot',
    pricing: 'Included with HubSpot plans',
  },
  {
    name: 'Salesforce Einstein',
    url: 'https://www.salesforce.com/artificial-intelligence',
    category: 'martech',
    tagline: 'Salesforce-native AI for marketing, sales, service, and customer 360.',
    description:
      'Einstein is the AI layer across Salesforce Marketing Cloud, Sales Cloud, and Service Cloud — predictive scoring, personalization, content generation, and Agentforce autonomous agents.',
    maker: 'Salesforce',
    pricing: 'Add-on / Enterprise',
  },
  {
    name: 'Klaviyo AI',
    url: 'https://www.klaviyo.com/ai',
    category: 'martech',
    tagline: 'Predictive AI for ecommerce email and SMS — segments, send time, content.',
    description:
      'Klaviyo AI handles predictive segmentation, send-time optimization, subject line testing, and AI-generated email content for ecommerce marketing teams.',
    maker: 'Klaviyo',
    pricing: 'Included with Klaviyo plans',
  },
];

async function main() {
  const raw = await readFile(CANDIDATES, 'utf8');
  const scraped = JSON.parse(raw);

  // Mark scrape entries approved when they match our keep-list
  let approvedFromScrape = 0;
  for (const entry of scraped) {
    if (APPROVED_FROM_SCRAPE.has(entry.name.toLowerCase())) {
      entry.approved = true;
      approvedFromScrape++;
    }
  }

  // Append manual entries (all approved)
  const slugify = (s) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '');

  for (const m of MANUAL) {
    scraped.push({
      approved: true,
      slug: slugify(m.name),
      name: m.name,
      url: m.url,
      tagline: m.tagline,
      description: m.description,
      category: m.category,
      maker: m.maker,
      pricing: m.pricing,
      source: 'Manual entry',
      sourceUrl: '',
    });
  }

  await writeFile(CANDIDATES, JSON.stringify(scraped, null, 2), 'utf8');

  const totalApproved = scraped.filter((e) => e.approved).length;
  const byCat = scraped
    .filter((e) => e.approved)
    .reduce((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + 1;
      return acc;
    }, {});

  console.log(`Approved ${approvedFromScrape} from scrape + ${MANUAL.length} manual = ${totalApproved} total`);
  console.log('');
  console.log('Approved by category:');
  for (const [cat, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(10)} ${n}`);
  }
  console.log('');
  console.log('Now run: node scripts/import-approved.mjs');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
