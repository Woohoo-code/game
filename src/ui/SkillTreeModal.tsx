import { useMemo } from "react";
import {
  SKILL_DATA,
  SKILL_ORDER,
  SKILL_TREE,
  SKILL_TREE_POS,
  SKILL_BRANCH,
  pointsSpentInBranch,
  canLearnSkillNow,
  skillPointsPerLevel,
  type SkillBranchId
} from "../game/data";
import { ELEMENT_SYMBOL } from "../game/elements";
import { gameStore } from "../game/state";
import { FIGHTING_CLASS_LABELS, type FightingClass, type SkillKey } from "../game/types";
import { useGameStore } from "../game/useGameStore";

const CLASS_BLURB: Record<FightingClass, string> = {
  knight: "+2 Attack at creation. Earns 1 skill point per level.",
  wizard: "+15% skill spell damage. Earns 2 skill points per level.",
  thief: "+2 Speed at creation, +15% gold from wild battles. Earns 1 skill point per level."
};

const BRANCH_META: Record<
  SkillBranchId,
  { label: string; sub: string; color: string; line: string; glow: string }
> = {
  conditioning: {
    label: "Conditioning",
    sub: "Body · endurance",
    color: "#34d399",
    line: "rgba(52, 211, 153, 0.55)",
    glow: "rgba(52, 211, 153, 0.95)"
  },
  arcane: {
    label: "Arcane",
    sub: "Mobility · strike magic",
    color: "#fbbf24",
    line: "rgba(251, 191, 36, 0.55)",
    glow: "rgba(251, 191, 36, 0.95)"
  },
  survival: {
    label: "Survival",
    sub: "Grit · sustain",
    color: "#f97316",
    line: "rgba(249, 115, 22, 0.55)",
    glow: "rgba(249, 115, 22, 0.95)"
  }
};

function branchStrokeForSkill(skill: SkillKey): string {
  const b = SKILL_BRANCH[skill];
  if (b === "core") return BRANCH_META.arcane.line;
  return BRANCH_META[b].line;
}

function branchGlowForSkill(skill: SkillKey): string {
  const b = SKILL_BRANCH[skill];
  if (b === "core") return BRANCH_META.arcane.glow;
  return BRANCH_META[b].glow;
}

export function SkillTreeModal({ onClose }: { onClose: () => void }) {
  const snapshot = useGameStore();
  const p = snapshot.player;
  const learned = p.learnedSkills ?? ["spark"];
  const points = p.skillPoints ?? 0;
  const fc = p.fightingClass ?? "knight";

  const edges = useMemo(() => {
    const out: { from: SkillKey; to: SkillKey }[] = [];
    for (const s of SKILL_ORDER) {
      const par = SKILL_TREE[s].parent;
      if (par) out.push({ from: par, to: s });
    }
    return out;
  }, []);

  const pc = pointsSpentInBranch(learned, "conditioning");
  const pa = pointsSpentInBranch(learned, "arcane");
  const ps = pointsSpentInBranch(learned, "survival");

  return (
    <div className="skill-tree-backdrop" role="dialog" aria-modal="true" aria-labelledby="skill-tree-title">
      <div className="skill-tree-card skill-tree-card--wide">
        <header className="skill-tree-header">
          <div>
            <h2 id="skill-tree-title">Skills &amp; arcane tree</h2>
            <p className="skill-tree-sub">
              Class: <strong>{FIGHTING_CLASS_LABELS[fc]}</strong> — {CLASS_BLURB[fc]}
            </p>
            <p className="skill-tree-points">
              Unspent skill points: <strong>{points}</strong> (gain {skillPointsPerLevel(fc)} per level for this class)
            </p>
          </div>
          <button type="button" className="skill-tree-close" onClick={onClose} aria-label="Close skills">
            ×
          </button>
        </header>

        <div className="skill-tree-branch-ribbon" aria-hidden="true">
          {(Object.keys(BRANCH_META) as SkillBranchId[]).map((bid) => {
            const m = BRANCH_META[bid];
            const spent = bid === "conditioning" ? pc : bid === "arcane" ? pa : ps;
            return (
              <div key={bid} className="skill-tree-branch-pill" style={{ borderColor: m.color, color: m.color }}>
                <span className="skill-tree-branch-pill-label">{m.label}</span>
                <span className="skill-tree-branch-pill-sub">{m.sub}</span>
                <span className="skill-tree-branch-pill-pts">{spent} pts</span>
              </div>
            );
          })}
        </div>

        <div className="skill-tree-graph" aria-label="Skill tree">
          <svg className="skill-tree-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <filter id="skill-tree-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="0.6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {edges.map(({ from, to }) => {
              const a = SKILL_TREE_POS[from];
              const b = SKILL_TREE_POS[to];
              const ownedPath = learned.includes(from) && learned.includes(to);
              const reachable = learned.includes(from) && !learned.includes(to);
              const stroke = branchStrokeForSkill(to);
              const glow = branchGlowForSkill(to);
              const w = ownedPath ? 4 : reachable ? 3 : 2;
              const opacity = ownedPath ? 1 : reachable ? 0.85 : 0.28;
              return (
                <line
                  key={`${from}-${to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={ownedPath ? glow : stroke}
                  strokeWidth={w}
                  opacity={opacity}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  filter={ownedPath ? "url(#skill-tree-glow)" : undefined}
                />
              );
            })}
          </svg>

          {SKILL_ORDER.map((skill) => {
            const node = SKILL_TREE[skill];
            const data = SKILL_DATA[skill];
            const pos = SKILL_TREE_POS[skill];
            const status = canLearnSkillNow(learned, skill, points);
            const owned = status === "owned";
            const canBuy = status === "yes";
            const locked = status === "locked";
            const branch = SKILL_BRANCH[skill];
            const branchKey = branch === "core" ? "arcane" : branch;
            const accent = BRANCH_META[branchKey as SkillBranchId]?.color ?? "#94a3b8";

            const titleParts = [
              data.name,
              `${data.element.toUpperCase()} · +${data.powerBonus} power · CD ${data.cooldown}`,
              node.pointCost === 0 ? "Starter" : `${node.pointCost} pt to learn`
            ];
            const title = titleParts.join(" — ");

            return (
              <div
                key={skill}
                className={`skill-tree-node-dot${owned ? " skill-tree-node-dot--owned" : ""}${locked ? " skill-tree-node-dot--locked" : ""}${canBuy ? " skill-tree-node-dot--ready" : ""}`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                <button
                  type="button"
                  className="skill-tree-node-btn"
                  style={{
                    borderColor: owned ? accent : "rgba(148, 163, 184, 0.45)",
                    boxShadow: owned ? `0 0 14px ${accent}55` : canBuy ? `0 0 10px ${accent}33` : undefined
                  }}
                  disabled={skill === "spark" || owned || !canBuy}
                  title={title}
                  onClick={() => gameStore.learnSkill(skill)}
                >
                  <span className="skill-tree-node-icon" aria-hidden>
                    {ELEMENT_SYMBOL[data.element]}
                  </span>
                  {locked ? (
                    <span className="skill-tree-node-lock" aria-hidden>
                      🔒
                    </span>
                  ) : null}
                </button>
                <div className="skill-tree-node-cap" aria-hidden>
                  {node.pointCost === 0 ? "—" : `${node.pointCost}pt`}
                </div>
                <div className="skill-tree-node-hint">{data.name}</div>
              </div>
            );
          })}
        </div>

        <p className="skill-tree-footnote">
          Learn skills from the root outward along each branch. Spend points outside of combat — battle uses every skill you have learned.
        </p>
      </div>
    </div>
  );
}
