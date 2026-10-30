"use client";

import { useEffect, useState } from "react";

import { ringkasBesokH1, teksLencanaH1, type DrafH1, type RingkasDrafH1 } from "@/lib/agen-h1-bas";
import { apiPath } from "@/lib/base-path";
import { sebutTanggalPanjang } from "@/lib/hari-libur";
import { tautanBlangkoDerry } from "@/lib/tautan-blangko-derry";
import { cn } from "@/lib/utils";

/**
 * G2a 2.4 (30 Okt 2026): lencana "BAS disiapkan" di Jadwal Sidang untuk sidang hari ini / hari kerja berikutnya yang
 * BAS-nya sudah disiapkan agen H-1. Keterangan lengkap (blangko, alasan, catatan) di `title`; tanpa kode dan istilah teknis.
 * Membuka BAS-nya memakai tombol BAS yang sudah ada di baris itu (blangko yang sama dibuka di Blangko Derry).
 */
export function LencanaBasH1({ ringkas }: { ringkas?: (RingkasDrafH1 & { keterangan?: string }) | null }) {
  if (!ringkas) return null;
  return (
    <span
      data-bas-h1={ringkas.adaBlangko ? "siap" : "belum"}
      className={cn(
        "rounded px-1.5 py-0.5 text-xs font-medium",
        ringkas.adaBlangko ? "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
      )}
      title={ringkas.keterangan || ringkas.label}
    >
      {teksLencanaH1(ringkas)}
    </span>
  );
}

type JawabSaya = { data?: { hariIni?: string; draf?: Array<DrafH1 & { keterangan?: string }> } };

/**
 * 30 Okt malam (keputusan pengguna 43): saran kecil "Sidang besok: N perkara - BAS sudah disiapkan" dengan tautan per perkara
 * (sekali klik membuka Blangko Derry pada perkara & sidang itu dengan BAS H-1-nya). Hanya untuk akun yang boleh membuka BAS;
 * gagal dimuat atau tidak ada draf = tidak tampil.
 */
export function SaranBasBesok({ boleh, setelanAps }: { boleh: boolean; setelanAps?: string | null }) {
  const [isi, setIsi] = useState<JawabSaya["data"] | null>(null);
  useEffect(() => {
    if (!boleh) return;
    let hidup = true;
    void fetch(apiPath("/api/aleta-ecourt/agen-h1-bas?saya=1"), { cache: "no-store" })
      .then((r) => r.json() as Promise<JawabSaya>)
      .then((j) => {
        if (hidup) setIsi(j?.data ?? null);
      })
      .catch(() => {
        if (hidup) setIsi(null);
      });
    return () => {
      hidup = false;
    };
  }, [boleh]);
  if (!boleh || !isi?.draf?.length || !isi.hariIni) return null;
  const r = ringkasBesokH1(isi.draf, isi.hariIni);
  if (!r) return null;
  return (
    <div data-saran-bas-besok={r.draf.length} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100">
      <span className="font-medium">
        Sidang besok ({sebutTanggalPanjang(r.tanggal)}): {r.draf.length} perkara - BAS sudah disiapkan.
      </span>
      {r.draf.map((d) => (
        <a
          key={d.perkaraId}
          data-buka-bas-h1={d.perkaraId}
          className="rounded border border-sky-300 px-1.5 py-0.5 text-xs underline-offset-2 hover:underline dark:border-sky-800"
          href={tautanBlangkoDerry({ nomor: d.nomorPerkara, perkaraId: d.perkaraId, tanggalSidang: d.tanggalSidang, sidangKe: d.urutanSidang || null, agenda: d.agenda, draf: "h1" }, "bas", setelanAps)}
          target="_blank"
          rel="noreferrer"
          title={(d as DrafH1 & { keterangan?: string }).keterangan || (d.blangko ? d.blangko.label : "")}
        >
          {d.nomorPerkara.replace(/\/PA\.[A-Za-z]+$/, "")}
        </a>
      ))}
    </div>
  );
}
