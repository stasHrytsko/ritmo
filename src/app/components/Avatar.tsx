import type { AvatarKind } from '../../infrastructure/cloud';
import f1 from '../assets/avatars/f1.png';
import f2 from '../assets/avatars/f2.png';
import m1 from '../assets/avatars/m1.png';
import m2 from '../assets/avatars/m2.png';

const IMAGES: Record<AvatarKind, string> = { m1, m2, f1, f2 };

/**
 * Line-drawn portraits. The PNG is only an alpha mask, painted in the text
 * colour, so one image works in both themes.
 */
export function Avatar({ kind, size = 40 }: { kind: AvatarKind; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size }} aria-hidden="true">
      <i style={{ maskImage: `url(${IMAGES[kind]})`, WebkitMaskImage: `url(${IMAGES[kind]})` }} />
    </span>
  );
}
