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

export const signOut = async () => {
  await client().auth.signOut();
  clearSyncState();
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
