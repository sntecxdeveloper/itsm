/** A group of devices or an organization whose agent the caller may customize. */
export interface CustomizationTarget {
  type: 'group' | 'organization';
  id: number;
  name: string;
  detail?: string | null;
  devices: number;
  managed: boolean;
  canEdit: boolean;
}

/** The order of what the agent shows: the sidebar tabs ("tabs") and, per tab, its features (the key is the tab). */
export interface CustomizationLayout {
  locked: boolean;
  order: Record<string, string[]>;
  /** Agent colors: primary, sidebar, background (hex). */
  theme?: Record<string, string>;
}

export interface Customization {
  type: 'group' | 'organization';
  id: number;
  name: string;
  managed: boolean;
  hidden: string[];
  layout: CustomizationLayout | null;
  /** While a staged rollout runs: the share of the devices that has the new view. */
  pilotPercent?: number | null;
  version?: number;
  updatedBy?: string | null;
  updatedAt?: string | null;
}
