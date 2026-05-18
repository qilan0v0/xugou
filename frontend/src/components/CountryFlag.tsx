interface CountryFlagProps {
  code?: string;
  className?: string;
}

export default function CountryFlag({ code, className = 'w-5 h-3.5 rounded-sm flex-shrink-0' }: CountryFlagProps) {
  if (!code || code.length !== 2) {
    return <span className={`${className} bg-slate-200 dark:bg-slate-700`} />;
  }

  return (
    <img
      src={`/flags/${code.toLowerCase()}.png`}
      alt={code}
      className={className}
      loading="lazy"
    />
  );
}
