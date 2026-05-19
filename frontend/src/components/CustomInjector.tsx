import { useEffect, useRef } from 'react';

interface CustomInjectorProps {
  code: string;
}

export default function CustomInjector({ code }: CustomInjectorProps) {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Cleanup previous injection
    if (cleanupRef.current) cleanupRef.current();

    const elements: HTMLElement[] = [];

    // Split out <script>...</script> blocks from CSS
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let cssOnly = code;
    const scripts: string[] = [];

    let m;
    while ((m = scriptRegex.exec(code)) !== null) {
      scripts.push(m[1]);        // script body
      cssOnly = cssOnly.replace(m[0], '');
    }

    // Inject CSS
    if (cssOnly.trim()) {
      const style = document.createElement('style');
      style.setAttribute('data-custom-css', '1');
      style.textContent = cssOnly;
      document.head.appendChild(style);
      elements.push(style);
    }

    // Inject scripts
    for (const src of scripts) {
      const script = document.createElement('script');
      script.setAttribute('data-custom-js', '1');
      script.textContent = src;
      document.body.appendChild(script);
      elements.push(script);
    }

    cleanupRef.current = () => {
      elements.forEach(el => el.remove());
    };

    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [code]);

  return null;
}
