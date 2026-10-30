import { ActionRowBuilder, ActivityType, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags, type ButtonInteraction, type GuildMember, type Message, type Presence } from "discord.js";
import { logger } from "../../infra/logger.js";
import { voiceTarget } from "./commands.js";
import { DeadlockError } from "./errors.js";
import type { DeadlockMatches } from "./matches.js";

export const START_BUTTON = "deadlock:start";

// Discord reports the detected game, not the match, so the player still presses Start when the in-game timer starts.
export const playingDeadlock = (presence: Presence | null | undefined) =>
  presence?.activities.some((activity) => activity.type === ActivityType.Playing && activity.name === "Deadlock") ?? false;

interface Pending { message: Message | undefined; timer: ReturnType<typeof setTimeout> }

/** One Start clock button per server, posted in the voice channel's chat when someone in voice launches Deadlock. */
export class StartPrompts {
  private readonly pending = new Map<string, Pending>();

  constructor(private readonly matches: DeadlockMatches, private readonly lifetime = 15 * 60_000) {}

  async offer(member: GuildMember) {
    const channel = member.voice.channel;
    const guildId = member.guild.id;
    if (member.user.bot || channel?.type !== ChannelType.GuildVoice || this.matches.status(guildId) || this.pending.has(guildId)) return;
    const entry: Pending = { message: undefined, timer: setTimeout(() => this.withdraw(guildId, entry), this.lifetime) };
    this.pending.set(guildId, entry);
    try {
      entry.message = await channel.send({
        content: `<@${member.id}> launched Deadlock. Press **Start clock** when the in-game timer starts; use \`/deadlock sync\` if you press it late.`,
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(START_BUTTON).setLabel("Start clock").setEmoji("⏱️").setStyle(ButtonStyle.Success))],
        allowedMentions: { users: [member.id] },
      });
      if (this.pending.get(guildId) !== entry) await entry.message.delete();
    } catch (error) {
      this.forget(guildId, entry);
      logger.error({ err: error }, "Could not post the Deadlock start prompt");
    }
  }

  async press(interaction: ButtonInteraction) {
    await interaction.deferUpdate();
    try {
      const target = await voiceTarget(interaction);
      await this.matches.start(target, 0, async (content) => {
        const channel = interaction.channel;
        if (channel && "send" in channel) await channel.send({ content, allowedMentions: { parse: [] } });
      });
      const entry = this.pending.get(target.guildId);
      if (entry) this.forget(target.guildId, entry);
      await interaction.editReply({ content: `⏱️ <@${interaction.user.id}> started the clock at 0:00. Use \`/deadlock sync\` to correct it.`, components: [], allowedMentions: { parse: [] } });
    } catch (error) {
      if (!(error instanceof DeadlockError)) logger.error({ err: error }, "Deadlock start button failed");
      const message = error instanceof DeadlockError ? error.message : "Could not start the clock. Check the bot logs.";
      await interaction.followUp({ content: `❌ ${message}`, flags: MessageFlags.Ephemeral });
    }
  }

  dispose() {
    for (const entry of this.pending.values()) clearTimeout(entry.timer);
    this.pending.clear();
  }

  private forget(guildId: string, entry: Pending) {
    clearTimeout(entry.timer);
    if (this.pending.get(guildId) === entry) this.pending.delete(guildId);
  }

  private withdraw(guildId: string, entry: Pending) {
    this.forget(guildId, entry);
    entry.message?.delete().catch((error: unknown) => logger.warn({ err: error }, "Could not remove an expired Deadlock start prompt"));
  }
}
