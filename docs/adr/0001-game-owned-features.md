# Game-owned features with a shared Discord runtime

The bot started as an Overwatch tracker. Startup, command deployment, and shared types depended on Overwatch services, which made adding another game require changes outside that game's code.

Each game now owns its commands, rules, and dependencies through a `GameModule`. One explicit catalog supplies modules to both runtime and command deployment. The shared registry combines intents, rejects duplicate IDs and command names, and routes Discord interactions. See the [architecture](../architecture.md) for the interface and lifecycle.

Existing Overwatch command names and database tables stay compatible. New games use distinct command roots and models. Deadlock owns its reminders and counter guides without adding timer records to Overwatch's match tables. Shared configuration, logging, database construction, and Discord routing remain outside game directories.
