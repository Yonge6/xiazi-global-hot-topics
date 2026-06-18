"use client";

import { useEffect, useRef } from "react";

type MobileMenuItem = {
  href: string;
  label: string;
};

export function MobileMenu({ label, items }: { label: string; items: MobileMenuItem[] }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const closeMenu = () => {
    detailsRef.current?.removeAttribute("open");
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const details = detailsRef.current;

      if (!details?.open || details.contains(event.target as Node)) {
        return;
      }

      details.removeAttribute("open");
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <details className="mobile-menu" ref={detailsRef}>
      <summary>
        {label}
        <span aria-hidden="true">▾</span>
      </summary>
      <div className="mobile-menu-panel">
        {items.map((item) => (
          <a href={item.href} key={item.href} onClick={() => window.setTimeout(closeMenu, 0)}>
            {item.label}
          </a>
        ))}
      </div>
    </details>
  );
}
