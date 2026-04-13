import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";
import { cn } from "../../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:brightness-105",
  secondary:
    "bg-transparent text-on-surface shadow-[inset_0_0_0_1px_rgb(169_180_185_/_0.2)] hover:bg-surface-container-low",
  tertiary: "bg-transparent text-tertiary hover:bg-info-container",
  danger: "bg-error text-on-error hover:brightness-95"
};

export const Button = ({
  children,
  className,
  disabled,
  loading = false,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps): ReactElement => (
  <button
    className={cn(
      "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50",
      buttonVariants[variant],
      className
    )}
    disabled={disabled || loading}
    type={type}
    {...props}
  >
    {loading ? <span aria-hidden="true" className="h-2 w-2 rounded-pill bg-current" /> : null}
    {children}
  </button>
);

export interface IconButtonProps extends ButtonProps {
  icon: string;
  label: string;
}

export const IconButton = ({
  icon,
  label,
  className,
  children,
  ...props
}: IconButtonProps): ReactElement => (
  <Button
    aria-label={label}
    className={cn("h-10 w-10 px-0", className)}
    title={label}
    variant="tertiary"
    {...props}
  >
    <span aria-hidden="true" className="material-symbols-outlined text-xl">
      {icon}
    </span>
    {children ? <span className="sr-only">{children as ReactNode}</span> : null}
  </Button>
);
