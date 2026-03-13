import type { DbClient } from "../infra/db.js";
import { Result } from "./mapService.js";

export interface GetStatsInput {
  guildId: string;
  mode?: string | null;
  map?: string | null;
}

export interface StatsResult {
  wins: number;
  losses: number;
  total: number;
  winRate: number;
}

export function calculateWinRate(wins: number, losses: number): number {
  const total = wins + losses;
  if (total === 0) return 0;
  return (wins / total) * 100;
}

export class StatsService {
  constructor(private db: DbClient) {}

  async getStats(input: GetStatsInput): Promise<StatsResult> {
    const where: any = {
      guildId: input.guildId,
      deletedAt: null,
    };

    if (input.mode) where.mode = input.mode;
    if (input.map) where.map = input.map;

    const results = await this.db.match.groupBy({
      by: ["result"],
      where,
      _count: {
        result: true,
      },
    });

    let wins = 0;
    let losses = 0;

    for (const group of results) {
      if (group.result === Result.WIN) wins = group._count.result;
      if (group.result === Result.LOSS) losses = group._count.result;
    }

    const total = wins + losses;
    const winRate = calculateWinRate(wins, losses);

    return {
      wins,
      losses,
      total,
      winRate,
    };
  }
}
