'use client';

import Image, { ImageProps } from 'next/image';
import { useEffect, useMemo, useState } from 'react';

const DEFAULT_AVATAR = '/default-avatar.png';

type AvatarImageProps = Omit<ImageProps, 'src'> & {
  src?: string | null;
};

export function AvatarImage({ src, alt, ...props }: AvatarImageProps) {
  const safeSrc = useMemo(() => {
    const value = src?.trim();
    return value ? value : DEFAULT_AVATAR;
  }, [src]);
  const [currentSrc, setCurrentSrc] = useState(safeSrc);

  useEffect(() => {
    setCurrentSrc(safeSrc);
  }, [safeSrc]);

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt}
      onError={() => {
        if (currentSrc !== DEFAULT_AVATAR) {
          setCurrentSrc(DEFAULT_AVATAR);
        }
      }}
    />
  );
}
