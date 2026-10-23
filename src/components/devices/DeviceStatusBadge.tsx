import { Badge } from '../ui/Badge';

interface DeviceStatusBadgeProps {
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'ENROLLING';
  showDot?: boolean;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
  ONLINE: 'success',
  OFFLINE: 'warning',
  ERROR: 'danger',
  ENROLLING: 'info',
};

export default function DeviceStatusBadge({ status, showDot = true }: DeviceStatusBadgeProps) {
  return (
    <Badge tone={STATUS_TONE[status] ?? 'neutral'} dot={showDot} pulse={status === 'ONLINE'}>
      {status}
    </Badge>
  );
}
