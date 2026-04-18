import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Uniformly scales the app tree so it fits within the visible viewport (width and
 * height), using the Fullscreen / visual viewport when available. Scale is
 * capped at 1 so large screens are unchanged.
 */
export function ViewportScaler({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    const outer = outerRef.current;
    if (!inner || !outer) return;

    const measure = () => {
      inner.style.transform = "scale(1)";
      inner.style.width = "";
      const rect = inner.getBoundingClientRect();
      const vv = window.visualViewport;
      const vw = vv?.width ?? window.innerWidth;
      const vh = vv?.height ?? window.innerHeight;
      const pad = 2;
      const scale = Math.min(1, (vw - pad) / rect.width, (vh - pad) / rect.height);
      inner.style.transformOrigin = "top center";
      inner.style.transform = `scale(${scale})`;
      outer.style.minHeight = `${rect.height * scale}px`;
    };

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(measure);
    });
    ro.observe(inner);

    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, []);

  return (
    <div ref={outerRef} className="viewport-scaler-outer">
      <div ref={innerRef} className="viewport-scaler-inner">
        {children}
      </div>
    </div>
  );
}
