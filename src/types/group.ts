/** What sort of organisation unit a group is. Only a label and a filter. */
export type GroupKind = 'DEPARTMENT' | 'SITE' | 'REGION' | 'TEAM' | 'PROJECT' | 'CUSTOMER' | 'CUSTOM';

/** What a group holds. A technician group is what tickets are assigned to. */
export type GroupType = 'TECHNICIAN' | 'USER' | 'DEVICE';

export type GroupStatus = 'ACTIVE' | 'INACTIVE';

/** How the devices of a group are chosen: listed by hand, or by a rule. */
export type MembershipMode = 'STATIC' | 'DYNAMIC';

/** The three sections inside a group. */
export type GroupSection = 'DEVICE' | 'TECHNICIAN' | 'USER';

export type GroupHealth = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'EMPTY';

export interface GroupSummary {
  id: number;
  /** The organization (customer company) a device group belongs to. */
  organizationId?: number | null;
  organizationName?: string | null;
  name: string;
  description?: string | null;
  kind: GroupKind;
  membershipMode: MembershipMode;
  location?: string | null;
  region?: string | null;
  color?: string | null;
  icon?: string | null;
  deviceCount: number;
  online: number;
  offline: number;
  devicesWithIssues: number;
  openIssues: number;
  health: GroupHealth;
  technicianCount: number;
  userCount: number;
  /** Missing or null for a general group (and when the backend predates group types). */
  type?: GroupType | null;
  /** Missing means active. */
  status?: GroupStatus;
  /** True when this group chooses which agent features its devices show. */
  featuresManaged: boolean;
  hiddenFeatures: number;
  /** Keys of the agent tabs and features this group hides (empty when it hides nothing or is not managed). */
  hiddenFeatureKeys: string[];
  /** Days logs are kept for this group's devices; null means the platform default. */
  retentionDays?: number | null;
  autoAssignIssues: boolean;
  /** How many fixes the group allows; null means every approved fix. */
  allowedFixes?: number | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string;
}

export interface RuleCondition {
  field: string;
  op: string;
  value: string;
}

export interface GroupRule {
  match: 'ALL' | 'ANY';
  conditions: RuleCondition[];
}

/** What a group applies to its devices. */
export interface GroupPolicy {
  /** Days to keep logs; null means the platform default. */
  retentionDays: number | null;
  /** Fix keys the devices may use; null means every approved fix. */
  allowedScripts: string[] | null;
  /** New issues go to the least busy of the group's own technicians. */
  autoAssignIssues: boolean;
}

export interface GroupDetail {
  summary: GroupSummary;
  rule?: GroupRule | null;
  policy?: GroupPolicy | null;
  createdBy?: string | null;
  createdAt?: string;
}

export interface GroupDeviceMember {
  id: number;
  osVersion?: string | null;
  ipAddress?: string | null;
  agentVersion?: string | null;
  location?: string | null;
  region?: string | null;
  organizationId?: number | null;
  cpuModel?: string | null;
  ramGb?: number | null;
  diskGb?: number | null;
  agentId: string;
  hostname: string;
  os?: string | null;
  status?: string | null;
  lastHeartbeat?: string | null;
  openIssues: number;
  source: MembershipMode;
}

export interface GroupPersonMember {
  username: string;
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
  enabled: boolean;
}

export interface RuleFieldInfo {
  key: string;
  label: string;
  kind: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'ENUM';
  options: string[];
  operators: string[];
}

export interface GroupRequest {
  name: string;
  organizationId?: number | null;
  description?: string;
  kind?: GroupKind;
  membershipMode?: MembershipMode;
  rule?: GroupRule | null;
  location?: string;
  region?: string;
  color?: string;
  icon?: string;
  type?: GroupType | '';
  status?: GroupStatus;
}

export interface RulePreview {
  total: number;
  sample: { name: string; detail?: string }[];
}

export interface GroupCandidate {
  key: string;
  name: string;
  detail?: string;
}

export interface FeatureTab {
  key: string;
  label: string;
  features: { key: string; label: string }[];
}

/** How many devices have applied the agent view the server expects (waiting lists up to 50 that have not, offline ones included). */
export interface AppliedStatus {
  total: number;
  applied: number;
  waiting: { agentId: string; hostname?: string | null; status?: string | null; reportedAt?: string | null }[];
}

export interface GroupFeatures {
  managed: boolean;
  hidden: string[];
  version?: number;
  updatedBy?: string | null;
  updatedAt?: string | null;
}
