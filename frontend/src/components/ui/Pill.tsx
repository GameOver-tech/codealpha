interface PillProps {
  variant: 'green' | 'amber' | 'red' | 'gray' | 'blue';
  children: string;
}

const colorMap: Record<string, string> = {
  green: 'bg-[#DCFCE7] text-[#16A34A]',
  amber: 'bg-[#FEF3C7] text-[#D97706]',
  red: 'bg-[#FEE2E2] text-[#DC2626]',
  gray: 'bg-gray-100 text-gray-600',
  blue: 'bg-[#EFF6FF] text-[#2563EB]',
};

export function Pill({ variant, children }: PillProps) {
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${colorMap[variant]}`}>
      {children}
    </span>
  );
}

export function RecommendationPill({ label }: { label: string }) {
  let variant: PillProps['variant'] = 'gray';
  if (label === 'Recommended') variant = 'green';
  else if (label === 'Needs Further Review') variant = 'amber';
  else if (label === 'Not Recommended') variant = 'red';
  return <Pill variant={variant}>{label}</Pill>;
}

export function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  let variant: PillProps['variant'] = 'gray';
  if (s === 'completed') variant = 'blue';
  else if (s === 'analyzing' || s === 'transcribing') variant = 'blue';
  return <Pill variant={variant}>{status}</Pill>;
}
