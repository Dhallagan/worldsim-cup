import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export function hasAI(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Returns a configured Claude model, or null when no key is set (scripted fallback). */
export function getModel(): LanguageModel | null {
  if (!hasAI()) return null;
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic(process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6");
}

/** Fast/cheap model (Haiku) for high-volume generation like persona cards. */
export function getFastModel(): LanguageModel | null {
  if (!hasAI()) return null;
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic(process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-4-5");
}

/** Reject if a promise doesn't settle in time — keeps the demo snappy. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}
