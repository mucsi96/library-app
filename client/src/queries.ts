import { queryOptions } from '@tanstack/react-query';
import { fetchJson, itemSchema, jobSchema, librarySchema } from './api';

export const itemsQuery = queryOptions({
  queryKey: ['items'], queryFn: ({ signal }) => fetchJson('/api/items', itemSchema.array(), { signal }),
});
export const librariesQuery = queryOptions({
  queryKey: ['libraries'], queryFn: ({ signal }) => fetchJson('/api/libraries', librarySchema.array(), { signal }),
});
export const jobsQuery = queryOptions({
  queryKey: ['import-jobs'], queryFn: ({ signal }) => fetchJson('/api/import-jobs', jobSchema.array(), { signal }),
});
