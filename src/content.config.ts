import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const agents = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/agents' }),
  schema: z.object({
    name: z.string(),
    category: z.enum([
      'comms',
      'content',
      'social',
      'seo-geo',
      'martech',
      'brand',
      'media',
    ]),
    tagline: z.string(),
    description: z.string(),
    useCases: z.array(z.string()).optional(),
    inputs: z.array(z.string()).optional(),
    output: z.string().optional(),
    pricing: z.string().default('Custom'),
    maker: z.string().default('Sarah Evans / Zen Media'),
    ctaUrl: z.string().default('https://asksarah.ai'),
    ctaText: z.string().default('Get this for your brand'),
    featured: z.boolean().default(false),
    rating: z.number().min(0).max(5).optional(),
    tier: z.enum(['curated', 'community']).default('curated'),
    status: z.enum(['live', 'pending']).default('live'),
    source: z.string().optional(),
    sourceUrl: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  }),
});

const categories = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/categories' }),
  schema: z.object({
    name: z.string(),
    tagline: z.string(),
    description: z.string(),
    order: z.number(),
    icon: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  }),
});

export const collections = { agents, categories };
