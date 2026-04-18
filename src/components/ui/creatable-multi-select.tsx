"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Option = {
  value: string;
  label?: string;
};

export function CreatableMultiSelect({
  value,
  onChange,
  options,
  placeholder,
  allowCreate = true,
  multiple = true,
  className,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  options: Option[];
  placeholder?: string;
  allowCreate?: boolean;
  multiple?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const normalizedOptions = useMemo(
    () =>
      options.map((option) => ({
        value: option.value,
        label: option.label ?? option.value,
      })),
    [options]
  );
  const selectedValues = useMemo(
    () =>
      value.map((selectedValue) => {
        const matched = normalizedOptions.find((option) => option.value === selectedValue);

        return {
          value: selectedValue,
          label: matched?.label ?? selectedValue,
        };
      }),
    [normalizedOptions, value]
  );
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return normalizedOptions.filter((option) =>
      [option.value, option.label].join(" ").toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedOptions, query]);
  const creatableValue = query.trim();
  const canCreate = allowCreate && creatableValue.length > 0 && !normalizedOptions.some((option) => option.value.toLowerCase() === creatableValue.toLowerCase());

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const commitValue = (nextValue: string) => {
    const cleaned = nextValue.trim();
    if (!cleaned) return;

    if (multiple) {
      if (!value.some((item) => item.toLowerCase() === cleaned.toLowerCase())) {
        onChange([...value, cleaned]);
      }
    } else {
      onChange([cleaned]);
      setOpen(false);
    }

    setQuery("");
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        className="flex min-h-[3rem] w-full items-center justify-between gap-3 rounded-xl border border-input bg-background px-3 py-2 text-left shadow-sm transition hover:border-primary/30"
        onClick={() => setOpen((current) => !current)}
      >
        <div className="flex min-h-8 flex-1 flex-wrap items-center gap-2">
          {selectedValues.length === 0 ? (
            <span className="text-sm text-muted-foreground">{placeholder ?? "Pilih atau ketik nilai..."}</span>
          ) : (
            selectedValues.map((item) => (
              <Badge key={item.value} variant="outline" className="gap-1 rounded-full px-2.5 py-1">
                <span>{item.label}</span>
                <span
                  role="button"
                  tabIndex={0}
                  className="inline-flex cursor-pointer items-center"
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(value.filter((selected) => selected !== item.value));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onChange(value.filter((selected) => selected !== item.value));
                    }
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              </Badge>
            ))
          )}
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 w-full rounded-2xl border border-border bg-card p-3 shadow-panel">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari atau ketik nilai baru..."
            className="h-11 text-base"
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();

              if (canCreate) {
                commitValue(creatableValue);
                return;
              }

              const firstOption = filteredOptions[0];
              if (firstOption) {
                commitValue(firstOption.value);
              }
            }}
          />

          <div className="mt-3 max-h-64 space-y-2 overflow-auto">
            {canCreate ? (
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-left text-sm text-foreground"
                onClick={() => commitValue(creatableValue)}
              >
                <span>Buat &quot;{creatableValue}&quot;</span>
                <Plus className="h-4 w-4 text-primary" />
              </button>
            ) : null}

            {filteredOptions.map((option) => {
              const selected = value.some((selectedValue) => selectedValue.toLowerCase() === option.value.toLowerCase());

              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition",
                    selected ? "bg-primary/10 text-foreground" : "bg-muted/35 text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                  )}
                  onClick={() => {
                    if (selected) {
                      onChange(value.filter((selectedValue) => selectedValue !== option.value));
                    } else {
                      commitValue(option.value);
                    }
                  }}
                >
                  <span>{option.label}</span>
                  {selected ? <Check className="h-4 w-4 text-primary" /> : null}
                </button>
              );
            })}

            {!canCreate && filteredOptions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/35 px-3 py-4 text-sm text-muted-foreground">
                Tidak ada opsi yang cocok.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
