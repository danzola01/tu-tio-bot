import type { DbClient } from "../infra/db.js";
import { GameMode, Result } from "./mapService.js";

export interface AddMatchInput {
  guildId: string;
  reportedByUserId: string;
  mode: string;
  map: string;
  result: string;
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
      },
    });
  }
}
