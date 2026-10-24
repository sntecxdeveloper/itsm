import api from '../api/axios';
import { getMaster, saveMaster, type Master } from '../api/masterApi';
import { loadCategories } from './categoryStore';
import { loadCategoryGroups, subcategoryKey } from './categoryGroupStore';
import { getIssues } from './issueStore';
import { PRIORITY_MATRIX_KEY } from './priorityMatrixStore';

/**
 * Keeps the Setup settings on the server, so everyone sees what the administrator configured.
 *
 * The categories, items, group per category and the priority table are database tables (itsm_categories ... , see the master
 * functions below); the other Setup stores (channels, rules, SLAs, ...) are documents. They all read and write these browser
 * keys. This module makes the server the source of truth:
 *  - on sign-in the server's values are copied into the browser keys, so the stores keep reading them synchronously;
 *  - for an administrator, every later write to one of these keys is also sent to the server (admin-only endpoint);
 *  - an administrator's browser holding settings the server does not have yet uploads them once (the earlier,
 *    browser-only setups are kept), while for everyone else such a stale copy is dropped.
 */
const MANAGED: Record<string, string> = {
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

/** The browser keys of the lists that live in the master tables; one change to any of them saves the whole master. */
const MASTER_KEYS = ['dex.setup.categories', 'dex.setup.issues', 'dex.setup.categoryGroups'];
const MASTER_TIMER = 'master';
const isMasterKey = (key: string) => MASTER_KEYS.includes(key);

/** What the browser currently holds of the master lists, in the shape the server stores them. */
function masterFromBrowser(): Master {
  const groups = loadCategoryGroups();
  return {
    categories: loadCategories().map((c) => ({
      name: c.name,
      group: groups[c.name] ?? null,
      subcategories: c.subcategories.map((s) => ({ name: s, group: groups[subcategoryKey(c.name, s)] ?? null, items: getIssues(s) })),
    })),
  };
}

/** Copies the server's master lists into the browser keys the stores read. */
/** Also used after an import, which has just saved these lists. */
export function masterToBrowser(master: Master) {
  const issues: Record<string, string[]> = {};
  const groups: Record<string, string> = {};
  for (const c of master.categories) {
    if (c.group) groups[c.name] = c.group;
    for (const s of c.subcategories) {
      if (s.group) groups[subcategoryKey(c.name, s.name)] = s.group;
      // The incident form keys items by subcategory name, so the same name under two categories shares one list.
      issues[s.name] = [...new Set([...(issues[s.name] ?? []), ...s.items])];
    }
  }
  rawSet.call(window.localStorage, 'dex.setup.categories', JSON.stringify(master.categories.map((c) => ({ name: c.name, subcategories: c.subcategories.map((s) => s.name) }))));
  rawSet.call(window.localStorage, 'dex.setup.issues', JSON.stringify(issues));
  rawSet.call(window.localStorage, 'dex.setup.categoryGroups', JSON.stringify(groups));
  if (master.priorityMatrix?.length) rawSet.call(window.localStorage, PRIORITY_MATRIX_KEY, JSON.stringify(master.priorityMatrix));
}

function pushMaster() {
  clearTimeout(timers.get(MASTER_TIMER));
  timers.set(
    MASTER_TIMER,
    setTimeout(() => {
      saveMaster(masterFromBrowser()).catch((e) => console.warn('Could not save the categories to the server', e));
    }, 500),
  );
}

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
    if (canWrite && this === window.localStorage && (key in MANAGED || isMasterKey(key))) {
      try {
        JSON.parse(value);
        if (isMasterKey(key)) pushMaster();
        else push(key, value);
      } catch {
        /* not JSON: it is not one of ours */
      }
    }
  };
  Storage.prototype.removeItem = function (key: string) {
    rawRemove.call(this, key);
    if (canWrite && this === window.localStorage && key in MANAGED) push(key, null);
    // A reset of the categories or items: the stores fall back to their defaults, which become the saved lists.
    else if (canWrite && this === window.localStorage && isMasterKey(key)) pushMaster();
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
  // The category, item, group and priority lists come from their own tables.
  try {
    const master = await getMaster();
    if (master.categories.length > 0) masterToBrowser(master);
  } catch {
    /* the browser's own copy is used */
  }
  canWrite = canEdit;
  installWriteThrough();
}
