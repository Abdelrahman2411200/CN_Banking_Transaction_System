import type { HTMLAttributes, KeyboardEvent, ReactElement, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

export interface DialogProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose?: () => void;
}

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export const Dialog = ({
  children,
  className,
  onClose,
  open,
  title,
  ...props
}: DialogProps): ReactElement | null => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-dialog-title`;

  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      (firstFocusable ?? dialogRef.current)?.focus();
    }

    return () => {
      if (open) {
        previouslyFocusedRef.current?.focus();
        previouslyFocusedRef.current = null;
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Escape" && onClose) {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []
    );

    if (focusableElements.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstFocusable) {
      event.preventDefault();
      lastFocusable?.focus();
    } else if (!event.shiftKey && document.activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-on-surface/30 p-4" role="presentation">
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn("w-full max-w-lg rounded-lg bg-surface-container-lowest p-6 shadow-ambient", className)}
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        {...props}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-black text-on-surface" id={titleId}>
            {title}
          </h2>
          {onClose ? (
            <Button aria-label="Close dialog" onClick={onClose} variant="tertiary">
              Close
            </Button>
          ) : null}
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};
