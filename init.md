What would be the best practice for creating a discord bot, I want to use node

Attach

Best practice for a Discord bot in Node.js is mostly about: picking a solid library, keeping the bot’s “core” clean and testable, handling permissions and rate limits safely, and setting up deployment/ops so it doesn’t randomly die.

Below is a practical, modern setup that scales from “toy bot” to “production”.

1) Use the standard stack

- Library: discord.js (most common, well-supported)

- Runtime: Node 20+ (LTS)

- Language: TypeScript (strongly recommended; pays off fast)

- Process manager: Docker or pm2 (or a platform like Fly.io/Render)

- Config: environment variables (.env) and a schema validator (e.g., zod)

- Logging: pino (fast structured logs)

2) Prefer Slash Commands (Interactions), not message parsing


Message-content bots require privileged intents and are more brittle.

Best practice is:


- Use /commands (slash commands) for actions

- Use buttons/select menus/modals for flows

- Use events only when needed (member joins, reactions, etc.)

3) Keep a clean project structure


A common, maintainable layout:


	src/
	  index.ts              # bootstraps client
	  client.ts             # creates configured Discord client
	  commands/             # slash commands
	    ping.ts
	    admin/
	  events/               # event handlers
	    ready.ts
	    interactionCreate.ts
	  services/             # business logic (no Discord types if possible)
	    userService.ts
	  infra/                # db, redis, http clients
	  config.ts             # env parsing/validation

Key idea: command handlers should be thin; move logic into services/ so you can test without Discord.

4) Be intentional about Intents and Permissions

- Only enable the Gateway Intents you actually need.

- Avoid MessageContent intent unless you truly need it.

- Use Discord permission checks in commands (and ideally role checks too).

- Also validate at runtime: “can the bot actually do this in this channel?”

5) Handle errors and timeouts correctly

- Always try/catch inside command execution.

- Reply to interactions quickly:
	- within 3 seconds: interaction.reply(...)

	- if work takes longer: await interaction.deferReply() then editReply(...)


- Add a global unhandled handler:
	- process.on("unhandledRejection", ...)

	- process.on("uncaughtException", ...) (log + exit; let process manager restart)


6) Respect rate limits and avoid API spam

- Don’t poll.

- Cache where reasonable.

- Batch operations when possible.

- Avoid sending lots of messages; edit a message instead if it’s a status update.

- If you call external APIs, add timeouts + retries with backoff.

7) Register commands the right way (dev vs prod)


Best practice:


- In development: register commands per-guild (instant updates)

- In production: register globally (takes longer to propagate)

8) Secure secrets and harden the bot

- Token only in environment variables; never commit it.

- Rotate token if leaked.

- Add allowlists for admin commands (owner IDs).

- Validate user input (especially if you run shell, eval, file ops—ideally don’t).

9) Observability and operations

- Structured logging (pino) with request/interaction IDs.

- Health checks if running in containers.

- Metrics if you care (Prometheus, etc.).

- Graceful shutdown: handle SIGTERM, destroy client cleanly.

10) Minimal “best practice” starter (discord.js + TS)


If you want, I can generate a full repo skeleton, but the essentials look like:


- discord.js v14

- dotenv + zod

- command handler + event handler

- separate command registration script

Typical install:


	npm init -y
	npm i discord.js dotenv zod
	npm i -D typescript tsx @types/node
	npx tsc --init

Quick questions so I can tailor the “best practice” to your use case

1. Will it be for one server or many?

2. Do you need message-based commands, or are slash commands fine?

3. Any persistence (Postgres/Mongo/SQLite) or just in-memory?

4. Hosting target: local, VPS, Docker, serverless-ish platform?

If you answer those, I’ll recommend an architecture and a starter layout (with command registration strategy and deployment approach) that fits.

GPT-5.2 (Low)


1. One server, with friends

2. slash commands should be fine

3. Perhaps will need to persist data, more context to come

4. Would be deployed to an oracle VM

===

