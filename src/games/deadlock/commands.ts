import { randomUUID } from "node:crypto";
import { ChannelType, EmbedBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction, type SlashCommandSubcommandBuilder } from "discord.js";
import { z, ZodError } from "zod";
import type { Command } from "../../bot/types.js";
import { logger } from "../../infra/logger.js";
import { DeadlockError } from "./errors.js";
import type { DeadlockMatches } from "./matches.js";
import { createObjective, objectiveId } from "./objectives.js";
import type { ObjectiveSettings } from "./settings.js";
import { formatTime, parseTime } from "./time.js";
import type { Objective, VoiceTarget } from "./types.js";

function objectiveOptions(builder: SlashCommandSubcommandBuilder, required: boolean) {
  builder
    .addStringOption((option) => option.setName("name").setDescription("Objective name").setMaxLength(48).setRequired(required))
    .addStringOption((option) => option.setName("first").setDescription("First time: seconds, MM:SS, or HH:MM:SS").setRequired(required))
    .addStringOption((option) => option.setName("repeat").setDescription("Repeat interval, or off"))
    .addBooleanOption((option) => option.setName("enabled").setDescription("Enable this objective"))
    .addBooleanOption((option) => option.setName("spoken").setDescription("Speak the objective name instead of advance beeps"))
    .addStringOption((option) => option.setName("warning").setDescription("Advance beep lead time, or off"))
    .addStringOption((option) => option.setName("repeat-warning").setDescription("Recurring advance beep lead time, or off"))
    .addBooleanOption((option) => option.setName("announce").setDescription("Play a ding at the first scheduled time"))
    .addBooleanOption((option) => option.setName("repeat-announce").setDescription("Play a ding at recurring scheduled times"));
  builder
    .addStringOption((option) => option.setName("countdown").setDescription("First countdown: 1–30 seconds, or off"))
    .addStringOption((option) => option.setName("repeat-countdown").setDescription("Recurring countdown: 1–30 seconds, or off"));
  return builder;
}

const selectObjective = (builder: SlashCommandSubcommandBuilder) => builder.addStringOption((option) =>
  option.setName("objective").setDescription("Objective to select").setRequired(true).setAutocomplete(true));

const data = new SlashCommandBuilder().setName("deadlock").setDescription("Deadlock sound reminders and objective settings")
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) => sub.setName("start").setDescription("Join your voice channel and start the clock").addStringOption((option) => option.setName("time").setDescription("Current game time for a late start; default 0:00")))
  .addSubcommand((sub) => sub.setName("stop").setDescription("Stop playback and leave voice"))
  .addSubcommand((sub) => sub.setName("pause").setDescription("Pause the match clock and playback"))
  .addSubcommand((sub) => sub.setName("resume").setDescription("Resume the match clock"))
  .addSubcommand((sub) => sub.setName("sync").setDescription("Correct the clock to the current game time").addStringOption((option) => option.setName("time").setDescription("Seconds, MM:SS, or HH:MM:SS").setRequired(true)))
  .addSubcommand((sub) => sub.setName("status").setDescription("Inspect the active clock"))
  .addSubcommand((sub) => sub.setName("schedule").setDescription("View the saved schedule for the next start"))
  .addSubcommand((sub) => sub.setName("spoken").setDescription("Turn spoken warnings on or off for every objective; owner-only")
    .addBooleanOption((option) => option.setName("enabled").setDescription("Speak objective names instead of advance beeps").setRequired(true)))
  .addSubcommand((sub) => selectObjective(sub.setName("preview").setDescription("Preview a callout in your voice channel; timer must be stopped"))
    .addStringOption((option) => option.setName("kind").setDescription("Callout to preview").addChoices(
      { name: "First due ding", value: "first" }, { name: "First advance beep", value: "first-warning" },
      { name: "Recurring due ding", value: "repeat" }, { name: "Recurring advance beep", value: "repeat-warning" },
      { name: "First countdown beep sample", value: "first-countdown" }, { name: "Recurring countdown beep sample", value: "repeat-countdown" },
    )))
  .addSubcommandGroup((group) => group.setName("objective").setDescription("Manage objectives; edits are owner-only")
    .addSubcommand((sub) => objectiveOptions(sub.setName("add").setDescription("Add an objective"), true))
    .addSubcommand((sub) => objectiveOptions(selectObjective(sub.setName("edit").setDescription("Edit an objective")), false))
    .addSubcommand((sub) => selectObjective(sub.setName("remove").setDescription("Remove an objective")))
    .addSubcommand((sub) => selectObjective(sub.setName("show").setDescription("Show all saved reminder settings"))));

