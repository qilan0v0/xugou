import { useState, useRef, useCallback } from 'react';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { geoJsonString } from '../lib/geo-json-string';
import { countryCoordinates } from '../lib/geo-limit';
import { Globe } from 'lucide-react';

interface ServerWithCountry {
  id: number;
  name: string;
  country: string;
  status: string;
}

interface WorldMapProps {
  servers: ServerWithCountry[];
}

interface TooltipData {
  x: number;
  y: number;
  country: string;
  count: number;
}

export default function WorldMap({ servers }: WorldMapProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Collect unique country codes
  const countrySet = new Set<string>();
  const serverCounts: Record<string, number> = {};
  servers.forEach(s => {
    if (s.country) {
      const cc = s.country.toUpperCase();
      countrySet.add(cc);
      serverCounts[cc] = (serverCounts[cc] || 0) + 1;
    }
  });
  const countryList = Array.from(countrySet);

  const width = 900;
  const height = 500;

  let geoJson: any;
  try { geoJson = JSON.parse(geoJsonString); } catch { geoJson = { features: [] }; }
  const filteredFeatures = geoJson.features?.filter(
    (f: any) => f.properties?.iso_a3_eh !== ''
  ) || [];

  const projection = geoEquirectangular()
    .scale(140)
    .translate([width / 2, height / 2])
    .rotate([-12, 0, 0]);
  const pathFn = geoPath().projection(projection);

  const handleMouseEnter = useCallback((countryCode: string, centroid: [number, number] | null) => {
    const count = serverCounts[countryCode] || 0;
    if (!count) { setTooltip(null); return; }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: (centroid ? centroid[0] : width / 2) / width * rect.width,
      y: (centroid ? centroid[1] : height / 2) / height * rect.height,
      country: countryCode,
      count,
    });
  }, [serverCounts]);

  const mapSvg = (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto max-h-[60vh]"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x="0" y="0" width={width} height={height} fill="transparent" />
      {filteredFeatures.map((feature: any, index: number) => {
        const isHighlighted = countryList.includes(feature.properties.iso_a2_eh);
        const centroid = isHighlighted ? pathFn.centroid(feature) : null;
        const countryCode = feature.properties.iso_a2_eh;
        return (
          <path
            key={index}
            d={pathFn(feature) || ''}
            className={
              isHighlighted
                ? 'fill-green-700 hover:fill-green-600 dark:fill-green-900 dark:hover:fill-green-700 transition-colors cursor-pointer'
                : 'fill-neutral-200/50 dark:fill-neutral-800 stroke-neutral-300/40 dark:stroke-neutral-700 stroke-[0.5]'
            }
            onMouseEnter={() => handleMouseEnter(countryCode, centroid)}
            onMouseLeave={() => setTooltip(null)}
          />
        );
      })}

      {/* Countries not in geoJson features - render as dots */}
      {countryList.map(countryCode => {
        const isInFeatures = filteredFeatures.some(
          (f: any) => f.properties.iso_a2_eh === countryCode
        );
        if (isInFeatures) return null;
        const coords = (countryCoordinates as any)[countryCode];
        if (!coords) return null;
        const pt = projection([coords.lng, coords.lat]);
        if (!pt) return null;
        return (
          <g key={countryCode}>
            <circle
              cx={pt[0]}
              cy={pt[1]}
              r={4}
              className="fill-green-700 stroke-white hover:fill-green-600 dark:fill-green-900 dark:hover:fill-green-700 transition-all cursor-pointer"
              onMouseEnter={() => handleMouseEnter(countryCode, pt)}
              onMouseLeave={() => setTooltip(null)}
            />
          </g>
        );
      })}
    </svg>
  );

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Globe size={16} className="text-blue-500" />
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          服务器分布
        </span>
        <span className="text-xs text-slate-400">
          {countryList.length} 个地区
        </span>
      </div>
      <div ref={containerRef} className="relative w-full">
        {mapSvg}
        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-white dark:bg-slate-800 px-3 py-2 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 text-sm z-50 whitespace-nowrap"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -120%)',
            }}
          >
            <p className="font-medium text-slate-900 dark:text-white">
              {tooltip.country}
            </p>
            <p className="text-xs text-slate-500">
              {tooltip.count} 台服务器
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
