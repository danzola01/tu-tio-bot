import type { DbClient } from "../infra/db.js";

export interface AddMatchInput {
  guildId: string;
  reportedByUserId: string;
  mode: string;
  map: string;
  result: string;
  playerIds: string[];
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
        groupSize: input.playerIds.length,
        players: {
          create: input.playerIds.map(id => ({ userId: id }))
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
