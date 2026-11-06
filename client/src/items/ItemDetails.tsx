import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarLoader, Dialog } from '@mucsi96/react-ui';
import { fetchJson, itemSchema, jsonBody, type LoanItem } from '../api';
import { itemsQuery, librariesQuery } from '../queries';
import { LOAN_STATUSES, OWN_STATUSES, mediaTypeLabel, statusLabel } from '../domain/status-label';
import { dueLabel } from '../domain/due-label';
import { Chips } from '../components/Chips';
import { Cover } from '../components/Cover';
import { QueryError } from '../components/QueryError';
import styles from './ItemDetails.module.css';

export function ItemDetails({ item, onClose }: { item: LoanItem; onClose: () => void }) {
  const client = useQueryClient();
  const libraries = useQuery(librariesQuery);
  const update = useMutation({
    mutationFn: ({ field, value }: { field: 'status' | 'library'; value: string | null }) => fetchJson(`/api/items/${item.id}/${field}`, itemSchema, jsonBody('PUT', { [field]: value })),
    onSuccess: async updated => {
      client.setQueryData(itemsQuery.queryKey, current => current?.map(row => row.id === updated.id ? updated : row));
      await client.invalidateQueries({ queryKey: itemsQuery.queryKey });
    },
  });
  const libraryId = libraries.data?.find(library => library.name === item.library)?.id;
  const selectedLibrary = item.library === null ? 'own' : libraryId ? `library:${libraryId}` : null;
  return <Dialog title={item.title} isOpen onOpenChange={open => { if (!open) onClose(); }}>
    <Cover item={item} large />
    <dl className={styles.details}>
      {item.author && <div><dt>Author</dt><dd>{item.author}</dd></div>}
      <div><dt>Type</dt><dd>{mediaTypeLabel(item.mediaType)}</dd></div>
      {item.isbn && <div><dt>ISBN</dt><dd>{item.isbn}</dd></div>}
      {item.dueDate && <div><dt>Due</dt><dd>{dueLabel(item.dueDate)}</dd></div>}
    </dl>
    {update.isError && <QueryError error={update.error} />}
    <h3>Status</h3>
    <Chips label="Status" options={(item.library === null ? OWN_STATUSES : LOAN_STATUSES).map(value => ({ value, label: statusLabel(value, item.mediaType) }))}
      value={item.status} disabled={update.isPending} onChange={value => { if (value !== item.status) update.mutate({ field: 'status', value }); }} />
    <h3>Library</h3>
    {libraries.isPending && <BarLoader label="Loading libraries" />}
    {libraries.isError && <QueryError error={libraries.error} retry={() => { void libraries.refetch(); }} />}
    {libraries.isSuccess && <Chips label="Library" options={[...libraries.data.map(library => ({ value: `library:${library.id}`, label: library.name })), { value: 'own', label: 'My own' }]}
      value={selectedLibrary} disabled={update.isPending}
      onChange={value => {
        const library = value === 'own' ? null : value.slice('library:'.length);
        if (value !== selectedLibrary) update.mutate({ field: 'library', value: library });
      }} />}
  </Dialog>;
}
