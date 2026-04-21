import Image from 'next/image';

/**
 * Company logo from `public/RHN Logo.png`.
 * `brightness-0` renders the mark in solid black (works with transparent PNGs).
 */
export const RHN_LOGO_SRC = '/RHN%20Logo.png';

export function RhnLogo({
  className = '',
  size = 'md',
}: {
  className?: string;
  /** sm ≈ 28px, md ≈ 36px, lg ≈ 48px tall */
  size?: 'sm' | 'md' | 'lg';
}) {
  const h = size === 'sm' ? 'h-7' : size === 'lg' ? 'h-12' : 'h-9';
  return (
    <span
      className={`relative inline-block w-auto max-w-[min(100%,280px)] ${h} ${className}`}
    >
      <Image
        src={RHN_LOGO_SRC}
        alt="Right Human Nutrition"
        fill
        className="object-contain object-left brightness-0"
        sizes="(max-width: 280px) 100vw, 280px"
      />
    </span>
  );
}
