import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingArea, Button, TextField } from '@mucsi96/react-ui';
import { z } from 'zod';
import { fetchJson, jsonBody, librarySchema } from '../api';
import { librariesQuery } from '../queries';
import { QueryError } from '../components/QueryError';
import styles from './Settings.module.css';

export default function Settings() {
  const [name, setName] = useState('');
  const client = useQueryClient();
  const libraries = useQuery(librariesQuery);
  const add = useMutation({
    mutationFn: () => fetchJson('/api/libraries', librarySchema, jsonBody('POST', { name: name.trim() })),
    onSuccess: async () => { setName(''); await client.invalidateQueries({ queryKey: librariesQuery.queryKey }); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => fetchJson(`/api/libraries/${encodeURIComponent(id)}`, z.void(), { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: librariesQuery.queryKey }),
  });
  return <>
    <h1>Settings</h1>
    <section className={styles.libraries} aria-labelledby="libraries-heading">
      <h2 id="libraries-heading">Libraries</h2>
      <p>The libraries you borrow from. When importing an item you pick one of these — or "My own" for items you bought yourself.</p>
      <form className={styles.add} onSubmit={event => { event.preventDefault(); if (name.trim()) add.mutate(); }}>
        <TextField label="Library name" value={name} onChange={value => { setName(value); add.reset(); }} isRequired />
        <Button type="submit" isDisabled={add.isPending}>Add library</Button>
      </form>
      {add.isError && <QueryError error={add.error} />}
      {remove.isError && <QueryError error={remove.error} />}
      {libraries.isPending && <LoadingArea label="Loading libraries" />}
      {libraries.isError && <QueryError error={libraries.error} retry={() => { void libraries.refetch(); }} />}
      {libraries.isSuccess && <ul className={styles.list}>
        {libraries.data.length === 0 ? <li>No libraries yet. Add the ones you borrow from.</li> : libraries.data.map(library => <li key={library.id}>
          <span>{library.name}</span><Button variant="text" tone="error" aria-label={`Remove ${library.name}`} isDisabled={remove.isPending} onPress={() => remove.mutate(library.id)}>Remove</Button>
        </li>)}
      </ul>}
    </section>
  </>;
}
