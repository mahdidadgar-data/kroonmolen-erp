import { useMemo, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ListSearch } from "@/lib/list-search";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  align?: "left" | "right";
  className?: string;
};

export type FilterDef<T, K extends string> = {
  key: K;
  label: string;
  options: { value: string; label: string }[];
  match: (row: T, value: string) => boolean;
};

const ALL = "__all";

export function DataTable<T, K extends string = never>({
  rows,
  columns,
  rowKey,
  searchText,
  searchPlaceholder = "Search…",
  filters = [],
  state,
  onStateChange,
  onRowClick,
  defaultSort,
  emptyText = "No records match your filters.",
  toolbarExtra,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: FilterDef<T, K>[];
  state: ListSearch<K>;
  onStateChange: (patch: Partial<ListSearch<K>>) => void;
  onRowClick?: (row: T) => void;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  emptyText?: string;
  toolbarExtra?: ReactNode;
}) {
  const q = state.q ?? "";
  const sortKey = state.sort ?? defaultSort?.key;
  const sortDir = state.dir ?? defaultSort?.dir ?? "asc";
  const filterValues = state as Record<string, string | undefined>;

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (needle && searchText && !searchText(r).toLowerCase().includes(needle)) return false;
      for (const f of filters) {
        const v = filterValues[f.key];
        if (v && !f.match(r, v)) return false;
      }
      return true;
    });
    const col = columns.find((c) => c.key === sortKey);
    if (col?.sortValue) {
      const get = col.sortValue;
      out = [...out].sort((a, b) => {
        const va = get(a);
        const vb = get(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, q, searchText, filters, filterValues, columns, sortKey, sortDir]);

  const activeFilters = filters.some((f) => filterValues[f.key]) || q !== "";

  const toggleSort = (key: string) => {
    if (sortKey === key) onStateChange({ sort: key, dir: sortDir === "asc" ? "desc" : "asc" } as Partial<ListSearch<K>>);
    else onStateChange({ sort: key, dir: "asc" } as Partial<ListSearch<K>>);
  };

  return (
    <div className="rounded-lg border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-2 border-b p-2.5">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => onStateChange({ q: e.target.value || undefined } as Partial<ListSearch<K>>)}
            placeholder={searchPlaceholder}
            className="h-8 pl-8 text-sm"
            aria-label="Search"
          />
        </div>
        {filters.map((f) => (
          <Select
            key={f.key}
            value={filterValues[f.key] ?? ALL}
            onValueChange={(v) => onStateChange({ [f.key]: v === ALL ? undefined : v } as Partial<ListSearch<K>>)}
          >
            <SelectTrigger className="h-8 w-auto min-w-36 text-sm" aria-label={f.label}>
              <span className="mr-1 text-muted-foreground">{f.label}:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {activeFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onStateChange(
                Object.fromEntries([["q", undefined], ...filters.map((f) => [f.key, undefined])]) as Partial<ListSearch<K>>,
              )
            }
          >
            <X /> Clear
          </Button>
        )}
        {toolbarExtra}
        <div className="ml-auto text-xs text-muted-foreground">
          {visible.length} of {rows.length}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-table-head">
              {columns.map((c) => {
                const active = sortKey === c.key;
                const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={cn(
                      "h-9 whitespace-nowrap px-3 text-xs font-medium text-muted-foreground",
                      c.align === "right" ? "text-right" : "text-left",
                      c.className,
                    )}
                    aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-sm hover:text-foreground",
                          active && "text-foreground",
                          c.align === "right" && "flex-row-reverse",
                        )}
                      >
                        {c.header}
                        <Icon className={cn("size-3", !active && "opacity-40")} />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  {emptyText}
                </td>
              </tr>
            ) : (
              visible.map((r) => (
                <tr
                  key={rowKey(r)}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={cn(
                    "border-b last:border-0 transition-colors hover:bg-row-hover",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "h-9 whitespace-nowrap px-3 py-1.5",
                        c.align === "right" && "text-right tabular-nums",
                        c.className,
                      )}
                    >
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
