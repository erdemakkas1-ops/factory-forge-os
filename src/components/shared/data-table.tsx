import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, TableSkeleton } from "@/components/shared/states";
import { cn } from "@/lib/utils";

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Sıralama ve arama için düz metin değeri. */
  value?: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  className?: string;
  /** Mobil kart görünümünde gizlenir. */
  hideOnMobileCard?: boolean;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  searchPlaceholder?: string;
  pageSize?: number;
  toolbar?: React.ReactNode;
  onRowClick?: (row: T) => void;
  mobileTitle?: (row: T) => React.ReactNode;
};

/**
 * Arama, sıralama, sayfalama, kolon seçimi ve mobil kart görünümü içeren
 * yeniden kullanılabilir tablo bileşeni.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyTitle = "Kayıt bulunamadı",
  emptyDescription,
  emptyAction,
  searchPlaceholder = "Ara...",
  pageSize = 10,
  toolbar,
  onRowClick,
  mobileTitle,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" } | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const visibleColumns = columns.filter((c) => !hidden.includes(c.id));

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some((c) => {
        const v = c.value?.(row);
        return v != null && String(v).toLocaleLowerCase("tr-TR").includes(q);
      }),
    );
  }, [rows, columns, query]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.value) return filtered;
    return [...filtered].sort((a, b) => {
      const av = col.value!(a);
      const bv = col.value!(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      const res =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "tr-TR");
      return sort.dir === "asc" ? res : -res;
    });
  }, [filtered, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(id: string) {
    setSort((prev) =>
      prev?.id === id
        ? prev.dir === "asc"
          ? { id, dir: "desc" }
          : null
        : { id, dir: "asc" },
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Columns3 className="size-4" />
                <span className="hidden sm:inline">Kolonlar</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Görünen kolonlar</DropdownMenuLabel>
              {columns.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={!hidden.includes(c.id)}
                  onCheckedChange={(checked) =>
                    setHidden((prev) =>
                      checked ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                    )
                  }
                >
                  {c.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="panel overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : paged.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            action={emptyAction}
          />
        ) : (
          <>
            {/* Masaüstü tablo */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleColumns.map((c) => (
                      <TableHead key={c.id} className={c.className}>
                        {c.sortable && c.value ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(c.id)}
                            className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                          >
                            {c.header}
                            {sort?.id === c.id ? (
                              sort.dir === "asc" ? (
                                <ArrowUp className="size-3.5" />
                              ) : (
                                <ArrowDown className="size-3.5" />
                              )
                            ) : (
                              <ChevronsUpDown className="size-3.5 opacity-50" />
                            )}
                          </button>
                        ) : (
                          c.header
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((row) => (
                    <TableRow
                      key={rowKey(row)}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn(onRowClick && "cursor-pointer")}
                    >
                      {visibleColumns.map((c) => (
                        <TableCell key={c.id} className={c.className}>
                          {c.cell(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobil kart görünümü */}
            <ul className="divide-y md:hidden">
              {paged.map((row) => (
                <li
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className="space-y-2 p-4"
                >
                  {mobileTitle ? (
                    <div className="font-medium">{mobileTitle(row)}</div>
                  ) : null}
                  <dl className="grid grid-cols-1 gap-1.5 text-sm">
                    {visibleColumns
                      .filter((c) => !c.hideOnMobileCard)
                      .map((c) => (
                        <div key={c.id} className="flex items-start justify-between gap-3">
                          <dt className="text-muted-foreground">{c.header}</dt>
                          <dd className="text-right">{c.cell(row)}</dd>
                        </div>
                      ))}
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {!loading && sorted.length > 0 ? (
        <div className="flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
          <span>
            {sorted.length} kayıt • sayfa {currentPage}/{totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Önceki
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              Sonraki
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
