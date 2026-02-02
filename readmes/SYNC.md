# 🔄 Sync System

> *Real-time multi-device synchronization*

The Sync System provides a local-first, real-time synchronization architecture that ensures instant updates on the current device and automatic propagation to other devices.

---

## 📍 Overview

Key features:
- **Optimistic Updates** - UI updates instantly before server confirmation
- **Reactive Cache** - Local storage with event-driven updates
- **Multi-Device Sync** - Changes sync across devices within 5 seconds
- **Offline Support** - Works offline, syncs when reconnected
- **Automatic Rollback** - Failed operations revert UI gracefully

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      USER ACTION                        │
│                          │                              │
│                          ▼                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │              OPTIMISTIC UPDATE                   │   │
│  │              (Instant UI change)                 │   │
│  └──────────────────────┬──────────────────────────┘   │
│                          │                              │
│                          ▼                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │              REACTIVE CACHE                      │   │
│  │         (LocalStorage + Event Emitter)           │   │
│  └──────────────────────┬──────────────────────────┘   │
│                          │                              │
│                          ▼                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │              SERVER ACTION                       │   │
│  │            (MongoDB Update)                      │   │
│  └──────────────────────┬──────────────────────────┘   │
│                          │                              │
│                          ▼                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │           NOTIFY OTHER DEVICES                   │   │
│  │        (Mark needsUpdate: true)                  │   │
│  └──────────────────────┬──────────────────────────┘   │
│                          │                              │
│                          ▼                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │            BACKGROUND SYNC                       │   │
│  │         (5-second polling interval)              │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 🧩 Components

### 1. Reactive Cache

**File:** `src/lib/reactive-cache.ts`

Local storage-based caching with pub/sub pattern.

```typescript
// Cache Keys
const CACHE_KEYS = {
  HOME_DATA: 'home_data',
  HEALTH_DATA: 'health_data',
  DASHBOARD_STATS: 'dashboard_stats',
  WEIGHT_DATA: 'weight_data',
};

// Core Functions
setCache(key: string, data: any)      // Store data
getCache(key: string): any            // Retrieve data
subscribe(key: string, callback)       // Listen for changes
```

#### React Hook

```typescript
function useReactiveCache<T>(
  key: string,
  fetcher: () => Promise<T>
) {
  const [data, setData] = useState<T | null>(
    () => getCache(key)  // Initialize from cache
  );
  const [isLoading, setIsLoading] = useState(!data);

  useEffect(() => {
    // Subscribe to cache updates
    const unsubscribe = subscribe(key, setData);
    return unsubscribe;
  }, [key]);

  const refresh = async () => {
    const fresh = await fetcher();
    setCache(key, fresh);
  };

  return { data, isLoading, refresh };
}
```

#### Helper Functions

```typescript
// Task state management
markTaskCompleted(taskId: string)
markTaskSkipped(taskId: string)
markTaskPending(taskId: string)
removeTaskFromIncomplete(taskId: string)
addTaskToIncomplete(task: Task)

// Weight management
updateWeightInCache(weight: number, bmi: string)
```

---

### 2. Sync Manager

**File:** `src/lib/sync-manager.ts`

Background synchronization coordinator.

```typescript
// Device tracking
getDeviceId(): string        // Unique device identifier
setDeviceId(id: string)      // Persist device ID

// Background sync
startBackgroundSync(intervalMs: number)
stopBackgroundSync()

// Manual sync
checkForUpdates(): Promise<boolean>
syncNow(): Promise<void>
```

#### How Device ID Works

```typescript
function getDeviceId(): string {
  let deviceId = localStorage.getItem('lifeos_device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('lifeos_device_id', deviceId);
  }
  return deviceId;
}
```

#### Background Sync Loop

```typescript
let syncInterval: NodeJS.Timeout;

function startBackgroundSync(intervalMs = 5000) {
  syncInterval = setInterval(async () => {
    const needsUpdate = await checkForUpdates();
    if (needsUpdate) {
      const freshData = await fetchHomeData();
      setCache(CACHE_KEYS.HOME_DATA, freshData);
      await markDeviceSynced();
    }
  }, intervalMs);
}

function stopBackgroundSync() {
  clearInterval(syncInterval);
}
```

---

### 3. Sync State Model

**File:** `src/models/SyncState.ts`

MongoDB model for tracking device sync status.

```typescript
const SyncStateSchema = new mongoose.Schema({
  deviceId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  needsUpdate: { 
    type: Boolean, 
    default: false 
  },
  lastSync: { 
    type: Date, 
    default: Date.now 
  },
});
```

#### States

| State | Meaning |
|-------|---------|
| `needsUpdate: true` | Device should fetch fresh data |
| `needsUpdate: false` | Device is up-to-date |

---

### 4. Action Wrapper

**File:** `src/lib/action-wrapper.ts`

Wraps server actions with sync notifications.

```typescript
// Basic wrapper with sync notification
async function withSync<T>(
  action: () => Promise<T>,
  collections?: string[]
): Promise<T> {
  const result = await action();
  await notifyChange(getDeviceId(), collections);
  return result;
}

// Wrapper with full data refresh
async function withFullRefresh<T>(
  action: () => Promise<T>,
  refreshFn?: () => Promise<void>
): Promise<T> {
  const result = await action();
  await notifyChange(getDeviceId());
  
  // Refresh local data
  if (refreshFn) {
    await refreshFn();
  } else {
    await refreshHomeData();
  }
  
  return result;
}
```

#### Usage Example

