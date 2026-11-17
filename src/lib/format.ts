const eur = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const eur0 = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const num1 = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 });

export const formatEUR = (v: number | null | undefined) => (v == null ? "—" : eur.format(v));
export const formatEUR0 = (v: number | null | undefined) => (v == null ? "—" : eur0.format(v));
export const formatTonnes = (v: number | null | undefined) => (v == null ? "—" : `${num1.format(v)} t`);

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  });
}
