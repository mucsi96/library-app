import { Alert, Button } from '@mucsi96/react-ui';

export function QueryError({ error, retry }: { error: Error; retry?: () => void }) {
  return <Alert tone="error">{error.message}{retry && <Button variant="text" onPress={retry}>Retry</Button>}</Alert>;
}
