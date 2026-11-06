import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarLoader, Button, ProgressBar, useNotifications } from '@mucsi96/react-ui';
import { uploadPhotos } from '../api';
import { jobsQuery, librariesQuery } from '../queries';
import { Chips } from '../components/Chips';
import { QueryError } from '../components/QueryError';
import { ImportQueue } from './ImportQueue';
import styles from './Import.module.css';

export default function Import() {
  const libraries = useQuery(librariesQuery);
  const client = useQueryClient();
  const notifications = useNotifications();
  const [source, setSource] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ front: File | null; back: File | null }>({ front: null, back: null });
  const [progress, setProgress] = useState(0);
  const [captureKey, setCaptureKey] = useState(0);
  const upload = useMutation({
    mutationFn: ({ front, back, source }: { front: File; back: File; source: string }) =>
      uploadPhotos(front, back, source === 'own' ? null : source.slice('library:'.length), setProgress),
    onSuccess: async job => {
      client.setQueryData(jobsQuery.queryKey, current => [...(current ?? []).filter(existing => existing.reference !== job.reference), job]);
      setPhotos({ front: null, back: null });
      setCaptureKey(key => key + 1);
      notifications.success('Added to the import queue');
      await client.invalidateQueries({ queryKey: jobsQuery.queryKey });
    },
  });
  return <>
    <h1>Import item</h1>
    <p className={styles.hint}>Pick where the item is from, then take a photo of its front and back. The ISBN is read from the photos and a clean cover thumbnail is generated in the background — you can keep going while it works.</p>
    <ImportQueue />
    {libraries.isPending && <BarLoader label="Loading libraries" />}
    {libraries.isError && <QueryError error={libraries.error} retry={() => { void libraries.refetch(); }} />}
    <Chips label="Item source" options={[...(libraries.data ?? []).map(library => ({ value: `library:${library.id}`, label: library.name })), { value: 'own', label: 'My own' }]}
      value={source} disabled={upload.isPending} onChange={value => setSource(value === source ? null : value)} />
    <Link to="/settings">Manage libraries</Link>
    <div className={styles.photos} key={captureKey}>
      {(['front', 'back'] as const).map(side => <PhotoCapture key={side} side={side} disabled={upload.isPending}
        onChange={file => { setPhotos(current => ({ ...current, [side]: file })); upload.reset(); }} />)}
    </div>
    {upload.isError && <QueryError error={upload.error} />}
    {upload.isPending && <ProgressBar label="Uploading photos" value={progress} />}
    <div className={styles.actions}>
      <Button isDisabled={!photos.front || !photos.back || !source || upload.isPending} onPress={() => {
        if (photos.front && photos.back && source) { setProgress(0); upload.mutate({ front: photos.front, back: photos.back, source }); }
      }}>{upload.isPending ? `Uploading ${progress}%` : 'Import item'}</Button>
      <Link to="/">Done — view loans</Link>
    </div>
  </>;
}

function PhotoCapture({ side, disabled, onChange }: { side: 'front' | 'back'; disabled: boolean; onChange: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const label = side === 'front' ? 'Front' : 'Back';
  return <div className={styles.photo}>
    {preview && <img src={preview} alt={`${label} photo preview`} />}
    <Button isDisabled={disabled} onPress={() => input.current?.click()}>{preview ? 'Retake' : 'Take'} {side} photo</Button>
    <input ref={input} type="file" accept="image/*" capture="environment" aria-label={`${label} photo`} className={styles.input} disabled={disabled}
      onChange={event => {
        const file = event.target.files?.[0];
        if (file) { setPreview(URL.createObjectURL(file)); onChange(file); }
      }} />
  </div>;
}
