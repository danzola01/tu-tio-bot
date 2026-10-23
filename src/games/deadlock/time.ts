import { DeadlockError } from "./errors.js";

export function parseTime(value: string): number {
  const text = value.trim();
  if (!/^\d{1,5}(?::\d{2}){0,2}$/.test(text)) throw new DeadlockError("Use seconds, MM:SS, or HH:MM:SS for time.");
  const parts = text.split(":").map(Number);
  if (parts.slice(1).some((part) => part >= 60)) throw new DeadlockError("Minutes and seconds after a colon must be below 60.");
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  if (seconds > 86400) throw new DeadlockError("Time cannot exceed 24 hours.");
  return seconds;
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
    : `${minutes}:${String(total % 60).padStart(2, "0")}`;
}