Me and my friends really enjoy playing overwatch. We want a way to track our win rates on each map, I am thinking that there could be a command to say that the game started, the bot  then would ask for the map name, then ask for the outcome (visotry or defeat) maybe also a command to show statistics. That is why I assume we probably need some form of storage

Attach

For your use case (one server, slash commands, Oracle VM, simple stats),

the best-practice path is:


- discord.js + TypeScript

- Guild-scoped slash commands (fast iteration, no global propagation delays)

- SQLite for storage (simple, reliable on a single VM)

- An ORM/migrations tool (Prisma or Drizzle). I’d pick Prisma here because

migrations + types are painless and you can later switch to Postgres with

minimal code churn.

Recommended commands (keep it simple + robust)

Option A (simplest, best practice): single command with options


Avoid multi-step “conversation state” when you can.


- /match add map:<string> result:<win|loss>

- /stats map:<optional> user:<optional>

- /match undo (undo last entry; saves you from mistakes)

This is the most reliable approach because every command is atomic.

Option B (nice UX): guided flow using components


If you want the “bot asks map then outcome” feel without messy chat parsing:


- /match start
	- Bot replies ephemeral with a map select menu

	- Then shows buttons: Win / Loss

	- On click, bot writes one row to DB and confirms


This still stays within Discord’s interaction model and doesn’t require

message-content intent.

For a small friends server, I’d implement both:


- /match add ... for power users

- /match start for friendly guided entry

Data model (SQLite) that will scale for your stats


You can start with a single table; keep it append-only.

Fields to capture:


- userId (who reported it; optionally also track team members later)

- map (string; normalize later)

- result (WIN/LOSS)

- playedAt timestamp

Prisma schema example:


	// prisma/schema.prisma
	datasource db {
	  provider = "sqlite"
	  url      = env("DATABASE_URL")
	}
	
	generator client {
	  provider = "prisma-client-js"
	}
	
	enum MatchResult {
	  WIN
	  LOSS
	}
	
	model Match {
	  id        String      @id @default(cuid())
	  guildId   String
	  userId    String
	  map       String
	  result    MatchResult
	  playedAt  DateTime    @default(now())
	
	  @@index([guildId, map])
	  @@index([guildId, userId])
	  @@index([guildId, playedAt])
	}

.env example:


- DATABASE_URL="file:./data.sqlite"

How to compute win rates (what you’ll likely want)


Stats you’ll probably display:


- Overall: wins, losses, win%

- Per-map breakdown: win% on each map

- Optional: per-user breakdown (if you each track your own games)

You can implement stats queries with Prisma groupBy, or raw SQL if you

prefer. The important part: you’re storing normalized “facts” (each match)

so you can ask any question later.

Interaction handling best practices (discord.js)

- Use deferReply({ ephemeral: true }) for anything that might take > 1–2s

- Validate guild: only allow in your server

- For component flows, put the userId in customId and verify that only the

initiating user can click

Example pattern for component IDs:


- match:start:<userId>

- match:map:<userId>:<mapKey>

- match:result:<userId>:WIN

Deployment on an Oracle VM (practical best practice)


For a single bot on a VM:


1. Run Node 20+ (LTS)

2. Use systemd (or pm2) to keep it alive and restart on crashes

3. Store secrets in an env file readable only by the service user

4. Add basic logging (stdout captured by journald is fine)

If you want, I can give you a clean systemd unit file + deploy steps.

A couple design questions before you build UI details

1. Do you want tracking per person (each friend enters their own results)

or one shared team record?

2. Do you need to track mode (Push / Hybrid / Escort / Control / Flashpoint)

and/or competitive vs quickplay?

Those two choices affect whether map is enough, or whether you’ll want

mode, queue, and maybe season columns too.

GPT-5.2 (High)


1. Shared team record

2. Yes track the mode. Comptetive only so do not worry about that

Attach

Given “shared team record + competitive only + track mode”, the cleanest setup is:


- Store every match as an append-only row (wins/losses) in SQLite

- Use slash commands with:
	- a fast, atomic /match add ...

	- optional guided UX /match start (components)


