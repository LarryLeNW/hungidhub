"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import styles from "../admin.module.css";

export type SelectMenuOption = {
  value: string;
  label: string;
  /** Tree indentation level (0 = root). */
  depth?: number;
  /** Secondary text shown right-aligned (e.g. count, slug). */
  hint?: string;
  disabled?: boolean;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectMenuOption[];
  placeholder?: string;
  /** Show the filter box; defaults to "when more than 7 options". */
  searchable?: boolean;
  disabled?: boolean;
  id?: string;
};

const POPOVER_GAP = 6;
const POPOVER_MAX_HEIGHT = 320;

/**
 * Scroll only the list container so `row` is visible. `scrollIntoView` would also scroll every
 * scrollable ancestor (the dialog body, the page), which reads as a jolt when the menu opens.
 */
function revealRow(list: HTMLElement | null, row: HTMLElement | null, block: "nearest" | "center") {
  if (!list || !row) return;
  const top = row.offsetTop;
  const bottom = top + row.offsetHeight;
  if (block === "center") {
    list.scrollTop = Math.max(0, top - list.clientHeight / 2 + row.offsetHeight / 2);
  } else if (top < list.scrollTop) {
    list.scrollTop = top;
  } else if (bottom > list.scrollTop + list.clientHeight) {
    list.scrollTop = bottom - list.clientHeight;
  }
}

/** Styled single-select replacing the native `<select>` (dropdown, keyboard navigation, optional filter). */
export function SelectMenu({ value, onChange, options, placeholder = "— Chọn —", searchable, disabled, id }: Props) {
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  // null until measured – the popover stays invisible for that first layout pass, so nothing flashes or shifts.
  const [position, setPosition] = useState<CSSProperties | null>(null);

  const selected = options.find((option) => option.value === value);
  const showSearch = searchable ?? options.length > 7;
  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, needle]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(-1);
    setPosition(null);
  }, []);

  const focusTrigger = () => triggerRef.current?.focus({ preventScroll: true });

  const pick = (option: SelectMenuOption) => {
    if (option.disabled) return;
    onChange(option.value);
    close();
    focusTrigger();
  };

  // Position the popover (fixed, so it escapes scrolling modal bodies) and flip upward when space is short.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const trigger = triggerRef.current;
    const place = () => {
      const rect = trigger.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - POPOVER_GAP - 12;
      const above = rect.top - POPOVER_GAP - 12;
      const openUp = below < 200 && above > below;
      const maxHeight = Math.min(POPOVER_MAX_HEIGHT, openUp ? above : below);
      setPosition({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        maxHeight,
        ...(openUp ? { bottom: window.innerHeight - rect.top + POPOVER_GAP } : { top: rect.bottom + POPOVER_GAP }),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Click outside closes; focus the filter box (or the list) when opening.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      // A click on a dialog backdrop should only dismiss the menu, not the dialog: cancelling pointerdown
      // suppresses the compatibility mousedown the backdrop listens to.
      if (target instanceof HTMLElement && target.getAttribute("role") === "presentation") event.preventDefault();
      close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    const focusTimer = window.setTimeout(() => (searchRef.current ?? popoverRef.current)?.focus({ preventScroll: true }), 0);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.clearTimeout(focusTimer);
    };
  }, [open, close]);

  // Keep the active row in view while navigating with the keyboard.
  useEffect(() => {
    if (!open || active < 0) return;
    revealRow(listRef.current, listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`) ?? null, "nearest");
  }, [open, active]);

  const openMenu = () => {
    if (disabled) return;
    setOpen(true);
    setActive(options.findIndex((option) => option.value === value));
    // Scroll the current value into view once rendered.
    window.setTimeout(() => revealRow(listRef.current, listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? null, "center"), 0);
  };

  const move = (delta: number) => {
    if (!visible.length) return;
    let next = active;
    for (let i = 0; i < visible.length; i += 1) {
      next = (next + delta + visible.length) % visible.length;
      if (!visible[next].disabled) break;
    }
    setActive(next);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    // Stop the dialog's Escape/Tab handlers from seeing keys meant for the menu.
    event.stopPropagation();
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        close();
        focusTrigger();
        break;
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(visible.length - 1);
        break;
      case "Enter":
        event.preventDefault();
        if (active >= 0 && visible[active]) pick(visible[active]);
        break;
      case "Tab":
        close();
        break;
      default:
        break;
    }
  };

  return (
    <div className={styles.selectMenu} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`${styles.selectTrigger} ${open ? styles.selectTriggerOpen : ""} ${selected ? "" : styles.selectTriggerEmpty}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div ref={popoverRef} className={`${styles.selectPopover} ${position ? styles.selectPopoverReady : ""}`} style={position ?? { position: "fixed", visibility: "hidden" }}
          tabIndex={-1}
          // The menu often sits inside a <label>; a click on a non-interactive option would otherwise trigger the
          // label's activation (a synthetic click on the trigger button) and instantly re-open the menu.
          onClick={(event) => event.preventDefault()}
        >
          {showSearch ? (
            <div className={styles.selectSearch}>
              <Search size={14} />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                placeholder="Tìm nhanh…"
                aria-label="Tìm trong danh sách"
              />
            </div>
          ) : null}
          <div ref={listRef} id={listboxId} role="listbox" className={styles.selectList} aria-activedescendant={active >= 0 ? `${listboxId}-${active}` : undefined}>
            {visible.length === 0 ? <p className={styles.emptyNote}>Không có mục nào khớp.</p> : null}
            {visible.map((option, index) => {
              const isSelected = option.value === value;
              const indent = needle ? 0 : option.depth ?? 0;
              return (
                <div
                  key={option.value || "__empty"}
                  id={`${listboxId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  className={`${styles.selectOption} ${index === active ? styles.selectOptionActive : ""} ${isSelected ? styles.selectOptionSelected : ""} ${option.disabled ? styles.selectOptionDisabled : ""}`}
                  style={{ paddingLeft: 12 + indent * 16 }}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(option)}
                >
                  {indent > 0 ? <i className={styles.selectBranch} aria-hidden /> : null}
                  <span>{option.label}</span>
                  {option.hint ? <small>{option.hint}</small> : null}
                  {isSelected ? <Check size={14} /> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
