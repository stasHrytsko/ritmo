import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { parseBackup } from '../domain/backup';
import type { BackupPayload } from '../domain/types';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const cloudConfigured = Boolean(URL && KEY);

export const supabase: SupabaseClient | null = cloudConfigured
  ? createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

const client = () => {
  if (!supabase) throw new Error('Облако не настроено.');
  return supabase;
};

export const getSession = async (): Promise<Session | null> =>
  supabase ? (await supabase.auth.getSession()).data.session : null;

export const onAuthChange = (listener: (session: Session | null) => void) => {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(session));
  return () => data.subscription.unsubscribe();
};

/** Sends a one-time code (and link) to the address; creates the account if new. */
export const requestCode = async (email: string, name?: string) => {
  const { error } = await client().auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: name ? { name } : undefined,
      emailRedirectTo: window.location.origin + window.location.pathname
    }
  });
  if (error) throw error;
};

export const verifyCode = async (email: string, token: string) => {
  const { error } = await client().auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
};

/** Deletes the signed-in account and its cloud data for good. */
export const deleteAccount = async () => {
  const { error } = await client().rpc('delete_my_account');
  if (error) throw error;
  // The session now points at a user that no longer exists; drop it locally.
  await client().auth.signOut({ scope: 'local' }).catch(() => undefined);
  clearSyncState();
  clearOwner();
};

export const signOut = async () => {
  await client().auth.signOut();
  clearSyncState();
  clearOwner();
};

export interface CloudBackup {
  payload: BackupPayload;
  updatedAt: string;
}

export const fetchBackup = async (): Promise<CloudBackup | null> => {
  const { data, error } = await client()
    .from('user_backups')
    .select('payload, updated_at')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { payload: parseBackup(data.payload), updatedAt: data.updated_at as string };
};

/** Returns the server timestamp of the write. */
export const pushBackup = async (userId: string, payload: BackupPayload): Promise<string> => {
  const updatedAt = new Date().toISOString();
  const { error } = await client()
    .from('user_backups')
    .upsert({ user_id: userId, payload, updated_at: updatedAt });
  if (error) throw error;
  return updatedAt;
};

/** exportedAt changes on every export, so it must not count as a change. */
export const fingerprint = (payload: BackupPayload) => {
  const text = JSON.stringify({ ...payload, exportedAt: '' });
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return `${text.length}:${hash}`;
};

const SYNC_KEY = 'ritmo.sync';

export interface SyncState {
  cloudAt: string;
  hash: string;
}

export const readSyncState = (): SyncState | null => {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    return raw ? (JSON.parse(raw) as SyncState) : null;
  } catch {
    return null;
  }
};

export const writeSyncState = (state: SyncState) => {
  try { localStorage.setItem(SYNC_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
};

export const clearSyncState = () => {
  try { localStorage.removeItem(SYNC_KEY); } catch { /* storage unavailable */ }
};

export const AVATARS = ['m1', 'm2', 'f1', 'f2'] as const;
export type AvatarKind = (typeof AVATARS)[number];
export type ReminderMode = 'off' | 'morning' | 'evening' | 'each';

export interface Profile {
  name: string;
  avatar: AvatarKind;
  reminder: ReminderMode;
}

/** Accounts made before there were four avatars stored 'male' or 'female'. */
const avatarOf = (value: unknown): AvatarKind => {
  if ((AVATARS as readonly unknown[]).includes(value)) return value as AvatarKind;
  return value === 'female' ? 'f1' : 'm2';
};

export const profileOf = (session: Session): Profile => {
  const meta = session.user.user_metadata ?? {};
  return {
    name: typeof meta.name === 'string' ? meta.name : '',
    avatar: avatarOf(meta.avatar),
    reminder: ['morning', 'evening', 'each'].includes(meta.reminder as string)
      ? (meta.reminder as ReminderMode)
      : 'off'
  };
};

export const saveProfile = async (profile: Profile) => {
  const { error } = await client().auth.updateUser({ data: { ...profile } });
  if (error) throw error;
};

/** Supabase sends a confirmation to the new address; the change applies once confirmed. */
export const changeEmail = async (email: string) => {
  const { error } = await client().auth.updateUser({ email });
  if (error) throw error;
};

const OWNER_KEY = 'ritmo.owner';

/** Which account the data on this device belongs to; null for data made without one. */
export const readOwner = (): string | null => {
  try { return localStorage.getItem(OWNER_KEY); } catch { return null; }
};

export const writeOwner = (userId: string) => {
  try { localStorage.setItem(OWNER_KEY, userId); } catch { /* storage unavailable */ }
};

export const clearOwner = () => {
  try { localStorage.removeItem(OWNER_KEY); } catch { /* storage unavailable */ }
};

/**
 * Supabase speaks English; people here read Russian. Known cases get a plain
 * sentence, anything else a calm fallback rather than a raw server string.
 */
export const describeAuthError = (cause: unknown): string => {
  const error = cause as { code?: string; status?: number; message?: string } | null;
  const code = error?.code ?? '';
  const message = (error?.message ?? String(cause)).toLowerCase();

  if (code === 'otp_expired' || message.includes('expired') || (message.includes('invalid') && message.includes('token'))) {
    return 'Код неверный или устарел. Проверьте письмо или запросите новый код.';
  }
  if (code.includes('rate_limit') || error?.status === 429 || message.includes('rate limit')) {
    return 'Слишком много попыток подряд. Подождите минуту и попробуйте снова.';
  }
  if (code === 'email_address_invalid' || (message.includes('email') && message.includes('invalid'))) {
    return 'Проверьте адрес почты — кажется, в нём опечатка.';
  }
  if (message.includes('failed to fetch') || message.includes('network') || message.includes('load failed')) {
    return 'Нет соединения с интернетом. Проверьте сеть и попробуйте ещё раз.';
  }
  return 'Не получилось. Попробуйте ещё раз чуть позже.';
};
