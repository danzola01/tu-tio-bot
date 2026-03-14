import type { DbClient } from "../infra/db.js";

export interface AddMatchPlayerInput {
  userId: string;
  role?: string | null;
  hero?: string | null;
}

export interface AddMatchInput {
  guildId: string;
  reportedByUserId: string;
  mode: string;
  map: string;
  result: string;
  players: AddMatchPlayerInput[];
}

export class MatchService {
  constructor(private db: DbClient) {}

  async addMatch(input: AddMatchInput) {
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
            role: p.role,
            hero: p.hero
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
