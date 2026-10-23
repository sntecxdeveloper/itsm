import api from '../api/axios';

/**
 * Keeps the Setup settings on the server, so everyone sees what the administrator configured.
 *
 * The Setup stores (categories, items, group per category, channels, rules, SLAs, ...) read and write these browser
 * keys. This module makes the server the source of truth:
 *  - on sign-in the server's values are copied into the browser keys, so the stores keep reading them synchronously;
 *  - for an administrator, every later write to one of these keys is also sent to the server (admin-only endpoint);
 *  - an administrator's browser holding settings the server does not have yet uploads them once (the earlier,
 *    browser-only setups are kept), while for everyone else such a stale copy is dropped.
 */
const MANAGED: Record<string, string> = {
  'dex.setup.categories': 'categories',
  'dex.setup.issues': 'issues',
  'dex.setup.categoryGroups': 'categoryGroups',
  'dex.setup.incidentForm': 'incidentForm',
  'dex.catalog.services': 'services',
  'dex.businessRules.v1': 'businessRules',
  'dex.notificationTemplates.v2': 'notificationTemplates',
  'dex.notificationRules.v1': 'notificationRules',
  'dex.slaDefinitions.v1': 'slaDefinitions',
  'dex.incidentLifecycle.v1': 'incidentLifecycle',
  'dex.chatSettings.v1': 'chatSettings',
};

interface Envelope<T> {
  data: T;
}

let canWrite = false;
let patched = false;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const rawSet = Storage.prototype.setItem;
const rawRemove = Storage.prototype.removeItem;

function push(localKey: string, value: string | null) {
  const serverKey = MANAGED[localKey];
  clearTimeout(timers.get(localKey));
  // Typing in a Setup field saves on every keystroke: send the last value only.
  timers.set(
    localKey,
    setTimeout(() => {
      const request =
        value === null
          ? api.delete(`/setup/settings/${serverKey}`)
          : api.put(`/setup/settings/${serverKey}`, JSON.parse(value));
      request.catch((e) => console.warn(`Could not save the ${serverKey} setting to the server`, e));
    }, 500),
  );
}

/** Installed once: an administrator's writes to a managed key are also sent to the server. */
function installWriteThrough() {
  if (patched) return;
  patched = true;
  Storage.prototype.setItem = function (key: string, value: string) {
    rawSet.call(this, key, value);
    if (canWrite && this === window.localStorage && key in MANAGED) {
      try {
        JSON.parse(value);
        push(key, value);
      } catch {
        /* not JSON: it is not one of ours */
      }
    }
  };
  Storage.prototype.removeItem = function (key: string) {
    rawRemove.call(this, key);
    if (canWrite && this === window.localStorage && key in MANAGED) push(key, null);
  };
}

/** Loads the server's settings into this browser. If the server cannot be reached the browser's own copy is used. */
export async function hydrateSetupSettings(isAdmin: boolean, canEdit = isAdmin): Promise<void> {
  canWrite = false;
  let server: Record<string, unknown>;
  try {
    const response = await api.get<Envelope<Record<string, unknown>>>('/setup/settings');
    server = response.data.data ?? {};
  } catch {
    return;
  }
  for (const [localKey, serverKey] of Object.entries(MANAGED)) {
    try {
      if (serverKey in server) {
        rawSet.call(window.localStorage, localKey, JSON.stringify(server[serverKey]));
      } else if (isAdmin) {
        const local = window.localStorage.getItem(localKey);
        if (local) push(localKey, local); // first time: keep this browser's setup by uploading it
      } else {
        rawRemove.call(window.localStorage, localKey);
      }
    } catch {
      /* storage blocked: the stores fall back to their defaults */
    }
  }
  canWrite = canEdit;
  installWriteThrough();
}