- Use autocomplete for map names (best UX without running into select-menu limits)

Command design (recommended)

1) Add a match (atomic, reliable)

- /match add mode:<mode> map:<map> result:<win|loss>

Make map a string option with autocomplete. Autocomplete can filter maps by the selected mode.

2) Guided flow (nice UX, still robust)

- /match start
	- bot replies ephemeral with mode picker (select menu)

	- then asks for map (either:
		- a second select menu if <= 25 maps for that mode, or

		- a modal where they type a few letters and you fuzzy-match)


	- then Win / Loss buttons


If you implement only one, do /match add first. It’s simpler and less stateful.

3) Stats

- /stats (defaults to overall + breakdown by mode)

- /stats mode:<mode> (breakdown by map inside that mode)

- /stats map:<map> (map-specific record)

4) Quality-of-life

- /recent (last 10 matches with timestamps and who logged them)

- /match undo (undo last entry)

- Optional: /match delete id:<id> (if you show IDs in /recent)

Even for a shared team record, keep reportedByUserId so you have auditability and can restrict undo/delete.


---

Storage (SQLite + Prisma): schema that fits your needs


This supports: guild scoping, mode, map, win/loss, audit user, and soft delete.


	// prisma/schema.prisma
	datasource db {
	  provider = "sqlite"
	  url      = env("DATABASE_URL")
	}
	
	generator client {
	  provider = "prisma-client-js"
	}
	
	enum MatchResult {
	  WIN
	  LOSS
	}
	
	enum GameMode {
	  CONTROL
	  ESCORT
	  HYBRID
	  PUSH
	  FLASHPOINT
	  CLASH
	}
	
	model Match {
	  id               String      @id @default(cuid())
	  guildId          String
	  reportedByUserId String
	  mode             GameMode
	  map              String
	  result           MatchResult
	  playedAt         DateTime    @default(now())
	  deletedAt        DateTime?
	
	  @@index([guildId, playedAt])
	  @@index([guildId, mode])
	  @@index([guildId, mode, map])
	}

Notes:


- map as String is pragmatic. You can later normalize into a Map table if you want canonical names/aliases.

- deletedAt lets you “undo” without destroying history.

.env:


- DATABASE_URL="file:./data.sqlite"


---

Map naming best practice (avoid messy stats)


People will type “Kings Row”, “King’s Row”, “kings row”.

Do one of these:

Option A (recommended): store a canonical key


Maintain a mapping in code:


- input/alias → canonical key (e.g., kings_row)

- also store a display name for stats output

This keeps grouping correct forever.

Option B: store raw strings and normalize


At minimum:


- trim

- lowercase

- collapse whitespace

- remove apostrophes

Option A is better if you care about clean stats.


---

Stats computation (what you’ll query)


For overall win rate:


- total wins = count where result=WIN and deletedAt IS NULL

- total losses = count where result=LOSS and deletedAt IS NULL

- win% = wins / (wins + losses)

For breakdown by map (within a mode), group by map and result.

With Prisma you can do a groupBy on (map, result) and assemble totals in JS.


---

Discord interaction best practices for this bot

- Use guild-only commands (since it’s one server). Register commands per-guild for instant updates.

- Use ephemeral replies for /match start prompts and confirmations (keeps channels clean).

- Always deferReply() if you might hit the DB and format stats (safe pattern).

- For component flows, encode the initiating user ID in customId and reject clicks from others.


---

Deployment on Oracle VM (practical defaults)

- Run as a systemd service (recommended over keeping a terminal open)

- Store the SQLite DB file in a persistent directory (and back it up)

- Keep bot token in an env file readable only by the service user

If you want, I can provide:


- a full minimal repo skeleton (discord.js v14 + TS + Prisma)

- the exact slash command definitions (with map autocomplete)

- a systemd unit file + deploy steps for Oracle Linux/Ubuntu

One more detail to lock in the implementation: do you want to record only the result per map/mode, or also optional metadata like “date”, “notes”, or “score”? (Even if you don’t show it now, adding a notes column early can be handy.)