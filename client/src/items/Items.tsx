import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { BarLoader, Button, Checkbox } from '@mucsi96/react-ui';
import type { LoanItem } from '../api';
import { itemsQuery } from '../queries';
import { ALL_STATUSES, mediaTypeLabel, statusLabel } from '../domain/status-label';
import { daysUntilDue, dueLabel } from '../domain/due-label';
import { Chips } from '../components/Chips';
import { Cover } from '../components/Cover';
import { QueryError } from '../components/QueryError';
import { ImportQueue } from '../imports/ImportQueue';
import { ItemDetails } from './ItemDetails';
import { BulkDueDate } from './BulkDueDate';
import styles from './Items.module.css';

type Filters = { type: string | null; library: string | null; status: string | null };
const matches = (item: LoanItem, filters: Filters) =>
  (!filters.type || item.mediaType === filters.type) &&
  (!filters.status || item.status === filters.status) &&
  (!filters.library || (filters.library === 'own' ? item.library === null : `library:${item.library}` === filters.library));

export default function Items() {
  const query = useQuery(itemsQuery);
  const items = query.data ?? [];
  const [filters, setFilters] = useState<Filters>({ type: null, library: null, status: null });
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [detailsId, setDetailsId] = useState<number | null>(null);
  const [dueItems, setDueItems] = useState<LoanItem[] | null>(null);
  const visible = items.filter(item => matches(item, filters));
  const selected = visible.filter(item => selectedIds.includes(item.id));
  const allSelected = visible.length > 0 && selected.length === visible.length;
  const ownSelected = selected.some(item => item.library === null);
  const details = items.find(item => item.id === detailsId);
  const libraries = [...new Set(items.flatMap(item => item.library === null ? [] : [item.library]))].sort();
  const statusOptions = ALL_STATUSES.filter(status => items.some(item => item.status === status)).map(status => {
    const mediaTypes = [...new Set(items.filter(item => item.status === status).map(item => item.mediaType))];
    return { value: status, label: statusLabel(status, mediaTypes.length === 1 ? mediaTypes[0] : 'BOOK') };
  });

  function filter(key: keyof Filters, value: string) {
    const next = { ...filters, [key]: filters[key] === value ? null : value };
    setFilters(next);
    setSelectedIds(selectedIds.filter(id => items.some(item => item.id === id && matches(item, next))));
  }
  function cancelSelection() { setSelecting(false); setSelectedIds([]); }

  return <>
    <h1>My loans</h1>
    <ImportQueue />
    {query.isPending && <BarLoader label="Loading loans" />}
    {query.isError && <QueryError error={query.error} retry={() => { void query.refetch(); }} />}
    {query.isSuccess && (items.length === 0 ? <p>No items yet. <Link to="/import">Import an item</Link> to get started.</p> : <>
      <Chips label="Filter by type" options={(['BOOK', 'CD', 'DVD'] as const).map(value => ({ value, label: mediaTypeLabel(value) }))} value={filters.type} onChange={value => filter('type', value)} />
      <Chips label="Filter by library" options={[
        ...libraries.map(name => ({ value: `library:${name}`, label: name })),
        ...(items.some(item => item.library === null) ? [{ value: 'own', label: 'My own' }] : []),
      ]} value={filters.library} onChange={value => filter('library', value)} />
      <Chips label="Filter by status" options={statusOptions} value={filters.status} onChange={value => filter('status', value)} />
      <div className={styles.actions}>
        {selecting ? <><Checkbox isSelected={allSelected} isIndeterminate={selected.length > 0 && !allSelected} onChange={() => setSelectedIds(allSelected ? [] : visible.map(item => item.id))}>Select all</Checkbox>
          <Button variant="text" onPress={cancelSelection}>Cancel</Button></> : <Button variant="outlined" onPress={() => setSelecting(true)}>Select</Button>}
      </div>
      {visible.length === 0 ? <p>No items match the selected filters.</p> : <table className={styles.table} role="table">
        <thead role="rowgroup"><tr role="row">
          {selecting && <th role="columnheader">Select</th>}
          {['Due', 'Cover', 'Type', 'Title', 'Library', 'Status'].map(title => <th key={title} role="columnheader">{title}</th>)}
        </tr></thead>
        <tbody role="rowgroup">{visible.map(item => <tr key={item.id} role="row" data-selected={selectedIds.includes(item.id)}>
          {selecting && <td role="cell" className={styles.select}><Checkbox aria-label={`Select "${item.title}"`} isSelected={selectedIds.includes(item.id)} onChange={checked => setSelectedIds(checked ? [...selectedIds, item.id] : selectedIds.filter(id => id !== item.id))}>{null}</Checkbox></td>}
          <td role="cell" className={styles.due}>{item.dueDate && <span className={daysUntilDue(item.dueDate) < 0 ? styles.overdue : daysUntilDue(item.dueDate) <= 7 ? styles.soon : ''}>{dueLabel(item.dueDate)}</span>}</td>
          <td role="cell" className={styles.cover}><Cover item={item} /></td>
          <td role="cell" className={styles.type}>{mediaTypeLabel(item.mediaType)}</td>
          <td role="cell" className={styles.title}><button className={styles.titleButton} aria-label={`Show details of "${item.title}"`} onClick={() => setDetailsId(item.id)}>{item.title}{item.author && <span className={styles.author}>{item.author}</span>}</button></td>
          <td role="cell" className={styles.library}>{item.library ?? 'My own'}</td>
          <td role="cell" className={styles.status}><button className={styles.statusChip} data-status={item.status} aria-label={`Change status of "${item.title}"`} onClick={() => setDetailsId(item.id)}>{statusLabel(item.status, item.mediaType)}</button></td>
        </tr>)}</tbody>
      </table>}
      {selecting && <div className={styles.selectionBar} role="region" aria-label="Selection actions">
        <p aria-live="polite">{selected.length} {selected.length === 1 ? 'item' : 'items'} selected</p>
        {ownSelected && <p>Own items have no due date. Unselect them to set one.</p>}
        <Button isDisabled={!selected.length || ownSelected} onPress={() => setDueItems(selected)}>Set due date</Button>
      </div>}
    </>)}
    {details && <ItemDetails item={details} onClose={() => setDetailsId(null)} />}
    {dueItems && <BulkDueDate items={dueItems} onClose={() => setDueItems(null)} onSaved={() => { setDueItems(null); cancelSelection(); }} />}
  </>;
}
