import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { describeBackup } from '../domain/backup';
import { askConfirm } from './components/confirm';
import {
  cloudConfigured,
  describeAuthError,
  fetchBackup,
  fingerprint,
  getSession,
  onAuthChange,
  pushBackup,
  readOwner,
  readSyncState,
  signOut,
  writeOwner,
  writeSyncState
} from '../infrastructure/cloud';
import type { BackupPayload } from '../domain/types';

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'synced' | 'error';

interface Options {
  exportBackup: () => Promise<BackupPayload>;
  importBackup: (payload: BackupPayload) => Promise<void>;
  /** Wipes this device back to a brand-new install. */
  resetLocal: () => Promise<void>;
  onPulled: () => void;
}

const hasData = (backup: BackupPayload) =>
  backup.routines.length + backup.goals.length + backup.notes.length + backup.completions.length > 0;

/**
 * Whole-snapshot, last-write-wins sync. The local database stays the source
 * of truth for the UI; the cloud holds one copy per account.
 *
 * Data on a device belongs to one account at a time. Another account signing
 * in never sees it, and never uploads it: the device is wiped for them first.
 */
export function useCloudSync({ exportBackup, importBackup, resetLocal, onPulled }: Options) {
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

  /** Resolves true when the device and the cloud agree afterwards. */
  const sync = useCallback(async (opts: { silent?: boolean } = {}): Promise<boolean> => {
    if (!userId || running.current) return false;
    running.current = true;
    setStatus('syncing');
    setMessage(null);
    try {
      let owner = readOwner();
      const priorState = readSyncState();
      // Signed in before owners were recorded: that data is this account's.
      if (!owner && priorState) {
        owner = userId;
        writeOwner(userId);
      }

      // Another account's data is on this device: it stays in their cloud,
      // and this account starts from a clean slate.
      if (owner && owner !== userId) {
        await resetLocal();
        writeSyncState({ cloudAt: '', hash: '' });
        onPulled();
        owner = null;
      }

      const anonymous = owner === null && !readSyncState()?.hash && hasData(await exportBackup());
      // Data made before any account existed is the one case worth asking about.
      const interactive = !opts.silent || anonymous;

      const local = await exportBackup();
      const hash = fingerprint(local);
      const state = readSyncState();
      const cloud = await fetchBackup();
      const dirty = !state || state.hash !== hash;

      if (!cloud) {
        if (anonymous && interactive) {
          const keep = await askConfirm({
            title: 'На этом устройстве уже есть данные',
            body: `${describeBackup(local)}. Перенести их в этот аккаунт или начать с чистого листа? При чистом листе данные с устройства будут удалены.`,
            confirm: 'Перенести в аккаунт',
            cancel: 'Начать с чистого листа'
          });
          if (keep === null) {
            setStatus('idle');
            return false;
          }
          if (!keep) {
            await resetLocal();
            onPulled();
          }
        }
        const fresh = await exportBackup();
        const cloudAt = await pushBackup(userId, fresh);
        writeSyncState({ cloudAt, hash: fingerprint(fresh) });
      } else if (state && state.cloudAt === cloud.updatedAt) {
        if (dirty) {
          const cloudAt = await pushBackup(userId, local);
          writeSyncState({ cloudAt, hash });
        }
      } else {
        // The cloud changed since this device last synced (or this device is new).
        const cloudHash = fingerprint(cloud.payload);
        let pull = !dirty || !hasData(local) || cloudHash === hash;
        if (!pull && interactive) {
          const choice = await askConfirm({
            title: 'Данные отличаются',
            body: 'В облаке и на этом устройстве разные версии. Какую оставить? Другая будет заменена.',
            confirm: 'Взять из облака',
            cancel: 'Оставить с устройства'
          });
          if (choice === null) {
            setStatus('idle');
            setMessage('Нужно выбрать версию — нажмите «Синхронизировать».');
            return false;
          }
          pull = choice;
        } else if (!pull) {
          setStatus('idle');
          setMessage('Нужно выбрать версию — нажмите «Синхронизировать».');
          return false;
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
      writeOwner(userId);
      setStatus('synced');
      return true;
    } catch (cause) {
      setStatus('error');
      setMessage(describeAuthError(cause));
      return false;
    } finally {
      running.current = false;
    }
  }, [userId, exportBackup, importBackup, resetLocal, onPulled]);

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

  /**
   * Leaving the account takes its data off this device, so the next person to
   * sign in starts clean. Everything is saved to the cloud first.
   */
  const leave = useCallback(async () => {
    const sure = await askConfirm({
      title: 'Выйти из аккаунта?',
      body: 'Данные сохранены в облаке и вернутся при следующем входе. С этого устройства они будут удалены.',
      confirm: 'Выйти'
    });
    if (!sure) return;

    const saved = await sync();
    if (!saved) {
      const anyway = await askConfirm({
        title: 'Не удалось сохранить в облако',
        body: 'Если выйти сейчас, изменения, сделанные на этом устройстве после последней синхронизации, пропадут.',
        confirm: 'Всё равно выйти',
        danger: true
      });
      if (!anyway) return;
    }

    try {
      await signOut();
      await resetLocal();
    } finally {
      window.location.reload();
    }
  }, [sync, resetLocal]);

  return { session, ready, status, message, sync: () => sync(), leave };
}
