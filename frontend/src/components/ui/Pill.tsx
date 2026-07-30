interface PillProps {
  variant: 'green' | 'amber' | 'red' | 'gray';
  children: string;
}

const colorMap = {
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-600',
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
  else if (label === 'Need Further Review') variant = 'amber';
  else if (label === 'Not Recommended') variant = 'red';
  return <Pill variant={variant}>{label}</Pill>;
}
