export type JlfHearingSummary = {
  index: number;
  id: string;
  order: string;
  date: string;
  time: string;
  agenda: string;
  room: string;
  status: string;
  label: string;
  raw: unknown;
};

export type JlfHearingContext = {
  items: JlfHearingSummary[];
  previous: JlfHearingSummary | null;
  selected: JlfHearingSummary | null;
  next: JlfHearingSummary | null;
  selectedIndex: number;
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readObjectValue(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const found = record[key] ?? record[toCamelKey(key)] ?? record[toSnakeKey(key)];
    const normalized = normalizeText(found);
    if (normalized) return normalized;
  }
  return "";
}

function toCamelKey(value: string) {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function toSnakeKey(value: string) {
  return value.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

function hearingTimeValue(value: unknown) {
  const date = readObjectValue(value, ["tanggalSidang", "tanggal_sidang", "tanggal", "tgl_sidang", "date"]);
  const time = readObjectValue(value, ["jamSidang", "jam_sidang", "jam", "time"]);
  const parsed = Date.parse([date, time].filter(Boolean).join("T"));
  return Number.isFinite(parsed) ? parsed : 0;
}

function hearingOrderValue(value: unknown) {
  const raw = readObjectValue(value, ["sidangKe", "sidang_ke", "urutan", "no_urut", "id"]);
  const number = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function hearingIdValue(value: unknown) {
  return readObjectValue(value, ["sidangId", "sidang_id", "id", "jadwalSidangId", "jadwal_sidang_id"]);
}

export function sortJlfHearings(items: unknown[]) {
  return [...items].sort((left, right) => {
    const leftOrder = hearingOrderValue(left);
    const rightOrder = hearingOrderValue(right);
    if (leftOrder || rightOrder) {
      const orderDiff = (leftOrder || Number.MAX_SAFE_INTEGER) - (rightOrder || Number.MAX_SAFE_INTEGER);
      if (orderDiff) return orderDiff;
    }
    return hearingTimeValue(left) - hearingTimeValue(right);
  });
}

export function summarizeJlfHearing(value: unknown, index: number): JlfHearingSummary {
  const order = readObjectValue(value, ["sidangKe", "sidang_ke", "urutan", "no_urut"]) || String(index + 1);
  const date = readObjectValue(value, ["tanggalSidang", "tanggal_sidang", "tanggal", "tgl_sidang", "date"]);
  const time = readObjectValue(value, ["jamSidang", "jam_sidang", "jam", "time"]);
  const agenda = readObjectValue(value, ["agendaSidang", "agenda_sidang", "agenda", "keterangan", "acara"]);
  const room = readObjectValue(value, ["ruangan", "ruang_sidang", "ruanganSidang"]);
  const status = readObjectValue(value, ["status", "status_sidang", "ditunda", "alasan_ditunda"]);
  const id = hearingIdValue(value) || `${order}-${date}-${time}`;
  const label = [`Sidang ${order}`, date, time, agenda].filter(Boolean).join(" - ");

  return {
    index,
    id,
    order,
    date,
    time,
    agenda,
    room,
    status,
    label: label || `Sidang ${index + 1}`,
    raw: value,
  };
}

function selectedIndexFromHearing(items: unknown[], selectedHearing?: unknown) {
  if (!selectedHearing) return -1;
  const selectedId = hearingIdValue(selectedHearing);
  if (selectedId) {
    const foundById = items.findIndex((item) => hearingIdValue(item) === selectedId);
    if (foundById >= 0) return foundById;
  }

  const selectedOrder = hearingOrderValue(selectedHearing);
  const selectedTime = hearingTimeValue(selectedHearing);
  return items.findIndex((item) => {
    const sameOrder = selectedOrder > 0 && hearingOrderValue(item) === selectedOrder;
    const sameTime = selectedTime > 0 && hearingTimeValue(item) === selectedTime;
    return sameOrder || sameTime;
  });
}

function isDecisionHearing(value: unknown) {
  return /(putusan|penetapan|ikrar|pembacaan)/i.test(
    readObjectValue(value, ["agendaSidang", "agenda_sidang", "agenda", "keterangan", "acara"])
  );
}

export function pickAutomaticJlfHearingIndex(items: unknown[]) {
  const decisionIndex = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isDecisionHearing(item))
    .at(-1)?.index;
  if (typeof decisionIndex === "number") return decisionIndex;
  return items.length ? items.length - 1 : -1;
}

export function buildJlfHearingContext(
  schedule: unknown[],
  selectedHearing?: unknown,
  lastHearing?: unknown | null,
  nextHearing?: unknown | null,
  options: { autoSelect?: boolean } = {}
): JlfHearingContext {
  const sorted = sortJlfHearings(schedule);
  const summaries = sorted.map(summarizeJlfHearing);
  let selectedIndex = selectedIndexFromHearing(sorted, selectedHearing);
  if (selectedIndex < 0 && options.autoSelect !== false) selectedIndex = pickAutomaticJlfHearingIndex(sorted);
  const allowFallbackHearings = options.autoSelect !== false;

  const selected = selectedIndex >= 0 ? summaries[selectedIndex] ?? null : selectedHearing ? summarizeJlfHearing(selectedHearing, 0) : null;
  const previous = selectedIndex > 0 ? summaries[selectedIndex - 1] ?? null : allowFallbackHearings && lastHearing && !selected ? summarizeJlfHearing(lastHearing, 0) : null;
  const next = selectedIndex >= 0 ? summaries[selectedIndex + 1] ?? null : allowFallbackHearings && nextHearing ? summarizeJlfHearing(nextHearing, 0) : null;

  return {
    items: summaries,
    previous,
    selected,
    next,
    selectedIndex,
  };
}

export function formatJlfHearingTimeline(context: JlfHearingContext) {
  return context.items
    .map((item) => `${item.order}. ${[item.date, item.time, item.agenda].filter(Boolean).join(" - ")}`)
    .join("\n");
}

export function readJlfHearingField(hearing: JlfHearingSummary | null | undefined, field: string) {
  if (!hearing) return "";
  const normalized = field.replace(/^(sidang\.)?(terpilih|sebelumnya|berikutnya|previous|next)\./, "");
  if (normalized === "label" || normalized === "ringkasan") return hearing.label;
  if (normalized === "sidang_ke" || normalized === "urutan" || normalized === "order") return hearing.order;
  if (normalized === "tanggal_sidang" || normalized === "tanggal" || normalized === "date") return hearing.date;
  if (normalized === "jam_sidang" || normalized === "jam" || normalized === "time") return hearing.time;
  if (normalized === "agenda_sidang" || normalized === "agenda" || normalized === "acara") return hearing.agenda;
  if (normalized === "ruangan" || normalized === "room") return hearing.room;
  if (normalized === "status") return hearing.status;
  return readObjectValue(hearing.raw, [normalized]);
}
