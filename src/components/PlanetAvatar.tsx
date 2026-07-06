import { memo } from 'react';
import { derivePlanetTraits, resolveSeed } from '@/constants/proceduralPlanets';
import { toRenderSpec } from '@/constants/proceduralPlanetRender';

interface PlanetAvatarProps {
  planetSeed: number;
  size?: number;
  className?: string;
  showGlow?: boolean;
  flat?: boolean;
  fallbackUserId?: string;
}

/**
 * 프로시저럴 행성 아바타. 단일 SVG에 body+bands+dots+ring을 그리고
 * viewBox 안에 fit. 부모는 overflow-hidden + size×size.
 * z-order: body → bands+dots (clipPath to body) → ring (unclipped)
 */
export const PlanetAvatar = memo(function PlanetAvatar({
  planetSeed,
  size = 40,
  className = '',
  showGlow = false,
  flat = false,
  fallbackUserId,
}: PlanetAvatarProps) {
  const seed = resolveSeed(planetSeed, fallbackUserId);
  const traits = derivePlanetTraits(seed);
  const spec = toRenderSpec(traits, seed, 1);

  const ringOuter = spec.ring ? spec.ring.rx + spec.ring.width / 2 : 1;
  const norm = 1 / ringOuter;
  const bodyR = norm;

  const focalX = (spec.bodyGradient.cx - 0.5) * 2;
  const focalY = (spec.bodyGradient.cy - 0.5) * 2;
  const gid = `body-${seed}`;
  const cid = `clip-${seed}`;

  return (
    <div
      className={`relative inline-flex rounded-full overflow-hidden flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: flat
          ? undefined
          : showGlow
            ? `0 0 ${size * 0.4}px ${spec.glow.color}, 0 0 ${size * 0.8}px ${spec.glow.color.replace(/, ?[\d.]+\)$/, ', 0.25')}`
            : `0 2px 8px ${spec.glow.color.replace(/, ?[\d.]+\)$/, ', 0.2)')}`,
      }}
    >
      <svg aria-hidden className="block" viewBox="-1.05 -1.05 2.1 2.1" width={size} height={size}>
        <defs>
          <radialGradient id={gid} cx={focalX} cy={focalY} r={bodyR} gradientUnits="userSpaceOnUse">
            {spec.bodyGradient.stops.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </radialGradient>
          <clipPath id={cid}>
            <circle cx="0" cy="0" r={bodyR} />
          </clipPath>
        </defs>

        {/* 본체 */}
        <circle cx="0" cy="0" r={bodyR} fill={`url(#${gid})`} />

        {/* bands + dots — clipPath로 본체 원형에 한정 */}
        <g clipPath={`url(#${cid})`}>
          {spec.bands.map((band, i) => (
            <rect
              key={`b-${i}`}
              x={-1.5}
              y={band.y * norm - (band.thickness * norm) / 2}
              width={3}
              height={band.thickness * norm}
              fill={band.color}
            />
          ))}
          {spec.dots.map((dot, i) => (
            <circle
              key={`d-${i}`}
              cx={dot.x * norm}
              cy={dot.y * norm}
              r={dot.r * norm}
              fill={dot.color}
            />
          ))}
        </g>

        {/* ring — clip 없음 */}
        {spec.ring && (
          <ellipse
            cx="0"
            cy="0"
            rx={spec.ring.rx * norm}
            ry={spec.ring.ry * norm}
            fill="none"
            stroke={spec.ring.color}
            strokeWidth={spec.ring.width * norm}
            transform={`rotate(${spec.ring.tilt})`}
          />
        )}
      </svg>
    </div>
  );
});
