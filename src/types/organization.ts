/** A customer company the product is offered to. It owns devices and has its own enrollment token and agent view. */
export interface Organization {
  id: number;
  name: string;
  /** Short lower-case name used in file names. */
  code: string;
  status: 'ACTIVE' | 'SUSPENDED';
  /** The Default organization holds devices that were enrolled before organizations existed. */
  isDefault: boolean;
  /** The last characters of the current enrollment token, so you can tell which one is current. */
  tokenHint: string | null;
  hasToken: boolean;
  devices: number;
  createdAt: string;
  createdBy: string | null;
}

/** A new or replaced token. The token is shown ONCE: the server keeps only a hash of it. */
export interface CreatedOrganization {
  organization: Organization;
  enrollmentToken: string;
}

export interface OrganizationDevice {
  agentId: string;
  hostname: string;
  os: string | null;
  status: string | null;
  organizationId: number;
  organizationName: string | null;
  lastHeartbeat: string | null;
}

export interface MoveResult {
  moved: number;
  notFound: string[];
}
