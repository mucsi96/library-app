import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingArea, Button, TextField } from '@mucsi96/react-ui';
import { z } from 'zod';
import { fetchJson, jobSchema, jsonBody, type ImportJob } from '../api';
import { jobsQuery } from '../queries';
import { toIsbn13 } from '../domain/isbn';
import { Cover } from '../components/Cover';
import { QueryError } from '../components/QueryError';
import styles from './ImportQueue.module.css';

const progressLabels = { QUEUED: 'Waiting in queue', EXTRACTING: 'Reading the ISBN…', GENERATING_COVER: 'Drawing the cover…', COMPLETED: 'Added to your loans' };

export function ImportQueue() {
  const jobs = useQuery(jobsQuery);
  if (jobs.isError) return <QueryError error={jobs.error} retry={() => { void jobs.refetch(); }} />;
  if (!jobs.data?.length) return null;
  return <section className={styles.queue} aria-labelledby="queue-heading">
    <h2 id="queue-heading">Processing</h2>
    {jobs.data.map(job => <ImportCard key={job.reference} job={job} />)}
  </section>;
}

function ImportCard({ job }: { job: ImportJob }) {
  const client = useQueryClient();
  const [isbn, setIsbn] = useState('');
  const [validationError, setValidationError] = useState<Error | null>(null);
  const title = job.title ?? 'New item';
  const action = useMutation({
    mutationFn: async (action: 'retry' | 'dismiss' | 'isbn') => {
      const path = `/api/import-jobs/${job.reference}`;
      if (action === 'dismiss') { await fetchJson(path, z.void(), { method: 'DELETE' }); return; }
      return fetchJson(`${path}/${action}`, jobSchema, action === 'isbn' ? jsonBody('POST', { isbn: toIsbn13(isbn) }) : { method: 'POST' });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: jobsQuery.queryKey }),
  });
  const dismiss = <Button variant="outlined" aria-label={`Dismiss import of ${title}`} isDisabled={action.isPending} onPress={() => action.mutate('dismiss')}>Dismiss</Button>;
  return <article className={styles.card} data-status={job.status}>
    <Cover item={{ isbn: job.isbn, title, mediaType: job.mediaType ?? 'BOOK' }} photo={job.status === 'COMPLETED' ? undefined : `/api/import-jobs/${job.reference}/photo`} />
    <div className={styles.body}>
      <p className={styles.title}>{title}</p>
      {job.author && <p className={styles.author}>{job.author}</p>}
      {action.isError && <QueryError error={action.error} />}
      {job.status === 'FAILED' || job.status === 'NEEDS_ISBN' ? <>
        <p role="alert" className={styles.error}>{job.errorDetail}</p>
        {job.status === 'FAILED' ? <div className={styles.actions}>
          <Button aria-label={`Retry importing ${title}`} isDisabled={action.isPending} onPress={() => action.mutate('retry')}>Retry</Button>{dismiss}
        </div> : <form onSubmit={event => {
          event.preventDefault();
          if (!toIsbn13(isbn)) { setValidationError(new Error('Not a valid ISBN. Check the digits and try again.')); return; }
          setValidationError(null); action.mutate('isbn');
        }}>
          <TextField label="ISBN" value={isbn} inputMode="numeric" autoComplete="off" placeholder="e.g. 978-3-16-148410-0" onChange={value => { setIsbn(value); setValidationError(null); action.reset(); }} />
          {validationError && <QueryError error={validationError} />}
          <div className={styles.actions}><Button type="submit" isDisabled={action.isPending}>Save ISBN</Button>{dismiss}</div>
        </form>}
      </> : <><p>{progressLabels[job.status]}</p>{job.status !== 'COMPLETED' && <LoadingArea label="Import in progress" />}</>}
    </div>
  </article>;
}
