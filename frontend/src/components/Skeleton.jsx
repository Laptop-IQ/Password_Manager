import React from "react";

export function Bar({ className = "" }) {
  return <span className={`skeleton block rounded ${className}`} aria-hidden="true" />;
}

/** Placeholder rows shaped like the passwords / secrets table. */
export function TableSkeleton({ rows = 5, label = "Loading" }) {
  return (
    <div className="panel overflow-hidden" role="status" aria-label={label}>
      <div className="hidden border-b border-line bg-sunken/60 px-6 py-3 md:block">
        <Bar className="h-3 w-24" />
      </div>
      <ul className="divide-y divide-line">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex items-center gap-4 px-4 py-4 md:px-6">
            <Bar className="h-9 w-9 shrink-0 !rounded-lg" />
            <div className="flex-1 space-y-2">
              <Bar className="h-3.5 w-1/3" />
              <Bar className="h-3 w-1/2" />
            </div>
            <Bar className="hidden h-8 w-40 md:block" />
            <Bar className="hidden h-3 w-20 md:block" />
          </li>
        ))}
      </ul>
      <span className="sr-only">{label}…</span>
    </div>
  );
}

/** Placeholder cards for the vault grid. */
export function CardGridSkeleton({ count = 4, label = "Loading" }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2" role="status" aria-label={label}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="panel space-y-3 p-5">
          <Bar className="h-4 w-1/2" />
          <Bar className="h-3 w-1/3" />
          <Bar className="h-10 w-full !rounded-lg" />
          <Bar className="h-10 w-full !rounded-lg" />
        </div>
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-10 sm:px-8" role="status" aria-label="Loading page">
      <Bar className="mb-3 h-7 w-48" />
      <Bar className="mb-8 h-4 w-72" />
      <TableSkeleton rows={4} />
    </div>
  );
}
