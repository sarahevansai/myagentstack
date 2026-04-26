#!/usr/bin/env node
/**
 * import-approved.mjs
 *
 * Reads scripts/candidates.json, filters to approved:true entries,
 * and generates .md files in src/content/agents/ as community-tier agents.
 *
 * Usage:
 *   node scripts/import-approved.mjs            # writes status: live
 *   node scripts/import-approved.mjs --pending  # writes status: pending
 *
 * Skips entries whose slug already exists (won't overwrite curated agents).
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CANDIDATES = join(__dirname, 'candidates.json');
const AGENTS_DIR = join(ROOT, 'src', 'content', 'agents');

const STATUS = process.argv.includes('--pending') ? 'pending' : 'live';

function escapeYaml(str) {
  if (str == null) return '';
  // Quote if contains special yaml chars
  if (/[:#&*!|>'"%@`,\[\]{}]/.test(str) || /^[\s]*$/.test(str)) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return `"${str.replace(/"/g, '\\"')}"`;
}

function buildFrontmatter(entry) {
  const f = [];
  f.push('---');
  f.push(`name: ${escapeYaml(entry.name)}`);
  f.push(`category: "${entry.category}"`);
  f.push(`tagline: ${escapeYaml(entry.tagline)}`);
  f.push(`description: ${escapeYaml(entry.description)}`);
  if (entry.maker) f.push(`maker: ${escapeYaml(entry.maker)}`);
  f.push(`pricing: ${escapeYaml(entry.pricing ?? 'See site')}`);
  f.push(`ctaUrl: ${escapeYaml(entry.url)}`);
  f.push(`ctaText: "Visit agent"`);
  f.push(`tier: "community"`);
  f.push(`status: "${STATUS}"`);
  f.push(`featured: false`);
  if (entry.source) f.push(`source: ${escapeYaml(entry.source)}`);
  if (entry.sourceUrl) f.push(`sourceUrl: ${escapeYaml(entry.sourceUrl)}`);
  if (entry.keywords?.length) {
    f.push('keywords:');
    for (const k of entry.keywords) f.push(`  - ${escapeYaml(k)}`);
  }
  f.push('---');
  return f.join('\n');
}

function buildBody(entry) {
  return `\n## What it does\n\n${entry.description}\n\n## Indexed from\n\nListed via ${entry.source}. Visit [the agent](${entry.url}) for current capabilities and pricing.\n`;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const raw = await readFile(CANDIDATES, 'utf8');
  const all = JSON.parse(raw);
  const approved = all.filter((c) => c.approved);

  if (approved.length === 0) {
    console.log('No approved entries in candidates.json.');
    console.log('Set approved:true on entries you want to import, then re-run.');
    return;
  }

  console.log(`Importing ${approved.length} approved entries (status: ${STATUS})...`);
  await mkdir(AGENTS_DIR, { recursive: true });

  let written = 0;
  let skipped = 0;

  for (const entry of approved) {
    const slug = entry.slug || entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const filePath = join(AGENTS_DIR, `${slug}.md`);

    if (await exists(filePath)) {
      console.log(`  ! skip ${slug} (already exists)`);
      skipped++;
      continue;
    }

    const md = buildFrontmatter(entry) + buildBody(entry);
    await writeFile(filePath, md, 'utf8');
    console.log(`  ✓ ${slug} (${entry.category})`);
    written++;
  }

  console.log('');
  console.log(`Wrote ${written} files. Skipped ${skipped} existing.`);
  console.log(`Now run: npm run build`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
