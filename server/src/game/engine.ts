/**
 * AUTHORITATIVE GAME ENGINE (Isa's Domain)
 * Implements Euclidean distance, concentric bullseye scoring, and psychic balance.
 * Reference: docs/02 - Game Mechanics/Scoring Formula & Balance.md
 */

import {
  Point2D,
  ScoreTier,
  Player,
  PlayerGuess,
  RoundState,
  AxisPair,
  RevealPayload,
  RevealGuess,
} from '../../../shared/types.js';

export class GameEngine {
  /**
   * 2D Euclidean Distance between secret target and player guess:
   * d = sqrt((x_g - x_s)^2 + (y_g - y_s)^2)
   * With coordinates in [-1.0, 1.0], max possible diagonal distance is sqrt(8) ≈ 2.828
   */
  public static calculateDistance(target: Point2D, guess: Point2D): number {
    const dx = guess.x - target.x;
    const dy = guess.y - target.y;
    return Math.round(Math.sqrt(dx * dx + dy * dy) * 1000) / 1000;
  }

  /**
   * Concentric Target Ring Scoring (Isa's Formula):
   * Bullseye: d <= 0.15 -> 1000 pts
   * Close:    d <= 0.35 -> 750 pts
   * Warm:     d <= 0.60 -> 500 pts
   * Edge:     d <= 0.90 -> 250 pts
   * Miss:     d >  0.90 -> 0 pts
   */
  public static calculatePlayerScore(
    target: Point2D,
    guess: Point2D
  ): { distance: number; points: number; tier: ScoreTier } {
    const distance = this.calculateDistance(target, guess);

    if (distance <= 0.15) {
      return { distance, points: 1000, tier: 'Bullseye' };
    }
    if (distance <= 0.35) {
      return { distance, points: 750, tier: 'Close' };
    }
    if (distance <= 0.60) {
      return { distance, points: 500, tier: 'Warm' };
    }
    if (distance <= 0.90) {
      return { distance, points: 250, tier: 'Edge' };
    }
    return { distance, points: 0, tier: 'Miss' };
  }

  /**
   * Generates a random coordinate clamped inside [-0.85, +0.85]
   * so target never overlaps outer axis labels or boundary edges.
   */
  public static generateRandomTarget(bound: number = 0.85): Point2D {
    const randomCoord = () => {
      const val = (Math.random() * 2 - 1) * bound;
      return Math.round(val * 1000) / 1000;
    };
    return {
      x: randomCoord(),
      y: randomCoord(),
    };
  }

  /**
   * Initializes a new round with a fresh target and spectrum topic.
   */
  public static createRound(
    roundNumber: number,
    totalRounds: number,
    psychic: Player,
    topic: string,
    axisX: AxisPair,
    axisY: AxisPair,
    guessTimeLimit: number = 75
  ): RoundState {
    return {
      roundNumber,
      totalRounds,
      psychicId: psychic.id,
      psychicName: psychic.name,
      content: {
        topic,
        axisX,
        axisY,
      },
      secretTarget: this.generateRandomTarget(0.85),
      clue: undefined,
      guesses: {},
      timeRemaining: guessTimeLimit,
    };
  }

  /**
   * Resolves round, scores all guessers, awards psychic points and resonance bonus,
   * and builds the reveal payload.
   */
  public static resolveRound(
    round: RoundState,
    players: Player[]
  ): RevealPayload {
    if (!round.secretTarget) {
      throw new Error('Cannot resolve round without secret target.');
    }

    const revealGuesses: RevealGuess[] = [];
    const guesserPoints: number[] = [];
    let bullseyeCount = 0;

    for (const player of players) {
      if (player.id === round.psychicId) continue;

      const guess = round.guesses[player.id];
      const coords = guess ? guess.coords : { x: 0, y: 0 }; // Default center if didn't lock
      const evaluation = this.calculatePlayerScore(round.secretTarget, coords);

      guesserPoints.push(evaluation.points);
      if (evaluation.tier === 'Bullseye') {
        bullseyeCount++;
      }

      // Add score to player
      player.score += evaluation.points;

      revealGuesses.push({
        playerId: player.id,
        playerName: player.name,
        avatarColor: player.avatarColor,
        coords,
        distance: evaluation.distance,
        scoreAwarded: evaluation.points,
        tier: evaluation.tier,
      });
    }

    // Psychic Score = Average of guesser points + 250 bonus if >= 2 bullseyes
    const avgScore =
      guesserPoints.length > 0
        ? Math.round(guesserPoints.reduce((a, b) => a + b, 0) / guesserPoints.length)
        : 0;
    const resonanceBonus = bullseyeCount >= 2 ? 250 : 0;
    const psychicTotalAwarded = avgScore + resonanceBonus;

    const psychic = players.find((p) => p.id === round.psychicId);
    if (psychic) {
      psychic.score += psychicTotalAwarded;
    }

    const updatedLeaderboard = [...players]
      .sort((a, b) => b.score - a.score)
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        totalScore: p.score,
      }));

    return {
      secretTarget: round.secretTarget,
      clue: round.clue || 'No clue provided',
      guesses: revealGuesses,
      psychicId: round.psychicId,
      psychicScoreAwarded: psychicTotalAwarded,
      updatedLeaderboard,
    };
  }
}
