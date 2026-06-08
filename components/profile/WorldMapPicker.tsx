'use client';

import { useState, useEffect, useRef } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';

const GEO_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

type Props = {
  selected: string[];
  onChange: (countries: string[]) => void;
  hint?: string;
  searchPlaceholder?: string;
};

export function WorldMapPicker({ selected, onChange, hint, searchPlaceholder }: Props) {
  const [topo, setTopo] = useState<Topology | null>(null);
  const [countryNames, setCountryNames] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(GEO_URL)
      .then((r) => r.json())
      .then((data: Topology) => {
        setTopo(data);
        const countries = data.objects as Record<string, object>;
        const key = Object.keys(countries)[0];
        const geoFeatures = feature(data, data.objects[key] as Parameters<typeof feature>[1]);
        if ('features' in geoFeatures) {
          const names = geoFeatures.features
            .map((f) => (f.properties as { name?: string }).name)
            .filter((n): n is string => !!n)
            .sort();
          setCountryNames(names);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggle(name: string) {
    if (selected.includes(name)) {
      onChange(selected.filter((c) => c !== name));
    } else {
      onChange([...selected, name]);
    }
  }

  function addCountry(name: string) {
    if (!selected.includes(name)) {
      onChange([...selected, name]);
    }
    setQuery('');
    setDropdownOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  const filtered = countryNames.filter(
    (n) => !selected.includes(n) && n.toLowerCase().includes(query.toLowerCase()),
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0 && filtered[activeIndex]) {
      e.preventDefault();
      addCountry(filtered[activeIndex]);
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
      setQuery('');
    }
  }

  return (
    <div className="space-y-3">
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      {/* Search input */}
      <div ref={searchRef} className={`relative${dropdownOpen && filtered.length > 0 ? ' z-[100]' : ''}`}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={searchPlaceholder ?? 'Search countries…'}
          onChange={(e) => {
            setQuery(e.target.value);
            setDropdownOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setDropdownOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-secondary placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-autocomplete="list"
          aria-expanded={dropdownOpen && filtered.length > 0}
        />
        {dropdownOpen && filtered.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-20 left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-card-hover max-h-48 overflow-y-auto"
          >
            {filtered.slice(0, 50).map((name, i) => (
              <li
                key={name}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addCountry(name);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                  i === activeIndex ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                }`}
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Chips */}
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

      {/* SVG Map */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {topo ? (
          <ComposableMap
            projectionConfig={{ scale: 147 }}
            className="w-full h-auto"
            style={{ maxHeight: '320px' }}
          >
            <Geographies geography={topo}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const name: string = (geo.properties as { name: string }).name;
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
                      onKeyDown={(e: React.KeyboardEvent) => {
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
                          fill: isSelected
                            ? '#b08a18'
                            : 'hsl(var(--muted-foreground) / 0.3)',
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
    </div>
  );
}
