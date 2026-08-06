import { useMemo, useRef, useState } from "react";
import type { ExerciseTemplate } from "../lib/api";
import { titleCase } from "../lib/format";

export function ExercisePicker({
  templates,
  selected,
  onSelect,
}: {
  templates: ExerciseTemplate[];
  selected: ExerciseTemplate | null;
  onSelect: (t: ExerciseTemplate) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...templates].sort((a, b) => a.title.localeCompare(b.title));
    if (!q) return sorted.slice(0, 50);
    return sorted.filter((t) => t.title.toLowerCase().includes(q)).slice(0, 50);
  }, [templates, query]);

  return (
    <div
      className="exercise-picker"
      ref={containerRef}
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <input
        type="text"
        className="exercise-picker-input"
        placeholder={selected ? selected.title : "Search exercises…"}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />
      {open && matches.length > 0 && (
        <ul className="exercise-picker-list">
          {matches.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="exercise-picker-item"
                onClick={() => {
                  onSelect(t);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="exercise-picker-title">{t.title}</span>
                <span className="exercise-picker-muscle">{titleCase(t.primary_muscle_group)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && matches.length === 0 && (
        <div className="exercise-picker-list">
          <div className="exercise-picker-empty">No matching exercises</div>
        </div>
      )}
    </div>
  );
}
