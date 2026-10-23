import { type InputHTMLAttributes, forwardRef } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        <input
          ref={ref}
          className={`w-full px-3 py-2 rounded-lg border text-sm transition-colors
            ${error
              ? 'border-red-300 bg-red-50 text-red-900 focus:ring-red-500 focus:border-red-500'
              : 'border-slate-300 bg-white text-slate-900 focus:ring-primary-500 focus:border-primary-500'
            }
            dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600
            focus:outline-none focus:ring-2
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}`}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <span>⚠</span> {error}
          </p>
        )}
        {helperText && !error && (
          <p className="text-xs text-slate-500">{helperText}</p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

export default FormField;
