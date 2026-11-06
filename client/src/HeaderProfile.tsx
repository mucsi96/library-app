import { useQuery } from '@tanstack/react-query';
import { Button, Menu, MenuItem, MenuPopover, MenuTrigger } from '@mucsi96/react-ui';
import { fetchJson, userSchema } from './api';

export function HeaderProfile() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: ({ signal }) => fetchJson('/oauth2/userinfo', userSchema, { signal }) });
  if (profile.isError) return <Button variant="text" onPress={() => { void profile.refetch(); }}>Retry profile</Button>;
  if (!profile.data) return null;
  const name = (profile.data.additionalClaims?.name ?? profile.data.preferredUsername ?? profile.data.email).trim();
  const initials = name.split(/\s+/).map(part => part[0]).join('').toUpperCase();
  return <MenuTrigger><Button variant="avatar" aria-label={initials}>{initials}</Button>
    <MenuPopover><Menu aria-label="Profile"><MenuItem>{name}</MenuItem></Menu></MenuPopover>
  </MenuTrigger>;
}
