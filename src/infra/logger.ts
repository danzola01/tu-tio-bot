import pino from "pino";

export const logger = pino({
  redact: ["DISCORD_TOKEN", "token", "config.DISCORD_TOKEN", "headers.authorization", "req.headers.authorization"],
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});
