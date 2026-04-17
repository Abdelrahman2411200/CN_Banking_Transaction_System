import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactElement,
  SelectHTMLAttributes
} from "react";
import { cn } from "../../lib/cn";

interface FieldBaseProps {
  label: string;
  error?: string;
}

const labelClass = "text-xs font-black uppercase tracking-widest text-on-surface-variant";
const fieldClass =
  "min-h-11 w-full min-w-0 rounded-lg bg-surface-container-lowest px-3 py-2 text-sm text-on-surface shadow-[inset_0_0_0_1px_rgb(169_180_185_/_0.2)] transition placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary";

export type FieldLabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export const FieldLabel = ({ className, ...props }: FieldLabelProps): ReactElement => (
  <label className={cn(labelClass, className)} {...props} />
);

export interface InputProps extends FieldBaseProps, InputHTMLAttributes<HTMLInputElement> {}

export const Input = ({ className, error, id, label, ...props }: InputProps): ReactElement => {
  const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, "-");
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="grid min-w-0 gap-2">
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <input
        aria-describedby={errorId}
        aria-invalid={Boolean(error)}
        className={cn(fieldClass, error && "focus:ring-error", className)}
        id={inputId}
        {...props}
      />
      {error ? (
        <p className="text-xs font-semibold text-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
};

export interface SelectProps extends FieldBaseProps, SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = ({ children, className, error, id, label, ...props }: SelectProps): ReactElement => {
  const selectId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, "-");
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div className="grid min-w-0 gap-2">
      <FieldLabel htmlFor={selectId}>{label}</FieldLabel>
      <select
        aria-describedby={errorId}
        aria-invalid={Boolean(error)}
        className={cn(fieldClass, error && "focus:ring-error", className)}
        id={selectId}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p className="text-xs font-semibold text-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
};
