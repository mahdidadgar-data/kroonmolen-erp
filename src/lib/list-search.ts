export type SortDir = "asc" | "desc";
export type ListSearch<K extends string = never> = {
  q?: string;
  sort?: string;
  dir?: SortDir;
} & { [P in K]?: string };

/** URL search validator for list pages: free-text search, sort, and named filters. */
export function listSearch<K extends string>(...filterKeys: K[]) {
  return (raw: Record<string, unknown>): ListSearch<K> => {
    const out: Record<string, string> = {};
    for (const key of ["q", "sort", ...filterKeys]) {
      const v = raw[key];
      if (typeof v === "string" && v !== "") out[key] = v;
      else if (typeof v === "number") out[key] = String(v);
    }
    if (raw.dir === "asc" || raw.dir === "desc") out.dir = raw.dir;
    return out as ListSearch<K>;
  };
}
