'use client';

import { useState, useEffect } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

const GEO_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

type Props = {
  selected: string[];
  onChange: (countries: string[]) => void;
  hint?: string;
};

export function WorldMapPicker({ selected, onChange, hint }: Props) {
  const [topo, setTopo] = useState<object | null>(null);

  useEffect(() => {
    fetch(GEO_URL)
      .then((r) => r.json())
      .then(setTopo)
      .catch(() => {});
  }, []);

  function toggle(name: string) {
    if (selected.includes(name)) {
      onChange(selected.filter((c) => c !== name));
    } else {
      onChange([...selected, name]);
    }
  }

  return (
    <div className="space-y-3">
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {topo ? (
          <ComposableMap
            projectionConfig={{ scale: 147 }}
            className="w-full h-auto"
            style={{ maxHeight: '340px' }}
          >
            <Geographies geography={topo}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const name: string = geo.properties.name;
                  const isSelected = selected.includes(name);
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      role="button"
                      aria-label={name}
                      aria-pressed={isSelected}
                      tabIndex={0}
                      onClick={() => toggle(name)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggle(name);
                        }
                      }}
                      style={{
                        default: {
                          fill: isSelected ? '#C49A1E' : 'hsl(var(--muted))',
                          stroke: 'hsl(var(--border))',
                          strokeWidth: 0.5,
                          outline: 'none',
                          cursor: 'pointer',
                        },
                        hover: {
                          fill: isSelected ? '#b08a18' : 'hsl(var(--muted-foreground) / 0.3)',
                          stroke: 'hsl(var(--border))',
                          strokeWidth: 0.5,
                          outline: 'none',
                          cursor: 'pointer',
                        },
                        pressed: {
                          fill: '#9a7a14',
                          outline: 'none',
                        },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>
        ) : (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm animate-pulse">
            Loading map…
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((country) => (
            <span
              key={country}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gold/10 text-gold text-xs font-medium border border-gold/20"
            >
              {country}
              <button
                type="button"
                onClick={() => onChange(selected.filter((c) => c !== country))}
                aria-label={`Remove ${country}`}
                className="ml-0.5 hover:text-gold/60 transition-colors"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
