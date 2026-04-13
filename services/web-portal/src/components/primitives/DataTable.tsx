import type { ReactElement, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { EmptyState, Skeleton } from "./Feedback";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  caption: string;
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  getRowKey: (row: T, index: number) => string;
}

export const DataTable = <T,>({
  caption,
  columns,
  emptyMessage = "No records available",
  error,
  getRowKey,
  loading = false,
  rows
}: DataTableProps<T>): ReactElement => {
  if (loading) {
    return <Skeleton aria-label={`${caption} loading`} className="h-48" />;
  }

  if (error) {
    return <EmptyState tone="error" title="Data unavailable" description={error} />;
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <table className="w-full border-separate border-spacing-y-3 text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th className="px-4 text-xs font-black uppercase tracking-widest text-on-surface-variant" key={column.key}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr className="group" key={getRowKey(row, rowIndex)}>
            {columns.map((column, columnIndex) => (
              <td
                className={cn(
                  "bg-surface-container-lowest px-4 py-3 text-on-surface transition group-hover:bg-surface-variant group-focus-within:bg-surface-variant",
                  columnIndex === 0 && "rounded-l-lg",
                  columnIndex === columns.length - 1 && "rounded-r-lg"
                )}
                key={column.key}
              >
                {column.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
