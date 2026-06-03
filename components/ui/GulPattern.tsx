type Props = {
  size?: number;
  className?: string;
};

export function GulPattern({ size = 80, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Outer octagon border */}
      <polygon
        points="32,4 68,4 96,32 96,68 68,96 32,96 4,68 4,32"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      {/* Inner octagon ring */}
      <polygon
        points="40,20 60,20 80,40 80,60 60,80 40,80 20,60 20,40"
        stroke="currentColor"
        strokeWidth="1"
        fill="currentColor"
        fillOpacity="0.07"
      />
      {/* N cardinal arm */}
      <polygon
        points="50,4 66,4 60,20 50,32 40,20 34,4"
        fill="currentColor"
        fillOpacity="0.22"
      />
      {/* E cardinal arm */}
      <polygon
        points="96,34 96,66 80,60 68,50 80,40"
        fill="currentColor"
        fillOpacity="0.22"
      />
      {/* S cardinal arm */}
      <polygon
        points="50,96 34,96 40,80 50,68 60,80 66,96"
        fill="currentColor"
        fillOpacity="0.22"
      />
      {/* W cardinal arm */}
      <polygon
        points="4,34 4,66 20,60 32,50 20,40"
        fill="currentColor"
        fillOpacity="0.22"
      />
      {/* NE corner diamond */}
      <polygon
        points="74,14 84,28 72,36 62,22"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      {/* SE corner diamond */}
      <polygon
        points="84,72 74,86 62,78 72,64"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      {/* SW corner diamond */}
      <polygon
        points="26,86 16,72 28,64 38,78"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      {/* NW corner diamond */}
      <polygon
        points="16,28 26,14 38,22 28,36"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      {/* Center diamond */}
      <polygon
        points="50,36 64,50 50,64 36,50"
        fill="currentColor"
        fillOpacity="0.32"
        stroke="currentColor"
        strokeWidth="1"
      />
      {/* Center dot */}
      <circle cx="50" cy="50" r="5.5" fill="currentColor" />
    </svg>
  );
}
