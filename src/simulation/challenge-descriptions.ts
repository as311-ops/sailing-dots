// challenge-descriptions.ts -- Description of the regatta challenge

export interface ChallengeInfo {
  title: string;
  brief: string;
  flavor: string;
}

export const CHALLENGE_INFO: Record<number, ChallengeInfo> = {
  0: {
    title: "Regatta",
    brief: "From the start line, be first through the finish gate between the buoys.",
    flavor: "The fleet lines up behind the start line — everyone faces the same course. The finish is a gate between two orange buoys; sailing past outside the buoys counts for nothing. And sailboats can't sail straight into the wind: when the gate lies upwind, only those who learn to tack in zigzags will ever cross it. The wind shifts over the generations — navigators who steer by the wind survive, compass-memorizers capsize.",
  },
};
