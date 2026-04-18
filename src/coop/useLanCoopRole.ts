import { useSyncExternalStore } from "react";
import { getLanRole, subscribeLanCoop, type LanRole } from "./lanCoop";

export function useLanCoopRole(): LanRole {
  return useSyncExternalStore(subscribeLanCoop, getLanRole, getLanRole);
}