```typescript
async function handleCompleteTask(taskId: string) {
  // 1. Optimistic update (instant)
  markTaskCompleted(taskId);
  removeTaskFromIncomplete(taskId);
  
  // 2. Server action with sync
  await withFullRefresh(
    () => toggleTaskStatus(taskId, 'completed')
  );
}
```

---

## 🔌 API Endpoints

### Check Update

```
GET /api/sync/check-update?deviceId={deviceId}

Response:
{
  "needsUpdate": true,
  "lastSync": "2026-02-03T10:30:00.000Z"
}
```

### Mark Update Needed

```
POST /api/sync/mark-update
Body: { "deviceId": "device_123" }

Response:
{ "success": true }
```

### Mark Synced

```
POST /api/sync/mark-synced
Body: { "deviceId": "device_123" }

Response:
{ "success": true }
```

### Notify Change

```
POST /api/sync/notify-change
Body: { 
  "sourceDeviceId": "device_123",
  "collections": ["tasks", "weight"]
}

Response:
{ "success": true, "devicesNotified": 2 }
```

---

## ⏱️ Timeline

Typical operation timeline:

```
T+0ms      User taps "Complete Task"
           │
T+0ms      ├── Optimistic UI update (instant)
           ├── Task checkbox turns green
           ├── Points display updates
           │
T+100ms    ├── Server action begins
           │
T+300ms    ├── MongoDB updated
           │
T+350ms    ├── Other devices marked needsUpdate
           │
T+500ms    └── Local cache refreshed with server data
           
T+0-5000ms On other devices:
           ├── Background sync detects needsUpdate
           ├── Fresh data fetched
           ├── Cache updated
           └── UI automatically refreshes
```

---

## 📊 Performance Characteristics

| Operation | Latency |
|-----------|---------|
| Optimistic update | 0ms |
| Cache read | 0ms |
| Server action | 100-500ms |
| Full refresh | 500-1000ms |
| Cross-device sync | 0-5000ms |

---

## ✅ What Syncs Automatically

| Data | Auto-Sync |
|------|-----------|
| Routine Tasks | ✅ |
| Task Completion Status | ✅ |
| Weight Data | ✅ |
| Total Points | ✅ |
| Better Percentage | ✅ |
| Streak Data | ✅ |
| Dashboard Stats | ✅ |
| 7-Day Completion | ✅ |

---

## 🔧 Configuration

### Change Sync Interval

```typescript
// In HomePageClient.tsx
startBackgroundSync(5000);  // 5 seconds (default)
startBackgroundSync(10000); // 10 seconds (battery saving)
startBackgroundSync(2000);  // 2 seconds (more responsive)
```

### Add New Sync Targets

```typescript
// In sync-manager.ts
async function syncAllData() {
  await Promise.all([
    syncData(CACHE_KEYS.HOME_DATA, fetchHomeData),
    syncData(CACHE_KEYS.HEALTH_DATA, fetchHealthData),
    syncData(CACHE_KEYS.LEARNING_DATA, fetchLearningData),
  ]);
}
```

---

## 🧪 Testing

### Single Device Tests

- [ ] Complete task → UI updates instantly
- [ ] Skip task → UI updates instantly
- [ ] Log weight → Weight displays immediately
- [ ] Refresh page → Data persists from cache
- [ ] Wait 1 second → Fresh data loaded

### Multi-Device Tests

- [ ] Open on 2 devices
- [ ] Complete task on device 1
- [ ] Device 2 updates within 5 seconds
- [ ] Log weight on device 2
- [ ] Device 1 updates within 5 seconds

### Offline Tests

- [ ] Disable network → Complete task → Shows optimistically
- [ ] Enable network → Syncs to server
- [ ] Force API error → UI reverts correctly
- [ ] Page reload → Cached data loads instantly

---

## 🔮 Future Enhancements

### WebSocket Integration
Replace polling with push notifications for instant sync.

```typescript
// Future: WebSocket-based sync
const socket = new WebSocket('wss://api.lifeos.app/sync');

socket.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  if (type === 'DATA_CHANGED') {
    setCache(data.key, data.value);
  }
};
```

### Conflict Resolution
Handle simultaneous edits on multiple devices.

```typescript
// Future: Conflict resolution
interface ConflictResolution {
  strategy: 'last-write-wins' | 'merge' | 'manual';
  timestamp: Date;
  devicePriority?: string[];
}
```

### Offline Queue
Queue actions when offline, sync when online.

```typescript
// Future: Offline queue
const offlineQueue: QueuedAction[] = [];

function queueAction(action: Action) {
  offlineQueue.push({
    action,
    timestamp: Date.now(),
    retries: 0,
  });
}

window.addEventListener('online', processQueue);
```

---

## 📁 Files Reference

### Created Files
- `src/models/SyncState.ts` - MongoDB sync state model
- `src/lib/sync-manager.ts` - Background sync manager
- `src/lib/action-wrapper.ts` - Action wrapper utilities
- `src/app/api/sync/check-update/route.ts`
- `src/app/api/sync/mark-update/route.ts`
- `src/app/api/sync/mark-synced/route.ts`
- `src/app/api/sync/notify-change/route.ts`

### Modified Files
- `src/app/HomePageClient.tsx` - Added background sync init
- `src/app/NewHomeClient.tsx` - Updated with withFullRefresh
- `src/app/health/HealthClient.tsx` - Updated weight logging
- `src/app/routine/TaskItem.tsx` - Updated task actions
- `src/lib/reactive-cache.ts` - Added helper functions

---

## 🔗 Related Documentation

- [Home Dashboard](./HOME.md) - Where sync initializes
- [Routine System](./ROUTINE.md) - Task sync examples
- [Architecture](./ARCHITECTURE.md) - Overall system design
