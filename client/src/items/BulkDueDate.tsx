import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, useNotifications } from '@mucsi96/react-ui';
import { fetchJson, itemSchema, jsonBody, type LoanItem } from '../api';
import { itemsQuery } from '../queries';
import { dueLabel } from '../domain/due-label';
import { QueryError } from '../components/QueryError';
import styles from './BulkDueDate.module.css';

export function BulkDueDate({ items, onClose, onSaved }: { items: LoanItem[]; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(items.flatMap(item => item.dueDate ? [item.dueDate] : []).sort()[0] ?? '');
  const client = useQueryClient();
  const notifications = useNotifications();
  const count = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;
  const save = useMutation({
    mutationFn: () => fetchJson('/api/items/due-date', itemSchema.array(), jsonBody('PUT', { ids: items.map(item => item.id), dueDate: date })),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: itemsQuery.queryKey });
      notifications.success(`Due date updated for ${count}`);
      onSaved();
    },
  });
  return <Dialog title={`Set due date for ${count}`} isOpen onOpenChange={open => { if (!open) onClose(); }}>
    <form onSubmit={event => { event.preventDefault(); if (date) save.mutate(); }}>
      <label className={styles.date}>Due date<input type="date" value={date} required onChange={event => setDate(event.target.value)} /></label>
      {date && <p>{dueLabel(date)}</p>}
      <ul className={styles.items}>{items.map(item => <li key={item.id}>{item.title}<span>{item.library}</span></li>)}</ul>
      {save.isError && <QueryError error={save.error} />}
      <div className={styles.actions}><Button variant="outlined" onPress={onClose}>Cancel</Button><Button type="submit" isDisabled={!date || save.isPending}>Save due date</Button></div>
    </form>
  </Dialog>;
}
