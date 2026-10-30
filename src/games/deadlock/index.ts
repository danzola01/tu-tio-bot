import { Events, GatewayIntentBits, type Interaction, type Presence, type VoiceState } from "discord.js";
import type { GameModule } from "../../bot/types.js";
import type { DbClient } from "../../infra/db.js";
import { logger } from "../../infra/logger.js";
import { createDeadlockCommand } from "./commands.js";
import { DeadlockMatches } from "./matches.js";
import { playingDeadlock, START_BUTTON, StartPrompts } from "./prompt.js";
import { ObjectiveSettings } from "./settings.js";
import { BundledSounds } from "./sounds.js";
import type { SoundLibrary, VoiceTransport } from "./types.js";
import { DiscordVoiceTransport } from "./voice.js";

export interface DeadlockOptions {
  ownerId?: string;
  /** Offer a Start clock button when someone in voice launches Deadlock. Needs the Presence intent enabled in the Developer Portal. */
  startPrompt?: boolean;
  sounds?: SoundLibrary;
  voice?: VoiceTransport;
}

export function createDeadlockModule(db: DbClient, options: DeadlockOptions = {}): GameModule {
  const settings = new ObjectiveSettings(db, options.sounds ?? new BundledSounds());
  const matches = new DeadlockMatches(settings, options.voice ?? new DiscordVoiceTransport());
  const prompts = options.startPrompt ? new StartPrompts(matches) : undefined;
  const offer = (member: Parameters<StartPrompts["offer"]>[0]) => {
    void prompts?.offer(member).catch((error: unknown) => logger.error({ err: error }, "Deadlock start prompt failed"));
  };
  let detach = () => {};
  return {
    id: "deadlock", intents: [GatewayIntentBits.GuildVoiceStates, ...(prompts ? [GatewayIntentBits.GuildPresences] : [])],
    commands: [createDeadlockCommand(settings, matches, options.ownerId)],
    attach(client) {
      detach();
      const onVoiceState = (before: VoiceState, after: VoiceState) => {
        if (after.member && after.channelId && after.channelId !== before.channelId && playingDeadlock(after.member.presence)) offer(after.member);
        const state = matches.status(after.guild.id);
        if (!state) return;
        if (after.id === client.user?.id) matches.observeBotChannel(after.guild.id, after.channelId);
        if (before.channelId !== state.channelId && after.channelId !== state.channelId) return;
        const channel = after.guild.channels.cache.get(state.channelId);
        if (!channel?.isVoiceBased() || ![...channel.members.values()].some((member) => !member.user.bot)) matches.stop(after.guild.id);
      };
      const onPresence = (before: Presence | null, after: Presence) => {
        if (after.member && playingDeadlock(after) && !playingDeadlock(before)) offer(after.member);
      };
      const onInteraction = (interaction: Interaction) => {
        if (prompts && interaction.isButton() && interaction.customId === START_BUTTON) void prompts.press(interaction);
      };
      client.on(Events.VoiceStateUpdate, onVoiceState);
      if (prompts) { client.on(Events.PresenceUpdate, onPresence); client.on(Events.InteractionCreate, onInteraction); }
      detach = () => {
        client.off(Events.VoiceStateUpdate, onVoiceState);
        client.off(Events.PresenceUpdate, onPresence);
        client.off(Events.InteractionCreate, onInteraction);
      };
    },
    dispose() { detach(); prompts?.dispose(); matches.dispose(); },
  };
}
