import { Events, GatewayIntentBits, type VoiceState } from "discord.js";
import type { GameModule } from "../../bot/types.js";
import type { DbClient } from "../../infra/db.js";
import { createDeadlockCommand } from "./commands.js";
import { DeadlockMatches } from "./matches.js";
import { ObjectiveSettings } from "./settings.js";
import { BundledSounds } from "./sounds.js";
import type { SoundLibrary, VoiceTransport } from "./types.js";
import { DiscordVoiceTransport } from "./voice.js";

export interface DeadlockOptions {
  ownerId?: string;
  sounds?: SoundLibrary;
  voice?: VoiceTransport;
}

export function createDeadlockModule(db: DbClient, options: DeadlockOptions = {}): GameModule {
  const settings = new ObjectiveSettings(db, options.sounds ?? new BundledSounds());
  const matches = new DeadlockMatches(settings, options.voice ?? new DiscordVoiceTransport());
  let detach = () => {};
  return {
    id: "deadlock", intents: [GatewayIntentBits.GuildVoiceStates], commands: [createDeadlockCommand(settings, matches, options.ownerId)],
    attach(client) {
      detach();
      const onVoiceState = (before: VoiceState, after: VoiceState) => {
        const state = matches.status(after.guild.id);
        if (!state) return;
        if (after.id === client.user?.id) matches.observeBotChannel(after.guild.id, after.channelId);
        if (before.channelId !== state.channelId && after.channelId !== state.channelId) return;
        const channel = after.guild.channels.cache.get(state.channelId);
        if (!channel?.isVoiceBased() || ![...channel.members.values()].some((member) => !member.user.bot)) matches.stop(after.guild.id);
      };
      client.on(Events.VoiceStateUpdate, onVoiceState);
      detach = () => { client.off(Events.VoiceStateUpdate, onVoiceState); };
    },
    dispose() { detach(); matches.dispose(); },
  };
}
