"use client";

import { useCallback, useState } from "react";
import { Bot, ChevronDown, ChevronUp } from "lucide-react";

import { apiPath } from "@/lib/base-path";
import {
  GOLONGAN_TEKS,
  STATUS_VARIAN_TEKS,
  daftarVarianH7,
  teksLencanaH7,
  type StatusVarianH7,
  type BagianRingkasan,
  type DrafH7,
  type DrafH7Checklist,
  type GolonganIsian,
  type RingkasDrafH7,
} from "@/lib/agen-h7-putusan";
import { waktuSingkat } from "@/lib/konseptor-langkah";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * DRAF H-7 DARI AGEN ALETA DI JADWAL SIDANG DAN CHECKLIST KONSEPTOR (F4.2)
 * ============================================================================
 *
 *   LencanaDrafH7     di samping penanda kuning "Hari Putusan": kesiapan draf
 *                     yang disiapkan agen tujuh hari sebelumnya.
 *   PanelDrafH7       rincian untuk majelis & konseptor: blangko, isian yang
 *                     perlu manusia, ringkasan duduk perkara/jawab-menjawab/
 *                     bukti/saksi/kesimpulan berlabel sumber.
 *   BagianDrafH7      ringkasan di dalam checklist konseptor (F1.6).
 *
 * Tidak ada tombol yang menulis ke ABT/SIPP di sini - isian draf dipakai lewat
 * Blangko ABT by Derry Briantono (Alat saya > Checklist konseptor putusan).
 */

const WARNA_TINGKAT: Record<RingkasDrafH7["tingkat"], string> = {
  siap: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  hampir: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  belum: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
};

const WARNA_GOLONGAN: Record<GolonganIsian, string> = {
  terisi: "text-emerald-700 dark:text-emerald-300",
  pasti: "text-sky-700 dark:text-sky-300",
  usulan: "text-amber-700 dark:text-amber-300",
  manusia: "text-orange-700 dark:text-orange-300",
};

export function LencanaDrafH7({ ringkas }: { ringkas?: RingkasDrafH7 | null }) {
  if (!ringkas) return null;
  return (
    <span
      data-draf-h7={ringkas.tingkat}
      className={cn("rounded px-1.5 py-0.5 text-xs font-medium", WARNA_TINGKAT[ringkas.tingkat])}
      title={
        ringkas.perlu.length
          ? `Disiapkan agen ALETA ${waktuSingkat(ringkas.dibuatPada)}. Perlu perhatian: ${ringkas.perlu.join(", ")}.`
          : `Disiapkan agen ALETA ${waktuSingkat(ringkas.dibuatPada)}.`
      }
    >
      {teksLencanaH7(ringkas)}
    </span>
  );
}

