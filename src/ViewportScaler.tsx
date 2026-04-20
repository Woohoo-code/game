import { useLayoutEffect, useRef, type ReactNode } from "react";

function visualViewportSize(): { vw: number; vh: number } {
  const vv = window.visualViewport;
  if (vv) {
    return { vw: vv.width, vh: vv.height };
  }
  return { vw: window.innerWidth, vh: window.innerHeight };
}

/**
 * Uniformly scales the app tree so it fits within the visible viewport (width and
 * height), using the Fullscreen / visual viewport when available. Scale is
 * capped at 1 so large screens are unchanged.
 *
 * On narrow phones, a **minimum scale** keeps text and controls readable when
 * the layout is taller than the dynamic viewport (iOS Safari / Android Chrome).
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
      const { vw, vh } = visualViewportSize();
      const pad = 2;
      const raw = Math.min(1, (vw - pad) / rect.width, (vh - pad) / rect.height);
      const narrow = vw <= 520;
      const minScale = narrow ? 0.54 : 0.38;
      const fitScale = Math.max(minScale, raw);
      const scale = fitScale;
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
