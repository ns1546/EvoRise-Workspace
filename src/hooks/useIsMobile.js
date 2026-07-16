import { useState, useEffect } from 'react';

/**
 * useIsMobile — returns true if the viewport is mobile (≤768px).
 * Used to conditionally render mobile-only JSX without polluting PC components.
 */
const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
};

export default useIsMobile;
export { useIsMobile };
