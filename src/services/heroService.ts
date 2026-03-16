export const Role = {
  TANK: "TANK",
  DAMAGE: "DAMAGE",
  SUPPORT: "SUPPORT",
} as const;

export type Role = keyof typeof Role;

export const HeroesByRole: Record<Role, string[]> = {
  TANK: [
    "D.Va",
    "Domina",
    "Doomfist",
    "Hazard",
    "Junker Queen",
    "Mauga",
    "Orisa",
    "Ramattra",
    "Reinhardt",
    "Roadhog",
    "Sigma",
    "Winston",
    "Wrecking Ball",
    "Zarya",
  ],
  DAMAGE: [
    "Anran",
    "Ashe",
    "Bastion",
    "Cassidy",
    "Echo",
    "Emre",
    "Genji",
    "Hanzo",
    "Junkrat",
    "Mei",
    "Pharah",
    "Reaper",
    "Sojourn",
    "Soldier: 76",
    "Sombra",
    "Symmetra",
    "Torbjörn",
    "Tracer",
    "Vendetta",
    "Venture",
    "Widowmaker",
  ],
  SUPPORT: [
    "Ana",
    "Baptiste",
    "Brigitte",
    "Illari",
    "Jetpack Cat",
    "Juno",
    "Kiriko",
    "Lifeweaver",
    "Lúcio",
    "Mercy",
    "Mizuki",
    "Moira",
    "Zenyatta",
    "Wuyang",
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
