import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { fileURLToPath } from "node:url";
import type { CounterGuide } from "./guides.js";
import { counterItems } from "./items.js";

const pageSize = 4;
const artworkDirectory = new URL("../../../../assets/deadlock/counters/", import.meta.url);

export const counterGuidePageCount = (guide: CounterGuide) => Math.ceil(guide.recommendations.length / pageSize);

export function counterGuideMessage(guide: CounterGuide, page = 0) {
  const pages = counterGuidePageCount(guide);
  if (!Number.isInteger(page) || page < 0 || page >= pages) throw new RangeError("Counter guide page unavailable");
  const recommendations = guide.recommendations.slice(page * pageSize, (page + 1) * pageSize);
  const review = guide.reviewedPatch ? `Reviewed for: ${guide.reviewedPatch}. Not reviewed for later updates.` : "Patch unverified";
  const heading = new EmbedBuilder().setTitle(`Counterbuying: ${guide.hero}`)
    .setDescription(`${guide.summary}\n\nChoose options that fit your build and the enemy threats; this is not a full shopping list.`)
    .setFooter({ text: `${review} · ${guide.source.label} · ${page + 1}/${pages}` });
  if (guide.source.url) heading.setURL(guide.source.url);
  if (guide.warning) heading.addFields({ name: "Important", value: guide.warning });
  if (guide.hero !== "Haze" && guide.recommendations.some((entry) => entry.item === "indomitable")) {
    heading.addFields({ name: "Duel or team fight?", value: "Unless stated otherwise, the video's Indomitable advice assumes a duel. Against multiple relevant threats, the creator generally favors Unstoppable." });
  }
  if (guide.recommendations.some((entry) => entry.item === "disarming-hex") && guide.recommendations.some((entry) => entry.item === "metal-skin")) {
    heading.addFields({ name: "Your role matters", value: "The video favors personal survival such as Metal Skin for a carry under direct threat; a safer teammate can apply Disarming Hex." });
  }
  const embeds = [heading, ...recommendations.map((entry) => {
    const item = counterItems[entry.item];
    const embed = new EmbedBuilder().setTitle(item.name).setThumbnail(`attachment://${item.file}`)
      .setDescription(`**${entry.purpose}**\n${entry.why}`);
    if (entry.when) embed.addFields({ name: "When", value: entry.when });
    if (entry.caution) embed.addFields({ name: "Keep in mind", value: entry.caution });
    return embed;
  })];
  const buttons: ButtonBuilder[] = [];
  if (page > 0) buttons.push(new ButtonBuilder().setCustomId(`deadlock:counter:v1:${guide.id}:${page - 1}`).setLabel("Back").setStyle(ButtonStyle.Secondary));
  if (page + 1 < pages) buttons.push(new ButtonBuilder().setCustomId(`deadlock:counter:v1:${guide.id}:${page + 1}`).setLabel("More options").setStyle(ButtonStyle.Primary));
  return {
    embeds,
    files: recommendations.map((entry) => {
      const item = counterItems[entry.item];
      return new AttachmentBuilder(fileURLToPath(new URL(item.file, artworkDirectory)), { name: item.file });
    }),
    components: buttons.length ? [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)] : [],
    allowedMentions: { parse: [] },
  };
}
