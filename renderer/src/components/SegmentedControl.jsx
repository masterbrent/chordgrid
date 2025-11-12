export default function SegmentedControl({ options, value, onChange, label }) {
  return (
    <div className="flex items-center gap-3">
      {label && <span className="text-sm font-medium text-zinc-700">{label}</span>}
      <div className="inline-flex rounded-lg bg-zinc-100 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-md transition-all
              ${value === option.value
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
              }
            `}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
