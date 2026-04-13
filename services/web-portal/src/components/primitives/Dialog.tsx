import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

export interface DialogProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose?: () => void;
}

export const Dialog = ({
  children,
  className,
  onClose,
  open,
  title,
  ...props
}: DialogProps): ReactElement | null => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-dialog-title`;

  useEffect(() => {
    if (open) {
      dialogRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-on-surface/30 p-4" role="presentation">
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn("w-full max-w-lg rounded-lg bg-surface-container-lowest p-6 shadow-ambient", className)}
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
