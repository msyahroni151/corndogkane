"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./pinned-table-controls.css";

export function PinnedTableControls({
  children,
  controls,
}: {
  children: ReactNode;
  controls: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    anchor = useRef<HTMLDivElement>(null),
    toolbar = useRef<HTMLDivElement>(null),
    bar = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({
    floating: false,
    left: 0,
    width: 0,
    contentWidth: 0,
    height: 82,
  });
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      const container = root.current,
        viewport = scroll.current,
        marker = anchor.current;
      if (!container || !viewport || !marker) return;
      const rect = container.getBoundingClientRect(),
        foot = marker.getBoundingClientRect();
      const height = toolbar.current?.offsetHeight || 82;
      const left = Math.max(0, rect.left),
        width = Math.max(0, Math.min(window.innerWidth, rect.right) - left);
      const floating =
        rect.top < window.innerHeight - height &&
        foot.bottom > window.innerHeight + 1 &&
        rect.bottom > 0 &&
        width > 0;
      setLayout((old) =>
        old.floating === floating &&
        old.left === left &&
        old.width === width &&
        old.contentWidth === viewport.scrollWidth &&
        old.height === height
          ? old
          : { floating, left, width, contentWidth: viewport.scrollWidth, height },
      );
      if (bar.current) bar.current.scrollLeft = viewport.scrollLeft;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    if (root.current) observer.observe(root.current);
    if (scroll.current) {
      observer.observe(scroll.current);
      const table = scroll.current.querySelector("table");
      if (table) observer.observe(table);
    }
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, []);
  useEffect(() => {
    if (bar.current && scroll.current) bar.current.scrollLeft = scroll.current.scrollLeft;
  }, [layout.floating]);
  const footer = (
    <div
      ref={toolbar}
      className="pinned-table-toolbar"
      data-floating={layout.floating || undefined}
      style={
        layout.floating
          ? { position: "fixed", left: layout.left, width: layout.width, bottom: 0 }
          : undefined
      }
    >
      {controls}
      <div
        ref={bar}
        className="pinned-table-scrollbar"
        role="region"
        aria-label="Geser tabel horizontal"
        tabIndex={0}
        onScroll={(event) => {
          if (
            scroll.current &&
            Math.abs(scroll.current.scrollLeft - event.currentTarget.scrollLeft) > 1
          )
            scroll.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
      >
        <div style={{ width: layout.contentWidth, height: 1 }} />
      </div>
    </div>
  );
  return (
    <div ref={root} className="pinned-table-root">
      <div
        ref={scroll}
        className="pinned-table-viewport"
        onScroll={(event) => {
          if (bar.current && Math.abs(bar.current.scrollLeft - event.currentTarget.scrollLeft) > 1)
            bar.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
      >
        {children}
      </div>
      <div ref={anchor} style={{ minHeight: layout.height }}>
        {!layout.floating && footer}
      </div>
      {layout.floating && createPortal(footer, document.body)}
    </div>
  );
}
