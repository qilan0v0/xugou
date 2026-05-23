interface CountryFlagProps {
  code?: string;
  className?: string;
}

export default function CountryFlag({ code, className = 'w-7 h-5 rounded-sm flex-shrink-0' }: CountryFlagProps) {
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
