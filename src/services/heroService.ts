export const Role = {
  TANK: "Tank",
  DAMAGE: "Damage",
  SUPPORT: "Support",
} as const;

export type Role = typeof Role[keyof typeof Role];

export const HeroesByRole: Record<Role, string[]> = {
  Tank: [
    "D.Va", "Doomfist", "Hazard", "Junker Queen", "Mauga", "Orisa",
    "Ramattra", "Reinhardt", "Roadhog", "Sigma", "Winston",
    "Wrecking Ball", "Zarya"
  ],
  Damage: [
    "Ashe", "Bastion", "Cassidy", "Echo", "Genji", "Hanzo",
    "Junkrat", "Mei", "Pharah", "Reaper", "Sojourn", "Soldier: 76",
    "Sombra", "Symmetra", "Torbjörn", "Tracer", "Venture", "Widowmaker"
  ],
  Support: [
    "Ana", "Baptiste", "Brigitte", "Illari", "Juno", "Kiriko",
    "Lifeweaver", "Lúcio", "Mercy", "Moira", "Zenyatta"
  ],
};

export const AllHeroes = Object.values(HeroesByRole).flat().sort();

export function getRoleForHero(heroName: string): Role | undefined {
  for (const [role, heroes] of Object.entries(HeroesByRole)) {
    if (heroes.includes(heroName)) {
      return role as Role;
    }
  }
  return undefined;
}
