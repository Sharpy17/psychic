/**
 * GAME ENGINE & LOGIC (Isa's Domain)
 * Contains the pure math, scoring mechanics, and turn transitions.
 */

import { Coordinates, Player, PlayerGuess, RoundData, AxisPair, Topic } from '../../../shared/types.js';

export class GameEngine {
  /**
   * Euclidean Distance in 2D Cartesian Space:
   * d = sqrt((x2 - x1)^2 + (y2 - y1)^2)
   * Max possible distance in 200x200 box is sqrt(200^2 + 200^2) ≈ 282.8
   */
  public static calculateDistance(target: Coordinates, guess: Coordinates): number {
    const dx = target.x - guess.x;
    const dy = target.y - guess.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Scoring System:
   * Bullseye (< 15 units): 1000 points
   * Excellent (< 35 units): 750 points
   * Great     (< 60 units): 500 points
   * Close     (< 90 units): 250 points
   * Miss      (>= 90 units): 50 points (pity score)
   */
  public static calculateScore(distance: number): number {
    if (distance <= 15) return 1000;
    if (distance <= 35) return 750;
    if (distance <= 60) return 500;
    if (distance <= 90) return 250;
    return 50;
  }

  /**
   * Generates a random coordinate target on the plane.
   * Keeps within [-85, 85] by default so target isn't glued to the extreme edge.
   */
  public static generateRandomTarget(bound: number = 85): Coordinates {
    const randomCoord = () => Math.round((Math.random() * 2 - 1) * bound);
    return {
      x: randomCoord(),
      y: randomCoord(),
    };
  }

  /**
   * Initializes a new round
   */
  public static createRound(
    roundNumber: number,
    totalRounds: number,
    psychic: Player,
    topic: Topic,
    xAxis: AxisPair,
    yAxis: AxisPair
  ): RoundData {
    return {
      roundNumber,
      totalRounds,
      psychicId: psychic.id,
      psychicName: psychic.name,
      topic,
      xAxis,
      yAxis,
      targetPoint: this.generateRandomTarget(),
      clue: null,
      guesses: {},
      timeRemainingSec: 60,
    };
  }

  /**
   * Resolves all guesses and awards scores to both guessers and the psychic.
   * The psychic also earns bonus points based on how accurate the guessers were!
   */
  public static resolveRound(round: RoundData): {
    evaluatedGuesses: PlayerGuess[];
    psychicScoreBonus: number;
  } {
    if (!round.targetPoint) {
      throw new Error('Cannot resolve round without target coordinates.');
    }

    const evaluatedGuesses: PlayerGuess[] = [];
    let totalGuesserScore = 0;
    const guessCount = Object.keys(round.guesses).length;

    for (const [playerId, guess] of Object.entries(round.guesses)) {
      const distance = this.calculateDistance(round.targetPoint, guess.coordinates);
      const score = this.calculateScore(distance);

      totalGuesserScore += score;
      evaluatedGuesses.push({
        ...guess,
        distanceFromTarget: Math.round(distance * 10) / 10,
        scoreEarned: score,
      });
    }

    // Psychic gets the average of all guessers' scores (rewarding great clues!)
    const psychicScoreBonus = guessCount > 0 ? Math.round(totalGuesserScore / guessCount) : 0;

    return {
      evaluatedGuesses,
      psychicScoreBonus,
    };
  }
}
