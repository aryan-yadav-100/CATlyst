interface SpinnerProps {
  /** Tailwind size classes, e.g. "w-4 h-4". Defaults to a button-inline size. */
  className?: string;
}

/**
 * A small inline spinner for button/loading states. Deliberately tiny
 * (one component, no deps beyond what's already in the project) so it
 * can be dropped into any button or loading block across the app
 * without adding weight.
 *
 * Usage inside a button:
 *   <button disabled={saving}>
 *     {saving && <Spinner className="w-3.5 h-3.5" />}
 *     {saving ? 'Saving...' : 'Save'}
 *   </button>
 */
export function Spinner({ className = 'w-4 h-4' }: SpinnerProps) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
      />
    </svg>
  );
}