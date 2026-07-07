import { createPortal } from 'react-dom';
import { useEnvironmentStore } from '@/stores/environmentStore';

interface VariableAutocompleteProps {
  names: string[];
  highlightedIndex: number;
  x: number;
  y: number;
  onSelect: (name: string) => void;
  onHighlight: (index: number) => void;
}

/** Floating suggestion list shown while typing an unclosed `{{name`. */
export function VariableAutocomplete({
  names,
  highlightedIndex,
  x,
  y,
  onSelect,
  onHighlight,
}: VariableAutocompleteProps) {
  const environments = useEnvironmentStore((s) => s.environments);
  const createEnvironment = useEnvironmentStore((s) => s.createEnvironment);
  const setActiveEnvironment = useEnvironmentStore((s) => s.setActiveEnvironment);

  return createPortal(
    <div
      style={{ position: 'fixed', left: x, top: y }}
      // Prevents the input from blurring when a suggestion is clicked —
      // without this, blur would fire (and close this dropdown) before the
      // item's onClick ever runs.
      onMouseDown={(e) => e.preventDefault()}
      className="z-50 max-h-56 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-left shadow-xl dark:border-slate-700 dark:bg-slate-800"
    >
      {names.length === 0 ? (
        environments.length === 0 ? (
          <div className="p-2.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">No environments yet.</p>
            <button
              type="button"
              onClick={() => {
                const env = createEnvironment('Development');
                setActiveEnvironment(env.id);
              }}
              className="mt-1.5 w-full rounded-md bg-brand-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
            >
              Create “Development”
            </button>
          </div>
        ) : (
          <p className="p-2.5 text-xs text-slate-500 dark:text-slate-400">No matching variables.</p>
        )
      ) : (
        names.map((name, i) => (
          <button
            key={name}
            type="button"
            onMouseEnter={() => onHighlight(i)}
            onClick={() => onSelect(name)}
            className={`flex w-full items-center px-2.5 py-1.5 text-left font-mono text-xs ${
              i === highlightedIndex
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                : 'text-slate-700 dark:text-slate-200'
            }`}
          >
            {name}
          </button>
        ))
      )}
    </div>,
    document.body,
  );
}
