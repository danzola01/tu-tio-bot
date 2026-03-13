# Tu Tio Bot - Overwatch Winrate Tracker

A Discord bot built with TypeScript, Discord.js, and Prisma (SQLite) to track your Overwatch match results and analyze your winrate across different modes and maps.

## Features

- **Match Tracking**: Quickly record match outcomes (Win/Loss) with map and mode details.
- **Guided Flow**: Interactive buttons and select menus for easy match entry.
- **Winrate Statistics**: View detailed winrate stats filtered by game mode or specific maps.
- **Autocomplete Support**: Map suggestions based on the selected game mode.

## Prerequisites

- [Node.js](https://nodejs.org/) (v20 or higher recommended)
- [npm](https://www.npmjs.com/)
- A Discord Bot Token (via [Discord Developer Portal](https://discord.com/developers/applications))

## Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd tu-tio-bot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the root directory:
   ```env
   DISCORD_TOKEN=your_bot_token
   CLIENT_ID=your_bot_client_id
   GUILD_ID=your_discord_server_id
   DATABASE_URL="file:./dev.db"
   ```

4. **Initialize the database:**
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Deploy Slash Commands:**
   ```bash
   npm run deploy
   ```

## Usage

### Commands

- `/match add [mode] [map] [result]`: Directly add a match result.
- `/match start`: Start a guided, interactive flow to record a match.
- `/stats [mode] [map]`: View your winrate. Filters are optional.

### Examples

- Record a win on King's Row: `/match add mode:Hybrid map:King's Row result:Win`
- See overall stats: `/stats`
- See stats for a specific mode: `/stats mode:Control`

## Development

Run the bot in development mode with auto-reload:
```bash
npm run dev
```

Build the project:
```bash
npm run build
```

Start the production build:
```bash
npm start
```

## Tech Stack

- **Language**: TypeScript
- **Framework**: Discord.js v14
- **Database**: SQLite with Prisma ORM
- **Logging**: Pino
- **Validation**: Zod
