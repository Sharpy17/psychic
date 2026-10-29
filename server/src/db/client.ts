/**
 * DATABASE ACCESS LAYER (Arthur's Domain)
 * Connects to PostgreSQL via Prisma OR provides default fallback cards/topics.
 * Seeded with full starter content deck from docs/07 - Content Bank/Starter Topics & Word Pairs.md
 */

import { AxisPair } from '../../../shared/types.js';

export const STARTER_TOPICS: string[] = [
  'Fictional Characters',
  'Celebrities & Public Figures',
  'Animals & Creatures',
  'Food & Dishes',
  'Jobs & Professions',
  'Superpowers & Magic Spells',
  'Everyday Household Objects',
  'Movies & TV Shows',
  'Video Games & Characters',
  'Musical Artists & Bands',
  'Historical Figures',
  'Places & Travel Destinations',
  'Hobbies & Activities',
  'School Subjects & Majors',
  'Brands & Companies',
];

export const STARTER_AXIS_PAIRS: AxisPair[] = [
  { id: 'ugly_handsome', negative: 'Ugly', positive: 'Handsome / Cute' },
  { id: 'boring_funny', negative: 'Boring', positive: 'Hilarious' },
  { id: 'evil_saintly', negative: 'Pure Evil', positive: 'Saintly & Pure' },
  { id: 'weak_powerful', negative: 'Completely Harmless', positive: 'Lethally Powerful' },
  { id: 'cheap_luxurious', negative: 'Dirt Cheap / Budget', positive: 'Ultra-Luxurious' },
  { id: 'soft_hard', negative: 'Soft & Squishy', positive: 'Rock Solid' },
  { id: 'horror_apocalypse', negative: 'Dies First in a Horror Movie', positive: 'Survives the Apocalypse' },
  { id: 'overrated_underrated', negative: 'Wildly Overrated', positive: 'Criminally Underrated' },
  { id: 'clean_chaotic', negative: 'Orderly & Neat', positive: 'Pure Chaos' },
  { id: 'smelly_fragrant', negative: 'Repulsive Odor', positive: 'Heavenly Scent' },
  { id: 'smart_dumb', negative: 'Smooth Brain (Dumb)', positive: 'Galaxy Brain (Genius)' },
  { id: 'casual_formal', negative: 'Sweatpants Vibe', positive: 'Black Tie / Formal' },
  { id: 'comfort_stress', negative: 'Deeply Stressful', positive: 'Pure Comfort / Cozy' },
  { id: 'useless_essential', negative: 'Totally Useless', positive: 'Desert Island Essential' },
  { id: 'cringe_based', negative: 'Unbearably Cringe', positive: 'Undeniably Cool / Based' },
  { id: 'loud_quiet', negative: 'Loud & Obnoxious', positive: 'Peaceful & Quiet' },
  { id: 'hot_cold', negative: 'Freezing Cold', positive: 'Boiling Hot' },
  { id: 'trash_treasure', negative: 'Worthless Trash', positive: 'Priceless Treasure' },
  { id: 'sweet_savory', negative: 'Deeply Bitter', positive: 'Delightfully Sweet' },
  { id: 'easy_impossible', negative: 'Easy to beat in a fight', positive: 'Impossible to beat in a fight' },
];

export class DatabaseService {
  public static async getRandomTopic(): Promise<string> {
    const index = Math.floor(Math.random() * STARTER_TOPICS.length);
    return STARTER_TOPICS[index];
  }

  public static async getRandomAxes(): Promise<{ xAxis: AxisPair; yAxis: AxisPair }> {
    const shuffled = [...STARTER_AXIS_PAIRS].sort(() => 0.5 - Math.random());
    return {
      xAxis: shuffled[0],
      yAxis: shuffled[1],
    };
  }

  public static async saveMatchHistory(matchData: any): Promise<void> {
    console.log('[DatabaseService] Saving match record:', matchData);
    // TODO: When Arthur deploys Neon/Supabase PostgreSQL, prisma.gameSession.create()
  }
}
