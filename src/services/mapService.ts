export const GameMode = {
  CONTROL: "CONTROL",
  ESCORT: "ESCORT",
  HYBRID: "HYBRID",
  PUSH: "PUSH",
  FLASHPOINT: "FLASHPOINT",
  CLASH: "CLASH",
} as const;

export type GameMode = keyof typeof GameMode;

export const MapsByMode: Record<GameMode, string[]> = {
  CONTROL: ["Busan", "Ilios", "Lijiang Tower", "Nepal", "Oasis", "Antarctic Peninsula"],
  ESCORT: ["Dorado", "Havana", "Junkertown", "Circuit Royal", "Rialto", "Route 66", "Watchpoint: Gibraltar", "Shambali Monastery"],
  HYBRID: ["Blizzard World", "Eichenwalde", "Hollywood", "King's Row", "Midtown", "Numbani", "Paraíso"],
  PUSH: ["Colosseo", "Esperança", "New Queen Street", "Runasapi"],
  FLASHPOINT: ["New Junk City", "Suravasa"],
  CLASH: ["Hanaoka", "Throne of Anubis"],
};

export const AllMaps = Object.values(MapsByMode).flat();

export const Result = {
  WIN: "WIN",
  LOSS: "LOSS",
} as const;

export type Result = keyof typeof Result;

export function isMapValidForMode(mode: GameMode, mapName: string): boolean {
  const maps = MapsByMode[mode];
  return maps ? maps.includes(mapName) : false;
}
