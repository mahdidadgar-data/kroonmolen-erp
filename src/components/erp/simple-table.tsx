import type { ReactNode } from "react";

export function SimpleTable({
  head,
  rows,
  rightCols = [],
}: {
  head: string[];
  rows: { key: string; cells: ReactNode[]; onClick?: () => void }[];
  rightCols?: number[];
}) {
  if (rows.length === 0) return <div className="p-6 text-center text-sm text-muted-foreground">None yet.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-table-head">
            {head.map((h, i) => (
              <th key={h} className={`h-8 whitespace-nowrap px-3 text-xs font-medium text-muted-foreground ${rightCols.includes(i) ? "text-right" : "text-left"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} onClick={r.onClick} className={`border-b last:border-0 hover:bg-row-hover ${r.onClick ? "cursor-pointer" : ""}`}>
              {r.cells.map((c, i) => (
                <td key={i} className={`h-9 whitespace-nowrap px-3 py-1.5 ${rightCols.includes(i) ? "text-right tabular-nums" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
