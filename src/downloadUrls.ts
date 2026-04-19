import { DESKTOP_EXE_VERSION } from "./version";

const REPO = "woohoo-code/game";

/** Direct HTTPS link to the portable Windows build attached to the matching GitHub release. */
export function portableExeAssetUrl(): string {
  const v = DESKTOP_EXE_VERSION;
  return `https://github.com/${REPO}/releases/download/v${v}/MonsterSlayer-${v}-Portable.exe`;
}

export const GITHUB_RELEASES_URL = `https://github.com/${REPO}/releases`;
