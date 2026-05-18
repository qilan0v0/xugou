// Inline SVG country flags - zero network requests, instant rendering
const flagSvgs: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', JP: '🇯🇵', KR: '🇰🇷',
  CN: '🇨🇳', TW: '🇹🇼', HK: '🇭🇰', MO: '🇲🇴', SG: '🇸🇬', MY: '🇲🇾',
  TH: '🇹🇭', VN: '🇻🇳', PH: '🇵🇭', ID: '🇮🇩', IN: '🇮🇳', AU: '🇦🇺',
  NZ: '🇳🇿', CA: '🇨🇦', MX: '🇲🇽', BR: '🇧🇷', AR: '🇦🇷', CL: '🇨🇱',
  RU: '🇷🇺', UA: '🇺🇦', NL: '🇳🇱', IT: '🇮🇹', ES: '🇪🇸', PT: '🇵🇹',
  SE: '🇸🇪', NO: '🇳🇴', DK: '🇩🇰', FI: '🇫🇮', PL: '🇵🇱', CZ: '🇨🇿',
  AT: '🇦🇹', CH: '🇨🇭', BE: '🇧🇪', IE: '🇮🇪', TR: '🇹🇷', SA: '🇸🇦',
  AE: '🇦🇪', IL: '🇮🇱', EG: '🇪🇬', ZA: '🇿🇦', NG: '🇳🇬', KE: '🇰🇪',
};

const flagColors: Record<string, [string, string]> = {
  RO: ['#002B7F', '#FCD116'], // Romania (blue/yellow)
};

interface CountryFlagProps {
  code?: string;
  className?: string;
}

export default function CountryFlag({ code, className = 'w-5 h-3.5 rounded-sm flex-shrink-0' }: CountryFlagProps) {
  if (!code || code.length !== 2) {
    return <span className={`${className} bg-slate-200 dark:bg-slate-700`} />;
  }

  const emoji = flagSvgs[code];
  if (emoji) {
    return <span className={className} title={code}>{emoji}</span>;
  }

  // Fallback: colored badge with country code
  const colors = flagColors[code] || ['#64748b', '#475569'];
  return (
    <span className={`${className} flex items-center justify-center text-[7px] font-bold text-white overflow-hidden`}
      style={{ background: `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)` }}
      title={code}>
      {code}
    </span>
  );
}
