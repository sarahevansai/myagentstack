#!/usr/bin/env node
/**
 * scrape-candidates.mjs
 *
 * Fetches raw markdown from curated GitHub "awesome list" repos, parses
 * entries (name, URL, description), scores them against MyAgentStack's
 * 7 categories, and outputs scripts/candidates.json for review.
 *
 * Usage:
 *   node scripts/scrape-candidates.mjs
 *
 * Output: scripts/candidates.json (array of candidate objects)
 *
 * Sources can be edited inline below. Uses raw.githubusercontent.com so no
 * GitHub API token is required — but rate-limited at the IP level.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, 'candidates.json');

// Curated source list — awesome lists with strong marketing/AI overlap.
// Each entry: raw markdown URL, friendly source name.
const SOURCES = [
  {
    name: 'awesome-ai-agents',
    url: 'https://raw.githubusercontent.com/e2b-dev/awesome-ai-agents/main/README.md',
  },
  {
    name: 'awesome-generative-ai',
    url: 'https://raw.githubusercontent.com/steven2358/awesome-generative-ai/main/README.md',
  },
  {
    name: 'awesome-ai-marketing',
    url: 'https://raw.githubusercontent.com/marketingtoolslist/awesome-marketing-tools/main/README.md',
  },
  {
    name: 'awesome-llm-apps',
    url: 'https://raw.githubusercontent.com/Shubhamsaboo/awesome-llm-apps/main/README.md',
  },
  {
    name: 'awesome-ai-tools',
    url: 'https://raw.githubusercontent.com/mahseema/awesome-ai-tools/main/README.md',
  },
];

// Heuristic category mapping — keywords in name+description map to a category.
// First match wins. Order matters (most specific first).
const CATEGORY_RULES = [
  {
    cat: 'comms',
    rx: /\b(press release|pr |public relations|media relations|comms|crisis|spokesperson|pitch journalists|media pitch)\b/i,
  },
  {
    cat: 'social',
    rx: /\b(linkedin|twitter|x post|tiktok|instagram|social media|social post|short-form|reels|threads)\b/i,
  },
  {
    cat: 'seo-geo',
    rx: /\b(seo|geo|search engine|keyword|backlink|on-page|schema|sitemap|hreflang|aeo|ai overview|generative engine)\b/i,
  },
  {
    cat: 'media',
    rx: /\b(distribution|wire|globenewswire|prnewswire|syndication|publisher|placement|broadcast|podcast distribution)\b/i,
  },
  {
    cat: 'martech',
    rx: /\b(crm|hubspot|salesforce|klaviyo|automation|attribution|analytics|funnel|pipeline|lead|integration|zapier|workflow)\b/i,
  },
  {
    cat: 'brand',
    rx: /\b(logo|brand|design|figma|canva|illustrator|visual identity|asset|presentation|deck|template)\b/i,
  },
  {
    cat: 'content',
    rx: /\b(content|article|blog|copywriting|writing|editorial|long-form|essay|newsletter|ghostwrit|email writer|copy generator)\b/i,
  },
];

// Hard-exclude: irrelevant or noisy categories.
const EXCLUDE_RX =
  /\b(image generator|stable diffusion|midjourney|video generator|voice clone|music generator|chatbot framework|coding assistant|developer tool|api wrapper|terminal|cli for|3d|game|avatar|deepfake|anime|nsfw)\b/i;

// Markdown link pattern: [Name](url) followed by separator and description.
// We tolerate lots of awesome-list variations: bullet, table cell, etc.
const LINK_LINE_RX =
  /^\s*[-*]\s*\[([^\]]+)\]\(([^)]+)\)\s*[—–\-:•|]?\s*(.*)$/m;

async function fetchMarkdown(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

function categorize(text) {
  for (const { cat, rx } of CATEGORY_RULES) {
    if (rx.test(text)) return cat;
  }
  return null;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
    .slice(0, 60);
}

function parseAwesomeList(md, source) {
  const lines = md.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const m = line.match(LINK_LINE_RX);
    if (!m) continue;
    const [, rawName, rawUrl, rawDesc] = m;
    const name = rawName.trim();
    const url = rawUrl.trim().split(' ')[0];
    const desc = rawDesc.replace(/^[—–\-:•|\s]+/, '').trim();

    // Skip section headers, anchor links, table-of-contents entries
    if (!url.startsWith('http')) continue;
    if (name.length < 3 || name.length > 60) continue;
    if (!desc || desc.length < 15) continue;

    const haystack = `${name} ${desc}`;
    if (EXCLUDE_RX.test(haystack)) continue;
    const cat = categorize(haystack);
    if (!cat) continue;

    out.push({
      approved: false, // flip to true to include in import pass
      slug: slugify(name),
      name,
      url,
      tagline: desc.length > 140 ? desc.slice(0, 137).trimEnd() + '...' : desc,
      description: desc,
      category: cat,
      source,
      sourceUrl: SOURCES.find((s) => s.name === source)?.url ?? '',
    });
  }
  return out;
}

function dedupe(items) {
  const seen = new Map();
  for (const item of items) {
    const key = item.url.toLowerCase().replace(/\/$/, '');
    if (!seen.has(key)) {
      seen.set(key, item);
    } else {
      // Prefer entry with longer description
      const existing = seen.get(key);
      if (item.description.length > existing.description.length) {
        seen.set(key, item);
      }
    }
  }
  return [...seen.values()];
}

async function main() {
  console.log(`Scraping ${SOURCES.length} awesome lists...`);
  const all = [];
  for (const source of SOURCES) {
    try {
      console.log(`  → ${source.name}`);
      const md = await fetchMarkdown(source.url);
      const items = parseAwesomeList(md, source.name);
      console.log(`    ${items.length} candidates`);
      all.push(...items);
    } catch (err) {
      console.warn(`  ! Failed ${source.name}: ${err.message}`);
    }
  }

  const deduped = dedupe(all);
  const byCategory = deduped.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(deduped, null, 2), 'utf8');

  console.log('');
  console.log(`Wrote ${deduped.length} unique candidates to ${OUT_PATH}`);
  console.log('By category:');
  for (const [cat, n] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(10)} ${n}`);
  }
  console.log('');
  console.log('Next step: review candidates.json, set approved:true on entries to keep,');
  console.log('then run: node scripts/import-approved.mjs');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
