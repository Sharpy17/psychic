/**
 * DATABASE ACCESS LAYER (Arthur's Domain)
 * Connects to PostgreSQL via Prisma OR provides default fallback cards/topics.
 */

import { AxisPair, Topic } from '../../../shared/types.js';

// Starter seed pairs for the 2D plane
export const DEFAULT_AXIS_PAIRS: AxisPair[] = [
  { minLabel: 'Unfunny', maxLabel: 'Hilarious' },
  { minLabel: 'Ugly', maxLabel: 'Cute / Beautiful' },
  { minLabel: 'Underrated', maxLabel: 'Overrated' },
  { minLabel: 'Harmless', maxLabel: 'Extremely Lethal' },
  { minLabel: 'Easy to beat in a fight', maxLabel: 'Impossible to beat in a fight' },
  { minLabel: 'Pure Evil', maxLabel: 'Pure Good' },
  { minLabel: 'Useless in Zombie Apocalypse', maxLabel: 'Lifesaver in Zombie Apocalypse' },
  { minLabel: 'Cringe', maxLabel: 'Chad / Based' },
  { minLabel: 'Horrible Smelling', maxLabel: 'Smells Heavenly' },
  { minLabel: 'Cheap / Budget', maxLabel: 'Luxury / High-End' },
];

export const DEFAULT_TOPICS: Topic[] = [
  { name: 'Video Game Characters', description: 'Characters from any video game (e.g. Mario, Liu Kang, Kratos)' },
  { name: 'Fictional Characters', description: 'Characters from movies, TV shows, anime, or books' },
  { name: 'Foods & Drinks', description: 'Dishes, snacks, fruits, or beverages' },
  { name: 'Real Life Animals & Insects', description: 'Creatures of nature' },
  { name: 'Everyday Household Objects', description: 'Items you can find in an apartment' },
  { name: 'Celebrities & Public Figures', description: 'Famous actors, musicians, or historical figures' },
];

export class DatabaseService {
  /**
   * Arthur can wire this to:
   * return await prisma.topic.findMany(...)
   */
  public static async getRandomTopic(): Promise<Topic> {
    const index = Math.floor(Math.random() * DEFAULT_TOPICS.length);
    return DEFAULT_TOPICS[index];
  }

  /**
   * Arthur can wire this to:
   * return await prisma.axisPair.findMany(...)
   */
  public static async getRandomAxes(): Promise<{ xAxis: AxisPair; yAxis: AxisPair }> {
    // Pick two distinct pairs
    const shuffled = [...DEFAULT_AXIS_PAIRS].sort(() => 0.5 - Math.random());
    return {
      xAxis: shuffled[0],
      yAxis: shuffled[1],
    };
  }

  /**
   * Arthur can save game results to PostgreSQL
   */
  public static async saveMatchHistory(matchData: any): Promise<void> {
    console.log('[DatabaseService] Saving match record:', matchData);
    // TODO (Arthur): prisma.gameMatch.create({ data: ... })
  }
}
