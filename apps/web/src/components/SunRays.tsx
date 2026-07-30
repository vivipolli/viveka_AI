import { useEffect, useState } from "react";

interface OrganicRay {
  angle: number;
  length: number;
  width: number;
  opacity: number;
}

interface SunGraphicProps {
  cx: number;
  cy: number;
  rays: OrganicRay[];
  preserveAspectRatio: string;
}

function SunGraphic({ cx, cy, rays, preserveAspectRatio }: SunGraphicProps) {
  return (
    <svg
      className="h-full w-full overflow-visible"
      viewBox="0 0 1200 900"
      preserveAspectRatio={preserveAspectRatio}
      fill="none"
    >
      <g stroke="var(--color-solar-orange)" strokeLinecap="round">
        {rays.map((ray, i) => {
          const x2 = cx + Math.cos(ray.angle) * ray.length;
          const y2 = cy + Math.sin(ray.angle) * ray.length;
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x2}
              y2={y2}
              strokeWidth={ray.width}
              opacity={ray.opacity}
            />
          );
        })}
      </g>
      <circle
        cx={cx}
        cy={cy}
        r="100"
        fill="var(--color-solar-gold)"
        opacity="0.32"
      />
    </svg>
  );
}

export function SunRays() {
  const rays = buildOrganicRays(44);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const enterStyle = {
    opacity: entered ? 1 : 0,
    transition: "transform 1.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 1s ease",
  };

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-visible"
    >
      <div
        className="absolute inset-0 overflow-visible md:hidden"
        style={{
          background:
            "radial-gradient(circle at 50% 100%, var(--color-solar-yellow) 0%, var(--color-solar-warm) 42%, transparent 78%)",
        }}
      />
      <div
        className="absolute inset-0 hidden overflow-visible md:block"
        style={{
          background:
            "radial-gradient(circle at 100% 100%, var(--color-solar-yellow) 0%, var(--color-solar-warm) 38%, transparent 72%)",
        }}
      />

      <div
        className="absolute bottom-0 left-1/2 h-[62vh] w-[130vw] max-w-none overflow-visible md:hidden"
        style={{
          ...enterStyle,
          transform: `translateX(-50%) translateY(${entered ? "0%" : "60%"})`,
        }}
      >
        <SunGraphic
          cx={600}
          cy={900}
          rays={rays}
          preserveAspectRatio="xMidYMax meet"
        />
      </div>

      <div
        className="absolute bottom-0 right-0 hidden h-[70vh] w-[100vw] max-w-none overflow-visible md:block"
        style={{
          ...enterStyle,
          transform: `translateY(${entered ? "0%" : "60%"})`,
        }}
      >
        <SunGraphic
          cx={1100}
          cy={900}
          rays={rays}
          preserveAspectRatio="xMaxYMax meet"
        />
      </div>
    </div>
  );
}

function buildOrganicRays(count: number): OrganicRay[] {
  const rays: OrganicRay[] = [];
  const span = Math.PI;
  const maxDistFromCenter = Math.PI / 2;
  const lengthScale = 1.2;

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const baseAngle = -Math.PI + t * span;
    const distFromCenter = Math.abs(baseAngle + Math.PI / 2);
    const centerFactor = 1 - (distFromCenter / maxDistFromCenter) * 0.36;

    const mirrorIndex = Math.min(i, count - 1 - i);
    const angleJitter = Math.sin(mirrorIndex * 1.37 + 0.3) * 0.014;
    const angle =
      baseAngle + angleJitter * (baseAngle < -Math.PI / 2 ? -1 : 1);

    const baseLength = (395 + centerFactor * 235) * lengthScale;
    const lengthVariation = 1 + Math.sin(mirrorIndex * 2.41 + 0.5) * 0.045;
    const length = baseLength * lengthVariation;

    const width = 0.95 + centerFactor * 0.75;
    const opacity = 0.13 + centerFactor * 0.13;

    rays.push({ angle, length, width, opacity });
  }

  return rays;
}
