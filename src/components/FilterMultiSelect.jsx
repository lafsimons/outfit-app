import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getFilterMenuPosition } from "../lib/filterMenuPosition.js";

export default function FilterMultiSelect({ label, options, included, excluded, onToggle, searchable = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const [position, setPosition] = useState({ visibility: "hidden" });

  useLayoutEffect(() => {
    if (!open) return;
    function reposition() {
      const viewport = window.visualViewport;
      setPosition(getFilterMenuPosition(trigger.current.getBoundingClientRect(), {
        width: viewport?.width ?? window.innerWidth,
        height: viewport?.height ?? window.innerHeight,
        left: viewport?.offsetLeft ?? 0,
        top: viewport?.offsetTop ?? 0
      }));
    }
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function dismiss(event) {
      if (!root.current?.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  const optionLabel = (option) => option === "__none__" ? `No ${label.toLowerCase()}` : option;
  const visibleOptions = [...new Set([...options, ...included, ...excluded])].filter((option) => optionLabel(option).toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="filter-multiselect" ref={root}
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget) && !menu.current?.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}>
      <button type="button" ref={trigger} className="filter-multiselect-trigger" aria-expanded={open}
        onClick={() => { setOpen(!open); setQuery(""); }}>
        <span>{label}</span>
        <svg className="filter-multiselect-chevron" viewBox="0 0 12 12" aria-hidden="true">
          <path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? createPortal(
        <div ref={menu} style={position} className="filter-multiselect-menu" role="group" aria-label={label}>
          {searchable ? <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={`Search ${label.toLowerCase()}`} /> : null}
          <div className="filter-multiselect-options">
            {visibleOptions.map((option) => {
              const isExcluded = excluded.includes(option);
              const isIncluded = included.includes(option);
              return (
                <button type="button" role="checkbox" aria-checked={isExcluded ? "mixed" : isIncluded}
                  aria-label={isExcluded ? `${optionLabel(option)}, excluded` : optionLabel(option)}
                  className={`filter-multiselect-option ${isExcluded ? "is-excluded" : ""}`} key={option}
                  onClick={(event) => onToggle(option, event.shiftKey || isExcluded)}>
                  <span className="filter-multiselect-check" aria-hidden="true">{isExcluded ? "−" : isIncluded ? "✓" : ""}</span>
                  <span>{optionLabel(option)}</span>
                </button>
              );
            })}
            {!visibleOptions.length ? <p>No matches</p> : null}
          </div>
        </div>, document.body
      ) : null}
    </div>
  );
}
