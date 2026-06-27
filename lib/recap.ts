import { createResend, hasResendConfig } from "./resend";
import type { OddsReport } from "./types";

export interface RecapResult {
  ok: boolean;
  to?: string;
  error?: string;
}

/**
 * Best-effort champion/odds recap email via Resend. No-ops gracefully when
 * RESEND_API_KEY / DEMO_RECAP_TO aren't set.
 */
export async function sendRecap(
  odds: OddsReport,
  report: string,
): Promise<RecapResult> {
  const to = process.env.DEMO_RECAP_TO;
  if (!hasResendConfig() || !to) return { ok: false, error: "Resend not configured" };
  try {
    const resend = createResend();
    const pct = (odds.titlePct * 100).toFixed(1);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to,
      subject: `🇺🇸 USA World Cup title odds: ${pct}%`,
      text: `${report}\n\n— WorldSim Cup · MiroFish swarm simulation`,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, to };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
