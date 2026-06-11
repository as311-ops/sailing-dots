// challenge-descriptions.ts -- Description of the regatta challenge

export interface ChallengeInfo {
  title: string;
  brief: string;
  flavor: string;
}

export const CHALLENGE_INFO: Record<number, ChallengeInfo> = {
  0: {
    title: "Regatta",
    brief: "Be the first to reach the target quadrant — against the wind if you must.",
    flavor: "A green target zone marks one quadrant of the sea. Every boat wants to get there first — but sailboats can't sail straight into the wind. When the target lies upwind, only those who learn to tack in zigzags will ever arrive. The wind shifts over the generations: navigators who steer by the wind survive, compass-memorizers capsize.",
  },
};
