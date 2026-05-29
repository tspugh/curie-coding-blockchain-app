/** Shared display formatters — wei → STT and similar. */

const WEI_PER_STT = 10n ** 18n;

/**
 * Format wei → STT with 4 decimal places, zero-padded.
 * Used by the header wallet chip + the Settings wallet panel.
 */
export function formatStt(wei: bigint): string {
  const whole = wei / WEI_PER_STT;
  const frac = wei % WEI_PER_STT;
  const fracStr = (frac / 10n ** 14n).toString().padStart(4, "0");
  return `${whole.toString()}.${fracStr}`;
}

/**
 * Like {@link formatStt} but trims trailing zeros from the fractional part,
 * keeping at least one decimal (so `0` displays as `0.0`, not `0`).
 * Used where the fee precision varies and trailing zeros are noise.
 */
export function formatSttCompact(wei: bigint): string {
  const padded = formatStt(wei);
  const trimmed = padded.replace(/0+$/, "");
  return trimmed.endsWith(".") ? `${trimmed}0` : trimmed;
}
