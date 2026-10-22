import { useEffect, useRef } from 'react';
import { DialRoot } from 'dialkit';

export function DialControls() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    // DialKit 2.0.2 gives its non-interactive inline title aria-expanded and
    // aria-label without a role. Normalize just that title; leave disclosures
    // and all keyboard/slider behavior owned by DialKit.
    const normalizeTitles = () => {
      root.querySelectorAll('.dialkit-folder-title-root').forEach(title => {
        const header = title.closest('.dialkit-folder-header-top');
        header?.setAttribute('role', 'group');
        header?.removeAttribute('aria-expanded');
      });
    };
    normalizeTitles();
    const observer = new MutationObserver(normalizeTitles);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return <div className="dial-container" ref={host}><DialRoot mode="inline" theme="light" productionEnabled /></div>;
}
