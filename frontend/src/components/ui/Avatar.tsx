interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ src, name, size = 36, className = '' }: AvatarProps) {
  const initial = name?.charAt(0) || '?';

  return (
    <div
      className={`rounded-full overflow-hidden flex items-center justify-center bg-gray-200 text-gray-600 font-medium shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {src ? (
        <img src={src} alt={name || ''} className="w-full h-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
