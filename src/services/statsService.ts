import type { DbClient } from "../infra/db.js";
import { Result, GameMode } from "./mapService.js";
import type { Prisma } from "@prisma/client";

export interface GetStatsInput {
  guildId: string;
  mode?: GameMode | undefined;
  map?: string | undefined;
  userId?: string | undefined;
  role?: string | undefined;
  hero?: string | undefined;
}

export interface StatsResult {
  wins: number;
  losses: number;
  total: number;
  winRate: number;
}

export interface MapStat {
  map: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
}

export interface TeammateStat {
  userId: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
}

export interface LeaderboardEntry {
  userId: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
}

export interface TeamBreakdownEntry {
  userIds: string[];
  wins: number;
  losses: number;
  total: number;
  winRate: number;
}

export interface UserStreak {
  type: Result;
  count: number;
}

export function calculateWinRate(wins: number, losses: number): number {
  const total = wins + losses;
  if (total === 0) return 0;
  return (wins / total) * 100;
}

export class StatsService {
  constructor(private db: DbClient) {}

  private getWhereClause(input: GetStatsInput): Prisma.MatchWhereInput {
    const where: Prisma.MatchWhereInput = {
      guildId: input.guildId,
      deletedAt: null,
    };

    if (input.mode) where.mode = input.mode;
    if (input.map) where.map = input.map;

    const playerFilters: Prisma.MatchWhereInput[] = [];
    if (input.userId || input.role || input.hero) {
      const playerCond: Prisma.MatchPlayerWhereInput = {};
      if (input.userId) playerCond.userId = input.userId;
      if (input.role) playerCond.role = input.role;
      if (input.hero) playerCond.hero = input.hero;
      playerFilters.push({ players: { some: playerCond } });
    }

    if (playerFilters.length > 0) {
      where.AND = playerFilters;
    }
    return where;
  }

  async getStats(input: GetStatsInput): Promise<StatsResult> {
    const where = this.getWhereClause(input);

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

  async getMatches(input: GetStatsInput) {
    const where = this.getWhereClause(input);
    return await this.db.match.findMany({
      where,
      orderBy: { playedAt: 'asc' },
      include: { players: true }
    });
  }

  async getSessionMatches(guildId: string, userId: string, hours: number = 12) {
    const sessionStartTime = new Date();
    sessionStartTime.setHours(sessionStartTime.getHours() - hours);

    return await this.db.match.findMany({
      where: {
        guildId,
        deletedAt: null,
        playedAt: { gte: sessionStartTime },
        players: { some: { userId } }
      },
      orderBy: { playedAt: 'desc' }
    });
  }

  async getTeamStats(guildId: string, playerIds: string[]): Promise<StatsResult> {
    const results = await this.db.match.groupBy({
      where: {
        guildId,
        deletedAt: null,
        groupSize: playerIds.length,
        AND: playerIds.map(userId => ({
          players: {
            some: { userId }
          }
        }))
      },
      by: ["result"],
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

    return { wins, losses, total, winRate };
  }

  async getMapStats(guildId: string, userId: string): Promise<MapStat[]> {
    const matches = await this.db.match.findMany({
      where: {
        guildId,
        deletedAt: null,
        players: { some: { userId } }
      },
      select: {
        map: true,
        result: true,
      }
    });

    const mapMap = new Map<string, { wins: number, losses: number }>();
    for (const m of matches) {
      const stats = mapMap.get(m.map) || { wins: 0, losses: 0 };
      if (m.result === Result.WIN) stats.wins++;
      else if (m.result === Result.LOSS) stats.losses++;
      mapMap.set(m.map, stats);
    }

    return Array.from(mapMap.entries()).map(([map, s]) => ({
      map,
      wins: s.wins,
      losses: s.losses,
      total: s.wins + s.losses,
      winRate: calculateWinRate(s.wins, s.losses)
    }));
  }

  async getTeammateStats(guildId: string, userId: string): Promise<TeammateStat[]> {
    const matches = await this.db.match.findMany({
      where: {
        guildId,
        deletedAt: null,
        players: { some: { userId } }
      },
      include: {
        players: true
      }
    });

    const teammateMap = new Map<string, { wins: number, losses: number }>();
    for (const m of matches) {
      for (const p of m.players) {
        if (p.userId === userId) continue;
        const stats = teammateMap.get(p.userId) || { wins: 0, losses: 0 };
        if (m.result === Result.WIN) stats.wins++;
        else if (m.result === Result.LOSS) stats.losses++;
        teammateMap.set(p.userId, stats);
      }
    }

    return Array.from(teammateMap.entries()).map(([id, s]) => ({
      userId: id,
      wins: s.wins,
      losses: s.losses,
      total: s.wins + s.losses,
      winRate: calculateWinRate(s.wins, s.losses)
    }));
  }

  async getLeaderboard(guildId: string, minMatches: number = 5): Promise<LeaderboardEntry[]> {
    const rows = await this.db.$queryRaw<Array<{
      userId: string;
      wins: bigint | number;
      losses: bigint | number;
      total: bigint | number;
    }>>`
      SELECT
        mp."userId" AS "userId",
        SUM(CASE WHEN m.result = ${Result.WIN} THEN 1 ELSE 0 END) AS "wins",
        SUM(CASE WHEN m.result = ${Result.LOSS} THEN 1 ELSE 0 END) AS "losses",
        COUNT(*) AS "total"
      FROM "MatchPlayer" mp
      JOIN "Match" m ON m.id = mp."matchId"
      WHERE
        m."guildId" = ${guildId}
        AND m."deletedAt" IS NULL
      GROUP BY mp."userId"
      HAVING COUNT(*) >= ${minMatches}
    `;

    return rows
      .map(row => {
        const wins = Number(row.wins);
        const losses = Number(row.losses);
        const total = Number(row.total);
        return {
          userId: row.userId,
          wins,
          losses,
          total,
          winRate: calculateWinRate(wins, losses)
        };
      })
      .sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.total - a.total;
      });
  }

  async getTeamBreakdown(guildId: string, filter: GetStatsInput): Promise<TeamBreakdownEntry[]> {
    const where = this.getWhereClause(filter);

    const matches = await this.db.match.findMany({
      where,
      include: { players: true }
    });

    const teamMap = new Map<string, { wins: number, losses: number, userIds: string[] }>();
    for (const m of matches) {
      const ids = m.players.map(p => p.userId).sort();
      const key = ids.join(",");
      const stats = teamMap.get(key) || { wins: 0, losses: 0, userIds: ids };
      if (m.result === Result.WIN) stats.wins++;
      else if (m.result === Result.LOSS) stats.losses++;
      teamMap.set(key, stats);
    }

    return Array.from(teamMap.values()).map(s => ({
      userIds: s.userIds,
      wins: s.wins,
      losses: s.losses,
      total: s.wins + s.losses,
      winRate: calculateWinRate(s.wins, s.losses)
    })).sort((a, b) => b.total - a.total);
  }

  async getUserStreak(guildId: string, userId: string): Promise<UserStreak | null> {
    const matches = await this.db.match.findMany({
      where: {
        guildId,
        deletedAt: null,
        players: { some: { userId } }
      },
      orderBy: { playedAt: 'desc' },
      select: { result: true },
      take: 50
    });

    if (matches.length === 0) return null;

    const streakType = matches[0]!.result as Result;
    let streakCount = 0;

    for (const m of matches) {
      if (m.result === streakType) {
        streakCount++;
      } else {
        break;
      }
    }

    return { type: streakType, count: streakCount };
  }
}
