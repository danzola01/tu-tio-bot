import type { CounterItemId } from "./items.js";

export interface CounterRecommendation {
  item: CounterItemId;
  purpose: string;
  why: string;
  when?: string;
  caution?: string;
}

export interface CounterGuide {
  id: string;
  hero: string;
  aliases: readonly string[];
  summary: string;
  recommendations: readonly CounterRecommendation[];
  warning?: string;
  reviewedPatch: string | null;
  source: { label: string; url?: string };
}

function r(item: CounterItemId, purpose: string, why: string, when?: string, caution?: string): CounterRecommendation {
  return { item, purpose, why, ...(when ? { when } : {}), ...(caution ? { caution } : {}) };
}

function guide(hero: string, summary: string, recommendations: CounterRecommendation[], options: { aliases?: string[]; warning?: string } = {}): CounterGuide {
  return {
    id: normalizeHero(hero), hero, summary, recommendations, aliases: options.aliases ?? [],
    ...(options.warning ? { warning: options.warning } : {}),
    reviewedPatch: null, source: { label: "User-supplied YouTube transcript; video link unavailable" },
  };
}

export function normalizeHero(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
}

// Curated paraphrases of the supplied transcript, not independently verified mechanics.
// Keep timing, build, and team-role qualifications attached to their recommendation.
export const counterGuides: readonly CounterGuide[] = [
  guide("Abrams", "Counter melee pressure and healing, then keep an escape for his engage.", [
    r("rebuttal", "Survive melee", "An accessible source of melee resistance for a melee-focused Abrams.", "Can fill a temporary defensive slot until you need to sell it."),
    r("juggernaut", "Survive melee", "Another source of substantial melee resistance against his melee build."),
    r("decay", "Reduce healing", "Combines anti-heal with percentage-health damage against his large health pool."),
    r("toxic-bullets", "Reduce healing", "An alternative anti-heal with percentage-health damage; choose what fits your build."),
    r("warp-stone", "Escape the engage", "Reposition out of the charge or slam area."),
  ], { warning: "The creator warns against Indomitable here: the charge grab and wall impact are separate stun instances, so blocking the first may leave you stunned by the second." }),
  guide("Apollo", "Deny mobility and protect yourself against spirit burst.", [
    r("slowing-hex", "Stop his abilities", "The creator's first choice: it interferes with three of his four abilities.", "If he cleanses it, coordinate a second Hex from a teammate."),
    r("silence-wave", "Stop his abilities", "An alternative shutdown when a single Slowing Hex is being cleansed."),
    r("counterspell", "Survive the ultimate", "The creator describes using it against his ultimate even after the silence lands.", "Timing matters: if cast before the silence, Apollo can wait it out."),
    r("spellbreaker", "Survive spirit burst", "Reduces the impact of his concentrated spirit damage."),
  ]),
  guide("Bebop", "Plan for both the hook and the bomb.", [
    r("indomitable", "Handle the hook", "Can negate the first hook in a duel.", undefined, "The transcript generally favors Unstoppable when multiple enemies can trigger the protection."),
    r("unstoppable", "Handle the hook", "Helps you escape after being hooked."),
    r("warp-stone", "Handle the hook", "Reposition after a hook, ideally around a corner to break line of sight.", undefined, "The creator calls this less consistent than the other hook answers."),
    r("counterspell", "Handle the bomb", "A timed defensive answer to the bomb."),
    r("dispel-magic", "Handle the bomb", "Cleanse the bomb rather than absorbing its damage."),
  ]),
  guide("Billy", "Cover his melee pressure, mobility, and Wrecked debuff.", [
    r("rebuttal", "Survive his damage", "Useful against his melee pressure.", undefined, "Once he has multiple charges of his first ability, he does not need melee attacks to deal damage."),
    r("dispel-magic", "Survive his damage", "Remove Wrecked to reduce the damage enabled by that debuff."),
    r("slowing-hex", "Stop his escape", "Prevents Rising Ram from being a free disengage."),
    r("counterspell", "Escape the ultimate", "A timed option for getting away from his ultimate."),
    r("unstoppable", "Escape the ultimate", "An alternative for escaping the ultimate's control."),
    r("ethereal-shift", "Escape the ultimate", "Another defensive option against the ultimate."),
  ]),
  guide("Calico", "The creator strongly prioritizes denying her mobility and combo.", [
    r("slowing-hex", "Stop the combo", "The creator's standout choice: shuts down her abilities other than the bomb."),
    r("silence-wave", "Stop the combo", "A broader ability shutdown alternative."),
    r("cursed-relic", "Stop the combo", "The transcript's 'Curse': lock down her ability-driven mobility while her cooldowns are available."),
    r("spirit-resilience", "Survive spirit burst", "Helps you survive a combo built around spirit damage."),
  ]),
  guide("Celeste", "Bring her down, remove the damage debuff, or suppress her gun.", [
    r("slowing-hex", "Bring her down", "Its added gravity can make her easier to chase and bring toward the floor.", undefined, "The creator explicitly says this does not guarantee grounding her."),
    r("knockdown", "Bring her down", "Ground her so your team can secure the kill."),
    r("dispel-magic", "Reduce her damage", "Remove the Light Eater debuff described in the transcript."),
    r("disarming-hex", "Reduce her damage", "The creator highlights her gun damage as an overlooked reason to disarm her."),
  ]),
  guide("The Doorman", "Use silence or hard control for the door; prepare for the exit trap.", [
    r("silence-wave", "Stop the door", "Silence is the suggested answer to his door ability."),
    r("cursed-relic", "Stop the door", "The transcript's 'Curse' can shut him down and remove the Cheat Death effect.", "Use before his ultimate gains Unstoppable protection."),
    r("warp-stone", "Survive the exit", "Reposition after the combo to avoid traps waiting outside."),
    r("unstoppable", "Survive the exit", "Avoid the time-slow effect after leaving his ultimate."),
    r("counterspell", "Survive the exit", "Time it against the initial door hit or the follow-up waiting at the exit."),
  ], { aliases: ["Doorman", "Door man"], warning: "The transcript says the door is not a movement ability: Slowing Hex does not stop it." }),
  guide("Drifter", "Remove the mark, suppress his gun, and time defenses against his telegraphed ultimate.", [
    r("dispel-magic", "Remove debuffs", "Cleanse his mark and Toxic Bullets effect.", "Use when the mark lands; the transcript calls this debuff remover."),
    r("counterspell", "Handle the ultimate", "His ultimate's target and timing are telegraphed enough to prepare a counter."),
    r("divine-barrier", "Handle the ultimate", "The creator recommends this after being hit to negate the ultimate's effect."),
    r("disarming-hex", "Suppress his gun", "His gun is central to his damage; disarming denies that pressure."),
    r("metal-skin", "Suppress his gun", "A defensive choice when his stacks make him dangerous.", undefined, "It does not stop his debuffs from building up."),
  ]),
  guide("Dynamo", "Prepare for the ultimate or help pull a teammate out.", [
    r("unstoppable", "Survive the ultimate", "The creator's main recommendation, provided you activate it in time."),
    r("rescue-beam", "Rescue teammates", "Pull allies out when Dynamo's own Unstoppable prevents interruption."),
  ], { warning: "The creator says Indomitable does not work here. Reactive Barrier is mentioned but not endorsed as sufficient to survive the ultimate." }),
  guide("Graves", "Clear the summons and keep a cleanse available for the wall or debuffs.", [
    r("ricochet", "Clear summons", "Bounces from skulls and ghouls help clear the whole wave.", "Recommended for gun builds; the creator says it is a poor fit for spirit builds."),
    r("dispel-magic", "Escape control", "Helps escape the wall or remove Toxic Bullets."),
    r("return-fire", "Clear summons", "The creator describes it destroying skulls in a very specific interaction.", undefined, "Graves must shoot you on the same frame the skulls hit; do not treat this as reliable skull clearing."),
  ]),
  guide("Grey Talon", "His early gun pressure and later spirit damage call for different answers.", [
    r("rusted-barrel", "Survive early lane", "The creator finds it effective against early flight pressure.", undefined, "An early-lane choice, not the proposed answer to his later spirit build."),
    r("slowing-hex", "Stop flight pressure", "A later-game control option against his flight."),
    r("knockdown", "Stop flight pressure", "Another way to shut down his airborne pressure."),
    r("spellbreaker", "Survive charge shots", "Mitigate the burst from charge shots.", undefined, "A late-game Mystic Shot can consume its protection first."),
  ], { aliases: ["Gray Talon", "Great Town"] }),
  guide("Haze", "Prevent the opening catch or reduce the stack-driven gun damage.", [
    r("indomitable", "Survive the catch", "The creator favors this over reacting with Unstoppable because her combo can arrive unexpectedly.", undefined, "A knife followed by Curse can still defeat this plan."),
    r("plated-armor", "Reduce stack pressure", "The creator recommends slowing her stack buildup to reduce escalating damage.", undefined, "Unlike Metal Skin, its constantly applied passive is described as resistant to being removed by Curse."),
    r("metal-skin", "Survive gun damage", "Avoid gun damage for its active duration.", undefined, "Stacks still accumulate, and Curse can remove Metal Skin."),
    r("dispel-magic", "Remove stacks", "Remove the accumulated stacks rather than relying only on temporary damage immunity."),
  ]),
  guide("Holliday", "Choose a lasso defense you can actually time, then cover barrels or jump pads.", [
    r("indomitable", "Handle the lasso", "A passive answer when you cannot reliably react to the lasso wind-up.", "The creator describes its shield benefit in a one-versus-one."),
    r("counterspell", "Handle the lasso", "React to the audible lasso wind-up.", undefined, "Requires confident timing."),
    r("unstoppable", "Handle the lasso", "Another reaction-based answer to the lasso."),
    r("spirit-resilience", "Survive barrels", "Spirit resistance helps against barrel damage."),
    r("slowing-hex", "Stop mobility", "Stops her use of jump pads."),
  ], { aliases: ["Holiday"] }),
  guide("Infernus", "Remove the burn, then cover his ultimate or reduce buildup.", [
    r("dispel-magic", "Remove the burn", "The creator's strongest recommendation: remove the burn proc immediately."),
    r("counterspell", "Handle the ultimate", "A timed defense against his ultimate."),
    r("warp-stone", "Handle the ultimate", "Move out of the ultimate's range."),
    r("plated-armor", "Reduce buildup", "Suggested to reduce buildup of his third ability.", "The creator favors this when Haze or Wraith is also present."),
    r("juggernaut", "Reduce buildup", "An alternative to help against buildup and overlapping gun threats.", "The creator favors it when another gun carry is present."),
  ]),
  guide("Ivy", "Check her build before choosing your defensive item.", [
    r("dispel-magic", "Against gun Ivy", "Remove Capacitor's effect when she rushes that item."),
    r("metal-skin", "Against gun Ivy", "Survive a build dealing mostly gun damage."),
    r("counterspell", "Against Stone Form", "Counter Stone Form so you can walk away and avoid the follow-up cast."),
    r("unstoppable", "Against Stone Form", "An alternative defense against the ability-focused build described in the video."),
  ]),
  guide("Kelvin", "Stop the path before it starts, interrupt his setup, or prepare to outlast the dome.", [
    r("slowing-hex", "Stop path mobility", "Deny the path activation.", "Use before he activates path; it does not stop a path already active."),
    r("knockdown", "Stop path mobility", "The transcript describes it grounding Kelvin through his path.", undefined, "This is specifically patch-dependent advice in the video; its patch is unverified."),
    r("silence-wave", "Prevent the dome", "Stop him from casting his ultimate so you can finish the kill."),
    r("toxic-bullets", "Reduce dome healing", "Apply anti-heal if he gets the ultimate off; his large target makes bullets easier to land."),
    r("healbane", "Reduce dome healing", "An alternative anti-heal if it fits your build."),
    r("spirit-burn", "Reduce dome healing", "Another anti-heal alternative mentioned by the creator."),
    r("ethereal-shift", "Outlast the dome", "Spend part of the ultimate protected, then try to escape as it ends."),
  ]),
  guide("Lady Geist", "Reduce healing and prevent her low-health ultimate swing.", [
    r("decay", "Reduce healing", "The creator particularly recommends it when she is low on health."),
    r("silence-wave", "Prevent the ultimate", "Stop her casting the ultimate before you commit to the kill."),
    r("silencer", "Prevent the ultimate", "An alternative silence for a build that can apply it."),
    r("counterspell", "Answer the ultimate", "A timing-dependent answer to her ultimate when approaching a low-health Geist."),
    r("dispel-magic", "Remove drain", "The creator notes it can remove one of her drains."),
    r("metal-skin", "Against late gun builds", "An option very late when she transitions into a gun carry."),
    r("plated-armor", "Against late gun builds", "Another defense for that late-game gun transition."),
  ], { aliases: ["Lady Gist", "Geist"] }),
  guide("Lash", "Deny his committed burst or cover the ultimate.", [
    r("ethereal-shift", "Deny the slam", "The creator, a Lash main, calls this the strongest answer: his committed combo deals no damage while you are protected."),
    r("spirit-resilience", "Survive spirit burst", "Helps you live through his spirit damage."),
    r("enchanters-emblem", "Survive spirit burst", "The creator pairs this with Spirit Resilience for more spirit protection."),
    r("slowing-hex", "Stop his escape", "Deny the mobility of his second ability after he commits."),
    r("indomitable", "Handle the ultimate", "A passive defense against his ultimate in a duel."),
    r("unstoppable", "Handle the ultimate", "A team-fight alternative for avoiding ultimate control."),
    r("counterspell", "Handle the ultimate", "A timed answer to his ultimate."),
  ]),
  guide("McGinnis", "Improve turret clearing and coordinate enough control to get through her protection.", [
    r("monster-rounds", "Clear turrets", "Her turrets count as NPCs, so the creator recommends the extra damage."),
    r("cultist-sacrifice", "Clear turrets", "The other turret-clearing option named by the creator."),
    r("knockdown", "Control McGinnis", "Coordinate two Knockdowns, or a Knockdown and another stun, when she has Indomitable.", undefined, "A single stun may only consume her protection."),
  ], { aliases: ["McInness"] }),
  guide("Mina", "Coordinate repeated shutdown so a cleanse does not end your attempt.", [
    r("slowing-hex", "Deny her mobility", "Use a second teammate's Hex after she cleanses the first."),
    r("silence-wave", "Deny her abilities", "An alternative shutdown option."),
    r("cursed-relic", "Deny her abilities", "The transcript's 'Curse' is another shutdown option."),
  ], { warning: "The creator advises against relying on Knockdown: Mina can time her bats to evade it." }),
  guide("Mirage", "His debuffs make cleansing valuable; mobility control may need a teammate.", [
    r("dispel-magic", "Remove debuffs", "The creator describes removing beetles and their damage reduction, marks, and the tornado lift; cleansing beetles also denies the associated healing."),
    r("unstoppable", "Survive tornado builds", "Useful against repeated-tornado builds, with debuff reduction also shortening the time spent hiding from a four-stack mark."),
    r("slowing-hex", "Stop his mobility", "Coordinate two Hexes when one can be cleansed."),
  ]),
  guide("Mo & Krill", "Cover Combo and reduce healing against their large health pool.", [
    r("indomitable", "Handle Combo", "A passive duel option against Combo."),
    r("unstoppable", "Handle Combo", "An alternative protection against Combo, especially with multiple threats."),
    r("counterspell", "Handle Combo", "The creator says countering Combo is possible.", undefined, "Difficult timing; do not treat it as a dependable automatic escape."),
    r("debuff-reducer", "Shorten control", "The creator strongly recommends at least this much debuff reduction against the ultimate."),
    r("toxic-bullets", "Reduce healing", "Anti-heal with percentage-health damage against their large health pool."),
    r("decay", "Reduce healing", "The other preferred percentage-health anti-heal option."),
  ], { aliases: ["Mo and Krill", "Mo Krill"] }),
  guide("Paige", "Keep a cleanse or control-immunity answer available.", [
    r("dispel-magic", "Remove control", "The creator's key recommendation: cleanse her root and the Knockdown she commonly buys."),
    r("unstoppable", "Prevent control", "An alternative, or an additional layer alongside the cleanse."),
  ], { aliases: ["Page"] }),
  guide("Paradox", "Protect against the swap and clear damage-amplification stacks.", [
    r("indomitable", "Handle the swap", "The creator says her carbine does not consume it, leaving protection for the ultimate.", "As elsewhere, its recommendation assumes a duel unless stated otherwise."),
    r("dispel-magic", "Remove amplification", "Remove the damage-amplification stacks described in the transcript."),
  ]),
  guide("Pocket", "Deny his escape tools and prepare for the telegraphed ultimate.", [
    r("slowing-hex", "Stop escape", "Prevents taking the cloak teleport even though Pocket can still throw the cloak."),
    r("silence-wave", "Stop escape", "Prevents entering the briefcase to evade your Slowing Hex."),
    r("cursed-relic", "Stop escape", "The transcript's 'Curse' is another answer to his defensive abilities."),
    r("counterspell", "Handle the ultimate", "Prepare for the ultimate's telegraphed timing."),
    r("divine-barrier", "Handle the ultimate", "The creator offers it as an alternative when your reaction is slower."),
  ]),
  guide("Rem", "Cut off ally mobility, answer the ultimate, and reduce healing.", [
    r("slowing-hex", "Stop the ally jump", "Stops his second ability from carrying him to an ally, potentially exposing both players."),
    r("counterspell", "Handle the ultimate", "The creator describes the ultimate as clearly telegraphed and suitable for a timed counter."),
    r("healbane", "Reduce healing", "One build-dependent way to apply the generic anti-heal recommended against his healing."),
    r("toxic-bullets", "Reduce healing", "A gun-build alternative for applying that anti-heal."),
  ]),
  guide("Seven", "Cleanse the delayed stun, interrupt his ultimate, or suppress gun damage.", [
    r("dispel-magic", "Remove the stun", "Cleanse his telegraphed stun and any Toxic Bullets proc."),
    r("knockdown", "Interrupt the ultimate", "Have an ally interrupt his ultimate, forcing him to invest in Unstoppable.", undefined, "It no longer supplies that interruption while he is protected by Unstoppable."),
    r("disarming-hex", "Suppress gun damage", "Deny a gun carry's damage for the disarm duration."),
  ]),
  guide("Shiv", "Clear accumulated debuffs and reduce both burst and healing.", [
    r("dispel-magic", "Remove debuffs", "Clear stacked knives, dash debuffs, and an enemy Decay rather than letting all of them accumulate."),
    r("spellbreaker", "Survive burst", "The creator values both burst protection and debuff reduction to shorten knives, Decay, and dash effects."),
    r("healbane", "Reduce healing", "A build-dependent option for the generic healing reduction recommended here."),
    r("toxic-bullets", "Reduce healing", "A gun-build alternative for healing reduction."),
  ]),
  guide("Silver", "Separate her human gun pressure from the wolf-form chase.", [
    r("metal-skin", "Survive wolf form", "The creator's main survival option during her wolf-form attacks.", undefined, "Protection is temporary; plan for when it expires."),
    r("disarming-hex", "Survive wolf form", "The creator says disarm also prevents her wolf-form claw attacks."),
    r("return-fire", "Against human form", "Her Slam Fire can return significant damage to her.", undefined, "The creator does not recommend relying on this to survive wolf form."),
    r("warp-stone", "Escape the chase", "Warp up and over her dash so she continues past instead of colliding with you."),
    r("slowing-hex", "Escape the chase", "Deny her dash to make her easier to evade.", undefined, "She can still chase without it."),
  ]),
  guide("Sinclair", "Deny repeated teleports and prepare for burst or copied ultimates.", [
    r("slowing-hex", "Stop teleports", "Stops the repeated teleport interaction described in the transcript."),
    r("knockdown", "Interrupt copied ultimates", "A general control option when he commits to an ultimate.", undefined, "Its value depends on which ultimate he copied."),
    r("unstoppable", "Handle copied ultimates", "A situational defense based on which ultimates he can steal."),
    r("spellbreaker", "Survive bolts", "Mitigate his large bolt burst."),
  ]),
  guide("Venator", "The creator treats gun denial as the core answer.", [
    r("metal-skin", "Survive gun damage", "The creator recommends it against his gun damage, including the ultimate."),
    r("disarming-hex", "Stop his gun", "Deny shooting rather than absorbing it; the transcript also describes stopping his ultimate fire."),
  ], { aliases: ["Ventor"] }),
  guide("Victor", "Reduce healing, keep space, and time shutdown around his defenses.", [
    r("decay", "Reduce healing", "One of the creator's anti-heal choices to make him killable."),
    r("healbane", "Reduce healing", "Another anti-heal option if it fits your build."),
    r("spirit-burn", "Reduce healing", "A further anti-heal alternative mentioned in the video."),
    r("slowing-hex", "Keep space", "Makes it easier to leave his damage and healing area."),
    r("cursed-relic", "Shut down defenses", "The transcript's 'Curse' is recommended against Infuser or just after his ultimate ends."),
  ]),
  guide("Vindicta", "Force her out of the sky or close the gap decisively.", [
    r("knockdown", "Stop flight", "The creator's standard answer; forces investment in a cleanse, Counterspell, or Unstoppable."),
    r("slowing-hex", "Stop flight", "Prevent her from activating flight."),
    r("phantom-strike", "Close the gap", "The creator strongly recommends it for reaching and shutting her down.", undefined, "A predicted Counterspell can answer it."),
  ]),
  guide("Viscous", "Remove the cube's protection or punish Puddle Punch.", [
    r("cursed-relic", "Remove the cube", "The transcript's 'Curse' removes buffs, including the cube's protection."),
    r("rebuttal", "Punish punches", "The creator recommends it against Puddle Punch and highlights the benefit of parrying those punches."),
  ]),
  guide("Vyper", "Punish gunfire, survive the burst, and remove poison.", [
    r("return-fire", "Punish gunfire", "The creator's standout recommendation: reflected damage can punish her fire even while your resistances reduce what you take."),
    r("metal-skin", "Survive gun damage", "A survival alternative to reflection.", undefined, "It does not stop poison buildup."),
    r("disarming-hex", "Survive gun damage", "Deny her gun pressure for the disarm duration; consider a teammate applying it when you need a personal survival item."),
    r("knockdown", "Stop momentum", "Interrupt her movement and give your team a short control window."),
    r("dispel-magic", "Remove poison", "Cleanse accumulated poison."),
    r("indomitable", "Handle the stun", "The creator favors passive protection because her stun is too fast for a reliable Unstoppable reaction."),
  ], { aliases: ["Viper"] }),
  guide("Warden", "Answer the cage first; add gun defense and anti-heal when needed.", [
    r("dispel-magic", "Handle the cage", "The creator's first answer to a cage-focused Warden."),
    r("unstoppable", "Handle the cage", "An alternative to cleansing the control."),
    r("metal-skin", "Against a fed Warden", "The creator prefers it as a temporary gun-damage defense."),
    r("plated-armor", "Against a fed Warden", "Another defensive option, sometimes bought alongside Metal Skin."),
    r("healbane", "Reduce ultimate healing", "A build-dependent way to apply the generic anti-heal recommended during his ultimate."),
    r("toxic-bullets", "Reduce ultimate healing", "A gun-build alternative for that healing reduction."),
  ]),
  guide("Wraith", "Plan for the ultimate and reduce card buildup.", [
    r("unstoppable", "Handle the ultimate", "The creator usually prefers it, describing activation after the initial hit to leave the continuing effects."),
    r("indomitable", "Handle the ultimate", "A passive option for an ultimate that can be difficult to react to in a duel."),
    r("plated-armor", "Reduce buildup", "The creator recommends it to slow card buildup, a major source of her damage."),
  ], { warning: "The transcript specifically says her ultimate cannot be removed with a debuff cleanse." }),
  guide("Yamato", "Break the approach, resist spirit damage, or deny her ultimate before it starts.", [
    r("dispel-magic", "Break the approach", "The creator's main choice: cleanse her second ability's point-and-click approach."),
    r("spirit-resilience", "Survive spirit damage", "The creator prefers spirit resistance for her damage, including during the ultimate."),
    r("counterspell", "Survive spirit damage", "An alternative because her damage is telegraphed.", undefined, "The creator personally prefers spirit resistance."),
    r("cursed-relic", "Prevent the ultimate", "The transcript's 'Curse' can deny the ultimate before she casts it."),
    r("silencer", "Prevent the ultimate", "A gun-build option to silence her before the ultimate."),
    r("silence-wave", "Prevent the ultimate", "Another option to stop the cast and finish the kill."),
  ]),
];

export function findCounterGuide(value: string): CounterGuide | undefined {
  const query = normalizeHero(value);
  return counterGuides.find((item) => item.id === query || item.aliases.some((alias) => normalizeHero(alias) === query));
}

export function counterHeroChoices(value: string) {
  const query = normalizeHero(value);
  return counterGuides.filter((item) => [item.hero, ...item.aliases].some((name) => normalizeHero(name).includes(query)))
    .slice(0, 25).map((item) => ({ name: item.hero, value: item.id }));
}
