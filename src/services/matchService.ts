import type { DbClient } from "../infra/db.js";
import { isMapValidForMode, GameMode, Result } from "./mapService.js";

export interface AddMatchPlayerInput {
  userId: string;
  role?: string | null;
  hero?: string | null;
}

export interface AddMatchInput {
  guildId: string;
  reportedByUserId: string;
  mode: GameMode;
  map: string;
  result: Result | string;
  players: AddMatchPlayerInput[];
}

export class MatchService {
  constructor(private db: DbClient) {}

  async addMatch(input: AddMatchInput) {
    if (!isMapValidForMode(input.mode, input.map)) {
      throw new Error(`Invalid map "${input.map}" for mode "${input.mode}"`);
    }

    return await this.db.match.create({
      data: {
        guildId: input.guildId,
        reportedByUserId: input.reportedByUserId,
        mode: input.mode,
        map: input.map,
        result: input.result,
        groupSize: input.players.length,
        players: {
          create: input.players.map(p => ({
            userId: p.userId,
            role: p.role ?? null,
            hero: p.hero ?? null
          }))
        }
      },
    });
  }

  async getLatestMatch(guildId: string, userId: string) {
    return await this.db.match.findFirst({
      where: {
        guildId,
        reportedByUserId: userId,
        deletedAt: null,
      },
      orderBy: {
        playedAt: "desc",
      },
    });
  }

  async softDeleteMatch(id: string) {
    return await this.db.match.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
