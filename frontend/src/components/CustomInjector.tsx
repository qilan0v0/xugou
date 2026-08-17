import { useEffect, useRef } from 'react';

interface CustomInjectorProps {
  code: string;
}

/**
 * 仅注入纯 CSS 样式。
 * ⚠️ 安全说明：禁止注入 <script> 标签，避免存储型 XSS。
 * 传入的 `code` 会经过 sanitize：只保留纯 CSS 部分，移除所有 HTML 标签。
 */
export default function CustomInjector({ code }: CustomInjectorProps) {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (cleanupRef.current) cleanupRef.current();

    const elements: HTMLElement[] = [];

    // 安全过滤：只保留纯 CSS，移除所有 HTML 标签（包括 <script> 等）
    const cssOnly = code.replace(/<[^>]*>/g, '');

    if (cssOnly.trim()) {
      const style = document.createElement('style');
      style.setAttribute('data-custom-css', '1');
      style.textContent = cssOnly;
      document.head.appendChild(style);
      elements.push(style);
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
