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
  CONTROL: ["Antarctic Peninsula", "Busan", "Ilios", "Lijiang Tower", "Nepal", "Oasis", "Samoa"],
  ESCORT: ["Circuit Royal", "Dorado", "Havana", "Junkertown", "Rialto", "Route 66", "Shambali Monastery", "Watchpoint: Gibraltar"],
  HYBRID: ["Blizzard World", "Eichenwalde", "Hollywood", "King's Row", "Midtown", "Numbani", "Paraíso"],
  PUSH: ["Colosseo", "Esperança", "New Queen Street", "Runasapi"],
  FLASHPOINT: ["New Junk City", "Suravasa"],
  CLASH: ["Hanaoka", "Throne of Anubis"],
};

export const AllMaps = Object.values(MapsByMode).flat();

export const Result = {
  WIN: "WIN",
  LOSS: "LOSS",
  DRAW: "DRAW",
} as const;

export type Result = keyof typeof Result;

export function isMapValidForMode(mode: GameMode, mapName: string): boolean {
  const maps = MapsByMode[mode];
  return maps ? maps.includes(mapName) : false;
}

export function getModeForMap(mapName: string): GameMode | undefined {
  for (const [mode, maps] of Object.entries(MapsByMode)) {
    if (maps.includes(mapName)) {
      return mode as GameMode;
    }
  }
  return undefined;
}
