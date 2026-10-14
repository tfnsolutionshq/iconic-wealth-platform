import type { ReactNode } from 'react';
import { EmptyState } from './Feedback';
import { Search } from 'lucide-react';

export interface Column<T> { header: string; align?: 'left' | 'right'; render: (row: T) => ReactNode }

export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty = 'Nothing matches these filters' }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; empty?: string }) {
  return <div className="overflow-x-auto rounded-2xl border border-line bg-white">
    <table className="w-full border-collapse text-sm">
      <thead><tr>{columns.map(c => <th key={c.header} className={`whitespace-nowrap border-b border-line bg-soft px-3.5 py-2.5 text-xs font-bold text-mute ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.header}</th>)}</tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={columns.length}><EmptyState icon={<Search size={24} />} title={empty}>Try clearing a filter or search.</EmptyState></td></tr>}
        {rows.map(r => <tr key={rowKey(r)} tabIndex={onRowClick ? 0 : undefined} onClick={() => onRowClick?.(r)} onKeyDown={e => e.key === 'Enter' && onRowClick?.(r)}
          className={onRowClick ? 'cursor-pointer hover:bg-[#faf7fe] focus-visible:bg-brand-tint' : ''}>
          {columns.map(c => <td key={c.header} className={`border-b border-line px-3.5 py-3 font-semibold last:border-b-0 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>{c.render(r)}</td>)}
        </tr>)}
      </tbody>
    </table>
  </div>;
}
