export function parseDecimalLooseOptional(input: unknown): number | undefined {
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : undefined;
  }

  const raw = String(input ?? "").trim();
  if (!raw) return undefined;

  // Keep digits, separators and sign. Drop currency symbols and other text.
  // Also remove whitespace (including NBSP) that is often used as a thousands separator.
  let cleaned = raw
    .replace(/[\s\u00A0]/g, "")
    .replace(/[^0-9,.-]/g, "");

  if (!cleaned) return undefined;

  const negative = cleaned.startsWith("-");
  cleaned = cleaned.replace(/-/g, "");

  const dotCount = (cleaned.match(/\./g) ?? []).length;
  const commaCount = (cleaned.match(/,/g) ?? []).length;

  // Choose the last separator as the decimal separator.
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  let sepIndex = Math.max(lastDot, lastComma);

  let intPart = cleaned;
  let fracPart = "";
  if (sepIndex >= 0) {
    intPart = cleaned.slice(0, sepIndex);
    fracPart = cleaned.slice(sepIndex + 1);
  }

  // Heuristic for common es-CO grouping with dots:
  // - If ONLY dots are present and there are multiple of them, treat them as grouping separators.
  // - If there's a single dot and it looks like grouping (exactly 3 digits after, and 1-3 digits before), treat as grouping.
  if (commaCount === 0 && dotCount > 0) {
    if (dotCount > 1) {
      const digitsOnly = cleaned.replace(/[.,]/g, "");
      const n = Number(`${negative ? "-" : ""}${digitsOnly || "0"}`);
      return Number.isFinite(n) ? n : undefined;
    }

    if (dotCount === 1 && fracPart.length === 3 && intPart.length >= 1 && intPart.length <= 3) {
      // Example: 1.234 -> 1234
      const digitsOnly = `${intPart}${fracPart}`.replace(/[.,]/g, "");
      const n = Number(`${negative ? "-" : ""}${digitsOnly || "0"}`);
      return Number.isFinite(n) ? n : undefined;
    }
  }

  // Remove any remaining separators (treat them as thousands separators).
  intPart = intPart.replace(/[.,]/g, "");
  fracPart = fracPart.replace(/[.,]/g, "");

  if (!intPart && !fracPart) return undefined;

  const normalized = `${negative ? "-" : ""}${intPart || "0"}${fracPart ? `.${fracPart}` : ""}`;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return undefined;
  return n;
}