function interval(value: string | null, fallback: number | null) {
  return value === null ? fallback : value.trim().toLowerCase() === "off" ? null : parseTime(value);
}

function changes(interaction: ChatInputCommandInteraction, objective: Objective): Objective {
  const options = interaction.options;
  const firstAt = options.getString("first");
  return {
    ...objective, name: options.getString("name") ?? objective.name,
    enabled: options.getBoolean("enabled") ?? objective.enabled,
    spoken: options.getBoolean("spoken") ?? objective.spoken,
    firstAt: firstAt === null ? objective.firstAt : parseTime(firstAt),
    repeatEvery: interval(options.getString("repeat"), objective.repeatEvery),
    first: {
      announce: options.getBoolean("announce") ?? objective.first.announce,
      warningSeconds: interval(options.getString("warning"), objective.first.warningSeconds),
      countdownSeconds: interval(options.getString("countdown"), objective.first.countdownSeconds),
    },
    recurring: {
      announce: options.getBoolean("repeat-announce") ?? objective.recurring.announce,
      warningSeconds: interval(options.getString("repeat-warning"), objective.recurring.warningSeconds),
      countdownSeconds: interval(options.getString("repeat-countdown"), objective.recurring.countdownSeconds),
    },
  };
}

const leadTime = (seconds: number | null) => seconds === null ? "off" : `${seconds}s`;
const soundSummary = (objective: Objective, settings: Objective["first"]) =>
  `Advance ${objective.spoken ? "voice" : "beep"}: ${leadTime(settings.warningSeconds)} · Countdown: ${leadTime(settings.countdownSeconds)} · Due ding: ${settings.announce ? "on" : "off"}`;

function scheduleEmbed(objectives: readonly Objective[]) {
  const summary = (objective: Objective, settings: Objective["first"]) => `${objective.spoken ? "Voice" : "Beep"} ${leadTime(settings.warningSeconds)} · Countdown ${leadTime(settings.countdownSeconds)} · Ding ${settings.announce ? "on" : "off"}`;
  return new EmbedBuilder().setTitle("Deadlock saved schedule")
    .setDescription("Edits apply on the next start. Sounds do not detect objective availability.")
    .addFields(objectives.map((objective) => ({
      name: `${objective.enabled ? "On" : "Off"} · ${objective.name}`,
      value: `First ${formatTime(objective.firstAt)}: ${summary(objective, objective.first)}\nEvery ${objective.repeatEvery === null ? "off" : formatTime(objective.repeatEvery)}: ${summary(objective, objective.recurring)}`,
    })));
}

function objectiveEmbed(objective: Objective) {
  return new EmbedBuilder().setTitle(`${objective.name} (${objective.id})`)
    .setDescription(`Enabled: ${objective.enabled}\nFirst: ${formatTime(objective.firstAt)} · Repeat: ${objective.repeatEvery === null ? "off" : formatTime(objective.repeatEvery)}\nSaved settings apply on the next start.`)
    .addFields({ name: "First reminder", value: soundSummary(objective, objective.first) }, { name: "Recurring reminders", value: soundSummary(objective, objective.recurring) });
}

async function requireOwner(interaction: ChatInputCommandInteraction, configured?: string) {
  let id = configured;
  if (!id) {
    const application = interaction.client.application;
    const owner = application?.owner ?? (await application?.fetch())?.owner;
    if (owner) id = ("ownerId" in owner ? owner.ownerId : owner.id) ?? undefined;
  }
  if (!id) throw new DeadlockError("Cannot identify the bot owner. Configure BOT_OWNER_ID.");
  if (interaction.user.id !== id) throw new DeadlockError("Only the bot owner can edit the saved schedule.");
}

async function voiceTarget(interaction: ChatInputCommandInteraction): Promise<VoiceTarget> {
  const guild = interaction.guild;
  const channel = guild?.voiceStates.cache.get(interaction.user.id)?.channel;
  if (!guild || !channel || channel.type !== ChannelType.GuildVoice) throw new DeadlockError("Join a regular voice channel before starting or previewing.");
  const member = guild.members.me ?? await guild.members.fetchMe();
  if (!channel.permissionsFor(member)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
    throw new DeadlockError("The bot needs View Channel, Connect, and Speak permissions in your voice channel.");
  }
  return { guildId: guild.id, channelId: channel.id, adapterCreator: guild.voiceAdapterCreator };
}

