import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  cloudConfigured,
  fetchBackup,
  fingerprint,
  getSession,
  onAuthChange,
  pushBackup,
  readSyncState,
  writeSyncState
} from '../infrastructure/cloud';
import type { BackupPayload } from '../domain/types';

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'synced' | 'error';

interface Options {
  exportBackup: () => Promise<BackupPayload>;
  importBackup: (payload: BackupPayload) => Promise<void>;
  onPulled: () => void;
}

/**
 * Whole-snapshot, last-write-wins sync. The local database stays the source
 * of truth for the UI; the cloud holds one copy per account.
 */
export function useCloudSync({ exportBackup, importBackup, onPulled }: Options) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!cloudConfigured);
  const [status, setStatus] = useState<SyncStatus>(cloudConfigured ? 'idle' : 'off');
  const [message, setMessage] = useState<string | null>(null);
  const running = useRef(false);
  const userId = session?.user.id;

  useEffect(() => {
    if (!cloudConfigured) return;
    void getSession().then(setSession).finally(() => setReady(true));
    return onAuthChange(setSession);
  }, []);

  const sync = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!userId || running.current) return;
    running.current = true;
    setStatus('syncing');
    setMessage(null);
    try {
      const local = await exportBackup();
      const hash = fingerprint(local);
      const state = readSyncState();
      const cloud = await fetchBackup();
      const dirty = !state || state.hash !== hash;

      if (!cloud) {
        const cloudAt = await pushBackup(userId, local);
        writeSyncState({ cloudAt, hash });
      } else if (state && state.cloudAt === cloud.updatedAt) {
        if (dirty) {
          const cloudAt = await pushBackup(userId, local);
          writeSyncState({ cloudAt, hash });
        }
      } else {
        // The cloud changed since this device last synced (or this device is new).
        const cloudHash = fingerprint(cloud.payload);
        const localEmpty = local.routines.length + local.goals.length + local.notes.length === 0;
        let pull = !dirty || localEmpty || cloudHash === hash;
        if (!pull && !opts.silent) {
          pull = window.confirm(
            'В облаке есть другая версия данных.\n\nОК — взять облачную (данные на этом устройстве будут заменены).\n'
            + 'Отмена — оставить данные этого устройства и перезаписать облако.'
          );
        } else if (!pull && opts.silent) {
          setStatus('idle');
          setMessage('Нужно выбрать версию — нажмите «Синхронизировать».');
          return;
        }
        if (pull) {
          if (cloudHash !== hash) {
            await importBackup(cloud.payload);
            onPulled();
          }
          writeSyncState({ cloudAt: cloud.updatedAt, hash: cloudHash });
        } else {
          const cloudAt = await pushBackup(userId, local);
          writeSyncState({ cloudAt, hash });
        }
      }
      setStatus('synced');
    } catch (cause) {
      setStatus('error');
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      running.current = false;
    }
  }, [userId, exportBackup, importBackup, onPulled]);

  // Pull on sign-in / open; push when the app is backgrounded.
  useEffect(() => {
    if (!userId) return;
    void sync({ silent: true });
    const onHide = () => {
      if (document.visibilityState === 'hidden') void sync({ silent: true });
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [userId, sync]);

  return { session, ready, status, message, sync: () => sync() };
}
