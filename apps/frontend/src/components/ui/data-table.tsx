import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getSortedRowModel,
    getPaginationRowModel,
    getFilteredRowModel,
    SortingState,
    ColumnFiltersState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    pageSize?: number;
    columnFilters?: ColumnFiltersState;
}

// Generate smart page numbers: 1, 2, 3 ... 10, 11, 12 ... 48, 49, 50
function getPageNumbers(currentPage: number, totalPages: number): (number | '...')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const pages: (number | '...')[] = [];
    const nearStart = currentPage <= 4;
    const nearEnd = currentPage >= totalPages - 3;

    if (nearStart) {
        // Show first 5 + ... + last
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
    } else if (nearEnd) {
        // Show first + ... + last 5
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
        // Show first + ... + current-1, current, current+1 + ... + last
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
    }

    return pages;
}

export function DataTable<TData, TValue>({
    columns,
    data,
    pageSize: initialPageSize = 20,
    columnFilters,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [pageSize, setPageSizeState] = useState(initialPageSize);
    const [pageIndex, setPageIndex] = useState(0);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onSortingChange: setSorting,
        onPaginationChange: (updater) => {
            const next = typeof updater === 'function' ? updater({ pageIndex, pageSize }) : updater;
            setPageIndex(next.pageIndex);
            setPageSizeState(next.pageSize);
        },
        state: {
            sorting,
            columnFilters: columnFilters ?? [],
            pagination: { pageIndex, pageSize },
        },
    });

    const pageCount = table.getPageCount();
    const currentPage = table.getState().pagination.pageIndex + 1;
    const totalRows = table.getFilteredRowModel().rows.length;
    const pageNumbers = getPageNumbers(currentPage, pageCount);

    const handlePageSizeChange = (newSize: string) => {
        const size = parseInt(newSize, 10);
        setPageSizeState(size);
        setPageIndex(0); // reset to first page
    };

    return (
        <div className="space-y-3">
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    Žádné záznamy.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination controls */}
            {totalRows > 10 && (
                <div className="flex items-center justify-between px-2 flex-wrap gap-2">
                    {/* Left: info + page size */}
                    <div className="flex items-center gap-3">
                        <p className="text-sm text-muted-foreground whitespace-nowrap">{totalRows} záznamů</p>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Zobrazit</span>
                            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                                <SelectTrigger className="h-7 w-[62px] text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[10, 20, 30, 50].map((size) => (
                                        <SelectItem key={size} value={String(size)}>
                                            {size}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Right: page navigation */}
                    {pageCount > 1 && (
                        <div className="flex items-center gap-1">
                            {/* Prev button */}
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>

                            {/* Page numbers */}
                            {pageNumbers.map((page, idx) =>
                                page === '...' ? (
                                    <span key={`dots-${idx}`} className="px-1 text-xs text-muted-foreground">
                                        …
                                    </span>
                                ) : (
                                    <Button
                                        key={page}
                                        variant={page === currentPage ? 'default' : 'outline'}
                                        size="icon"
                                        className="h-8 w-8 text-xs"
                                        onClick={() => table.setPageIndex(page - 1)}
                                    >
                                        {page}
                                    </Button>
                                ),
                            )}

                            {/* Next button */}
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
