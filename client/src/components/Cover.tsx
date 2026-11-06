import { useState } from 'react';
import type { LoanItem } from '../api';
import styles from './Cover.module.css';

export function Cover({ item, photo, large = false }: { item: Pick<LoanItem, 'isbn' | 'title' | 'mediaType'>; photo?: string; large?: boolean }) {
  const url = photo ?? (item.isbn ? `/api/thumbnails/${item.isbn}` : null);
  return <CoverImage key={url} url={url} title={item.title} mediaType={item.mediaType} large={large} />;
}

function CoverImage({ url, title, mediaType, large }: { url: string | null; title: string; mediaType: string; large: boolean }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return <div className={`${styles.cover} ${large ? styles.large : ''}`}>
    {url && !failed ? <img src={url} alt={`Cover of "${title}"`} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className={loaded ? '' : styles.loading} />
      : <span aria-hidden="true">{mediaType === 'BOOK' ? '▤' : mediaType === 'CD' ? '◉' : '▶'}</span>}
  </div>;
}