function clockMessage(matches: DeadlockMatches, guildId: string) {
  const state = matches.status(guildId);
  if (!state) return "No active Deadlock timer.";
  const phase = state.phase === "starting" ? "Starting" : state.phase === "preview" ? "Preview" : state.paused ? "Paused" : "Running";
  return `${phase} · ${formatTime(state.elapsed)} in <#${state.channelId}>${state.nextAt === null ? "" : ` · Next callout: ${formatTime(state.nextAt)}`}`;
}

export function createDeadlockCommand(settings: ObjectiveSettings, matches: DeadlockMatches, ownerId?: string): Command {
  return {
    data,
    async autocomplete(interaction) {
      const query = interaction.options.getFocused().toLowerCase();
      const objectives = await settings.list(interaction.guildId!);
      await interaction.respond(objectives.filter((objective) => `${objective.name} ${objective.id}`.toLowerCase().includes(query)).slice(0, 25).map((objective) => ({ name: objective.name, value: objective.id })));
    },
    async execute(interaction) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const guildId = interaction.guildId;
        if (!guildId) throw new DeadlockError("Use this command in the server.");
        const action = interaction.options.getSubcommand();
        const group = interaction.options.getSubcommandGroup(false);
        if (action === "schedule") {
          await interaction.editReply({ embeds: [scheduleEmbed(await settings.list(guildId))] });
        } else if (action === "spoken") {
          await requireOwner(interaction, ownerId);
          const enabled = interaction.options.getBoolean("enabled", true);
          const skipped = await settings.setSpoken(guildId, enabled);
          const except = skipped.length ? ` except ${skipped.join(", ")}, which have no recorded voice (see npm run generate:voices)` : "";
          await interaction.editReply(`Spoken warnings ${enabled ? "on" : "off"} for every objective${except}. Changes apply on the next start.`);
        } else if (group === "objective") {
          if (action !== "show") await requireOwner(interaction, ownerId);
          const objectives = await settings.list(guildId);
          if (action === "add") {
            const name = interaction.options.getString("name", true).trim();
            const id = objectiveId(name) || randomUUID();
            if (objectives.some((item) => item.id === id)) throw new DeadlockError("An objective with this name already exists.");
            await settings.save(guildId, changes(interaction, createObjective(id, name, parseTime(interaction.options.getString("first", true)))));
            await interaction.editReply("Objective saved and sounds checked. Changes apply on the next start.");
          } else {
            const objective = objectives.find((item) => item.id === interaction.options.getString("objective", true));
            if (!objective) throw new DeadlockError("Objective not found. Use /deadlock schedule to see available objectives.");
            if (action === "show") await interaction.editReply({ embeds: [objectiveEmbed(objective)] });
            else if (action === "edit") {
              await settings.edit(guildId, objective.id, (current) => changes(interaction, current));
              await interaction.editReply("Objective saved and sounds checked. Changes apply on the next start.");
            } else if (action === "remove") {
              await settings.remove(guildId, objective.id);
              await interaction.editReply("Objective removed. Changes apply on the next start.");
            }
          }
        } else {
          if (action === "start") {
            const seconds = parseTime(interaction.options.getString("time") ?? "0");
            await matches.start(await voiceTarget(interaction), seconds, async (content) => {
              const channel = interaction.channel;
              if (channel && "send" in channel) await channel.send({ content, allowedMentions: { parse: [] } });
            });
          } else if (action === "preview") {
            const kind = z.enum(["first", "first-warning", "repeat", "repeat-warning", "first-countdown", "repeat-countdown"]).parse(interaction.options.getString("kind") ?? "first");
            await matches.preview(await voiceTarget(interaction), interaction.options.getString("objective", true), kind);
            await interaction.editReply("Preview ended.");
            return;
          } else if (action === "stop") {
            matches.stop(guildId);
            await interaction.editReply("Deadlock timer stopped. Playback ended and the bot left voice.");
            return;
          } else if (action === "pause") matches.pause(guildId);
          else if (action === "resume") matches.resume(guildId);
          else if (action === "sync") matches.sync(guildId, parseTime(interaction.options.getString("time", true)));
          else if (action !== "status") throw new DeadlockError("Unknown Deadlock action.");
          await interaction.editReply(clockMessage(matches, guildId));
        }
      } catch (error) {
        if (!(error instanceof DeadlockError || error instanceof ZodError)) logger.error({ err: error }, "Deadlock command failed");
        const message = error instanceof DeadlockError ? error.message : error instanceof ZodError ? error.issues[0]?.message : "Could not complete the Deadlock command. Check the bot logs.";
        await interaction.editReply(`❌ ${message}`);
      }
    },
  };
}
