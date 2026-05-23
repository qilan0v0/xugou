interface CountryFlagProps {
  code?: string;
  className?: string;
}

export default function CountryFlag({ code, className = 'w-8 h-6 rounded flex-shrink-0' }: CountryFlagProps) {
  if (!code || code.length !== 2) {
    return <span className={`${className} bg-slate-200 dark:bg-slate-700`} />;
  }

  return (
    <img
      src={`/assets/flags/${code.toUpperCase()}.svg`}
      alt={code}
      className={className}
      loading="lazy"
    />
  );
}
