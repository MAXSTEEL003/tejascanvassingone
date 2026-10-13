import { getCollectionDocs, setCollectionDoc, deleteCollectionDoc } from '../lib/firebase';

export type NotificationType = 'price_increase' | 'price_drop' | 'reminder' | 'new_stock' | 'announcement';

export interface BroadcastNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  variety?: string;
  rateChange?: string;
  targetAudience?: 'all' | 'inactive_merchants';
  createdAt: string;
  expiresAt?: string;
}

const STORAGE_KEY = 'broadcast_notifications';
const READ_STORAGE_KEY = 'read_notifications_ids';

const DEFAULT_NOTICES: BroadcastNotification[] = [
  {
    id: 'NOTIF-WELCOME',
    title: 'Welcome to Tejas Canvassing',
    message: 'Direct ex-mill wholesale rates are live for all premier APMC paddy and rice lots.',
    type: 'announcement',
    targetAudience: 'all',
    createdAt: new Date().toISOString()
  }
];

export function getReadNotificationIds(): string[] {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markNotificationAsRead(id: string): void {
  try {
    const current = getReadNotificationIds();
    if (!current.includes(id)) {
      const updated = [...current, id];
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('broadcast-notifications-read'));
    }
  } catch (e) {
    console.warn('Failed to mark notification as read:', e);
  }
}

export function markAllNotificationsAsRead(ids: string[]): void {
  try {
    const current = new Set(getReadNotificationIds());
    ids.forEach(id => current.add(id));
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(current)));
    window.dispatchEvent(new Event('broadcast-notifications-read'));
  } catch (e) {
    console.warn('Failed to mark all notifications as read:', e);
  }
}

export async function getBroadcastNotifications(): Promise<BroadcastNotification[]> {
  // 1. Read cached locally first for immediate responsiveness
  let localList: BroadcastNotification[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      localList = JSON.parse(raw);
    }
  } catch {}

  // 2. Fetch fresh from Firestore
  try {
    const cloudDocs = await getCollectionDocs('broadcast_notifications').catch(() => []);
    if (cloudDocs && cloudDocs.length > 0) {
      const mergedMap = new Map<string, BroadcastNotification>();
      cloudDocs.forEach((doc: any) => {
        if (doc && doc.id) {
          mergedMap.set(String(doc.id).trim(), {
            id: String(doc.id).trim(),
            title: doc.title || 'Market Announcement',
            message: doc.message || '',
            type: doc.type || 'announcement',
            variety: doc.variety || '',
            rateChange: doc.rateChange || '',
            targetAudience: doc.targetAudience || 'all',
            createdAt: doc.createdAt || new Date().toISOString(),
            expiresAt: doc.expiresAt || ''
          });
        }
      });
      const result = Array.from(mergedMap.values()).sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      return result;
    }
  } catch (err) {
    console.warn('Firestore broadcast_notifications read error:', err);
  }

  if (localList.length > 0) {
    return localList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return DEFAULT_NOTICES;
}

export async function createBroadcastNotification(
  data: Omit<BroadcastNotification, 'id' | 'createdAt'>
): Promise<BroadcastNotification> {
  const newId = `NOTIF-${Date.now()}`;
  const notice: BroadcastNotification = {
    ...data,
    id: newId,
    createdAt: new Date().toISOString()
  };

  try {
    // 1. Save to local storage
    const current = await getBroadcastNotifications();
    const updated = [notice, ...current.filter(n => n.id !== newId)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // 2. Save to Firestore
    await setCollectionDoc('broadcast_notifications', newId, notice);

    // 3. Dispatch real-time events
    window.dispatchEvent(new Event('broadcast-notifications-updated'));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Failed to create broadcast notification:', err);
  }

  return notice;
}

export async function deleteBroadcastNotification(id: string): Promise<void> {
  try {
    const current = await getBroadcastNotifications();
    const filtered = current.filter(n => n.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

    await deleteCollectionDoc('broadcast_notifications', id).catch(() => {});

    window.dispatchEvent(new Event('broadcast-notifications-updated'));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Failed to delete broadcast notification:', err);
  }
}

export function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return 'Recently';
  }
}
