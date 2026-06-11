import { CHALLENGE_INFO } from "../simulation/challenge-descriptions";

interface ChallengeInfoProps {
  /** Name des gewählten Rennens (Preset); ohne Angabe wird die generische Regatta gezeigt. */
  raceName?: string;
  raceDescription?: string;
}

export default function ChallengeInfo({ raceName, raceDescription }: ChallengeInfoProps) {
  const fallback = CHALLENGE_INFO[0];
  const title = raceName ?? fallback.title;
  const flavor = raceDescription ?? fallback.flavor;

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 px-3 py-2 space-y-1">
      <div className="flex items-center gap-2">
        <span className="bg-emerald-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0">
          RACE
        </span>
        <span className="text-xs font-medium text-zinc-200">{title}</span>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed">{flavor}</p>
    </div>
  );
}