function Ringkasan({ bagian }: { bagian: BagianRingkasan[] }) {
  return (
    <div className="mt-1 space-y-1.5">
      {bagian.map((b) => (
        <div key={b.kode} data-ringkasan={b.kode}>
          <p className="font-medium">
            {b.judul} <span className="font-normal text-muted-foreground">- sumber: {b.sumber}</span>
          </p>
          <ul className="ml-4 list-disc text-muted-foreground">
            {b.isi.map((x, i) => (
              <li key={i} className="break-words">
                {x}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

type DrafLengkap = DrafH7 & { laporan?: string[] };

export function PanelDrafH7({ perkaraId, ringkas }: { perkaraId: string; ringkas?: RingkasDrafH7 | null }) {
  const [terbuka, setTerbuka] = useState(false);
  const [draf, setDraf] = useState<DrafLengkap | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const balasan = await fetch(apiPath(`/api/aleta-ecourt/agen-h7?perkaraId=${encodeURIComponent(perkaraId)}`), { cache: "no-store" });
      const isi = (await balasan.json()) as { data?: { peta?: Record<string, DrafLengkap> } };
      setDraf(isi?.data?.peta?.[perkaraId] ?? null);
      if (balasan.status === 403) setGalat("Isi draf H-7 hanya dapat dibuka pemegang perkara (majelis, panitera, panitera pengganti).");
      else if (!balasan.ok) setGalat("Draf H-7 tidak terbaca.");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Draf H-7 tidak terbaca.");
    } finally {
      setMemuat(false);
    }
  }, [perkaraId]);

  const [pilihVarian, setPilihVarian] = useState<StatusVarianH7>("dikabulkan");

  if (!ringkas) return null;
  // Varian draf (17 Okt): dikabulkan & ditolak - ringkasan sama, blangko & isian menurut varian yang dipilih hakim.
  const semuaVarian = draf ? daftarVarianH7(draf) : [];
  const varian = semuaVarian.find((v) => v.status === pilihVarian) ?? semuaVarian[0] ?? null;
  const perlu = varian ? varian.isian.filter((i) => i.golongan === "usulan" || i.golongan === "manusia") : [];
  const disiapkan = varian ? varian.isian.filter((i) => i.golongan === "pasti") : [];

  return (
    <div className="mb-1" data-panel-draf-h7={perkaraId}>
      <button
        type="button"
        onClick={() => {
          if (!terbuka) void muat();
          setTerbuka(!terbuka);
        }}
        aria-expanded={terbuka}
        title="Draf putusan yang disiapkan agen ALETA tujuh hari sebelum Hari Putusan - belum disimpan ke ABT maupun SIPP."
        className="inline-flex max-w-full items-center gap-1 rounded-lg border border-sky-300 bg-card px-2 py-0.5 text-left text-[11px] font-medium leading-snug text-sky-900 transition hover:bg-sky-50 dark:border-sky-500/50 dark:text-sky-200 dark:hover:bg-sky-500/15"
      >
        <Bot className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{teksLencanaH7(ringkas)}</span>
        {terbuka ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
      </button>

      {terbuka ? (
        <div className="mt-1 rounded-lg border border-border bg-card p-2 text-[11px] leading-snug shadow-sm">
          {memuat && !draf ? <div className="min-h-[1.25rem]" aria-busy="true" /> : null}
          {draf ? (
            <>
              <ul className="space-y-0.5">
                {(draf.laporan ?? []).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
              {semuaVarian.length > 1 ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-1" role="group" aria-label="Varian draf putusan">
                  <span className="text-muted-foreground">Varian draf:</span>
                  {semuaVarian.map((v) => (
                    <button
                      key={v.status}
                      type="button"
                      data-varian-h7={v.status}
                      aria-pressed={varian?.status === v.status}
                      onClick={() => setPilihVarian(v.status)}
                      title={v.blangko.alasan}
                      className={cn(
                        "rounded border px-1.5 py-0.5",
                        varian?.status === v.status ? "border-sky-500 bg-sky-50 font-medium text-sky-900 dark:bg-sky-500/15 dark:text-sky-200" : "border-border"
                      )}
                    >
                      {STATUS_VARIAN_TEKS[v.status]} ({v.kesiapan.persen}%)
                    </button>
                  ))}
                </div>
              ) : null}
              {varian && semuaVarian.length > 1 ? (
                <p className="mt-1" data-blangko-varian-h7>
                  Blangko varian {STATUS_VARIAN_TEKS[varian.status].toLowerCase()}: {varian.blangko.utama?.label ?? "belum ada"}
                  <span className="text-muted-foreground"> - {varian.blangko.alasan}</span>
                </p>
              ) : null}
              {varian?.blangko.alternatif.length ? (
                <p className="mt-1 text-muted-foreground">Blangko lain yang mungkin: {varian.blangko.alternatif.map((r) => r.label).join(", ")}.</p>
              ) : null}
              {perlu.length ? (
                <div className="mt-1.5">
                  <p className="font-medium">Perlu manusia ({perlu.length})</p>
                  <ul className="ml-4 list-disc">
                    {perlu.map((i) => (
                      <li key={i.kode} data-golongan={i.golongan}>
                        <span className={WARNA_GOLONGAN[i.golongan]}>{i.nama}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          - {GOLONGAN_TEKS[i.golongan].toLowerCase()}
                          {i.nilai ? `: "${i.nilai.length > 90 ? `${i.nilai.slice(0, 89)}…` : i.nilai}"` : ""}
                          {i.sumber ? ` (dari ${i.sumber})` : ""}
                          {i.catatan ? `. ${i.catatan}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {disiapkan.length ? (
                <p className="mt-1.5 text-muted-foreground">
                  <span className={WARNA_GOLONGAN.pasti}>Disiapkan agen ({disiapkan.length}):</span> {disiapkan.map((i) => i.nama).join(", ")}.
                </p>
              ) : null}
              <Ringkasan bagian={draf.ringkasan} />
              <p className="mt-1.5 text-muted-foreground">
                Dipakai lewat Blangko ABT by Derry Briantono: Alat saya &gt; Checklist konseptor putusan &gt; Buka blangko draf
                {semuaVarian.length > 1 ? " (tombol per varian)" : ""}.
              </p>
            </>
          ) : !memuat ? (
            <p className="text-muted-foreground">Draf belum ada.</p>
          ) : null}
          {galat ? <p className="mt-1 text-red-600">{galat}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Di dalam checklist konseptor (F1.6): kesiapan draf H-7 dan isian yang perlu manusia. */
export function BagianDrafH7({ h7 }: { h7?: DrafH7Checklist | null }) {
  if (!h7) return null;
  return (
    <div className="mt-1.5 border-t border-border pt-1.5" data-bagian-draf-h7>
      <p className="font-medium">
        <LencanaDrafH7 ringkas={h7.ringkas} />{" "}
        <span className="font-normal text-muted-foreground">disiapkan agen ALETA {waktuSingkat(h7.ringkas.dibuatPada)}</span>
      </p>
      <ul className="mt-0.5 space-y-0.5 text-muted-foreground">
        {h7.laporan.slice(1, 5).map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
