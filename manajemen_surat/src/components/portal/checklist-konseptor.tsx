"use client";

import { useCallback, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, ListChecks } from "lucide-react";

import { apiPath } from "@/lib/base-path";
import {
  teksKesiapan,
  waktuSingkat,
  type KemajuanKonseptor,
  type RingkasKemajuan,
} from "@/lib/konseptor-langkah";
import { cn } from "@/lib/utils";
import { BagianDrafH7 } from "@/components/portal/draf-h7"; /* F4.2 */
import type { DrafH7Checklist } from "@/lib/agen-h7-putusan";

/**
 * ============================================================================
 * CHECKLIST KONSEPTOR SEMENTARA DI JADWAL SIDANG (F1.6)
 * ============================================================================
 *
 * Dua bagian, untuk perkara yang konseptornya sudah ditunjuk ATAU sudah
 * tercatat di SIPP (keputusan 17 Okt butir 38):
 *
 *   LencanaKesiapanPutusan  di samping penanda kuning "Hari Putusan" - draf
 *                           siap dibacakan atau baru berapa langkah.
 *   ChecklistKonseptor      di bawah tombol konseptor sementara - daftar
 *                           langkah penyusunan draf, centang per langkah,
 *                           siapa & kapan, dan isian Blangko Derry yang masih
 *                           kosong. Majelis melihat kemajuan yang sama.
 *
 * Aturan statusnya di @/lib/konseptor-langkah (satu tempat untuk portal,
 * checklist milestone, dan ekstensi). Langkah Putusan sela / Eksepsi /
 * Rekonvensi hanya datang bila perkaranya memilikinya (butir 35); "Dikoreksi
 * majelis" hanya dapat dicentang ketua/anggota majelis (butir 36) - kotaknya
 * nonaktif untuk yang lain, dan rute menolaknya.
 */

export function LencanaKesiapanPutusan({ kemajuan }: { kemajuan?: RingkasKemajuan }) {
  if (!kemajuan) return null;
  return (
    <span
      data-kesiapan-putusan={kemajuan.siap ? "siap" : "belum"}
      className={cn(
        "rounded px-1.5 py-0.5 text-xs font-medium",
        kemajuan.siap
          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          : "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200"
      )}
      title={
        kemajuan.siap
          ? "Semua langkah draf putusan sudah selesai, termasuk koreksi majelis."
          : `Langkah yang belum selesai: ${kemajuan.belum.join(", ")}.`
      }
    >
      {teksKesiapan(kemajuan)}
    </span>
  );
}

type Props = {
  perkaraId: string;
  nomorPerkara: string;
  kemajuan?: RingkasKemajuan;
  /** Butir 38: konseptor yang sudah tercatat di SIPP (tanpa tunjukan sementara). */
  konseptorSipp?: string[];
  /** Dipanggil sesudah centang tersimpan - memuat ulang ringkasan di baris. */
  onBerubah?: () => void;
};

export function ChecklistKonseptor({ perkaraId, nomorPerkara, kemajuan, konseptorSipp, onBerubah }: Props) {
  const [terbuka, setTerbuka] = useState(false);
  const [rinci, setRinci] = useState<KemajuanKonseptor | null>(null);
  // F4.2: draf H-7 dari agen ALETA untuk perkara ini (ikut jawaban GET checklist).
  const [h7, setH7] = useState<DrafH7Checklist | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [sibuk, setSibuk] = useState("");
  const [galat, setGalat] = useState("");
  // Hak centang dijaga rute (putusan.draf); layar tidak menebaknya - tolakan
  // 403 dijawab dengan kalimat yang sama di bawah daftar.
  const [bolehCentang, setBolehCentang] = useState(true);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const balasan = await fetch(apiPath(`/api/aleta-ecourt/konseptor-langkah?perkaraId=${encodeURIComponent(perkaraId)}`), {
        cache: "no-store",
      });
      const isi = (await balasan.json()) as {
        data?: { peta?: Record<string, KemajuanKonseptor>; drafH7?: Record<string, DrafH7Checklist> };
      };
      setRinci(isi?.data?.peta?.[perkaraId] ?? null);
      setH7(isi?.data?.drafH7?.[perkaraId] ?? null);
      if (!balasan.ok) setGalat("Checklist tidak terbaca.");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Checklist tidak terbaca.");
    } finally {
      setMemuat(false);
    }
  }, [perkaraId]);

  const centang = async (langkah: string, selesai: boolean) => {
    setSibuk(langkah);
    setGalat("");
    try {
      const balasan = await fetch(apiPath("/api/aleta-ecourt/konseptor-langkah"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ perkaraId, nomorPerkara, langkah, selesai }),
      });
      const isi = (await balasan.json()) as {
        data?: { ok?: boolean; alasan?: string; kemajuan?: KemajuanKonseptor | null };
        error?: { message?: string };
      };
      if (balasan.status === 403) {
        // Butir 36: "Dikoreksi majelis" ditolak untuk bukan majelis - langkah lain tetap boleh.
        if (langkah === "koreksi") setGalat(isi?.data?.alasan || isi?.error?.message || "Hanya ketua/anggota majelis yang dapat mencentang langkah ini.");
        else setBolehCentang(false);
        return;
      }
      if (!balasan.ok || isi?.data?.ok === false) {
        setGalat(isi?.data?.alasan || isi?.error?.message || "Centang tidak tersimpan.");
        return;
      }
      if (isi?.data?.kemajuan) setRinci(isi.data.kemajuan);
      onBerubah?.();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Centang tidak tersimpan.");
    } finally {
      setSibuk("");
    }
  };

  const ringkas = rinci
    ? { selesai: rinci.selesai, jumlah: rinci.jumlah, siap: rinci.siap }
    : kemajuan ?? null;

  return (
    <div className="mb-1" data-checklist-konseptor={perkaraId}>
      <button
        type="button"
        onClick={() => {
          // Dimuat saat dibuka (bukan lewat efek): tiap pembukaan membaca keadaan terbaru.
          if (!terbuka) void muat();
          setTerbuka(!terbuka);
        }}
        aria-expanded={terbuka}
        title="Langkah penyusunan draf putusan oleh konseptor - dapat dilihat seluruh majelis."
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-lg border px-2 py-0.5 text-left text-[11px] font-medium leading-snug transition",
          ringkas?.siap
            ? "border-emerald-400 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-emerald-200"
            : "border-violet-300 bg-card text-violet-900 hover:bg-violet-50 dark:border-violet-500/50 dark:text-violet-200 dark:hover:bg-violet-500/15"
        )}
      >
        <ListChecks className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>
          Checklist draf{" "}
          <span className="font-semibold">{ringkas ? (ringkas.siap ? "siap" : `${ringkas.selesai}/${ringkas.jumlah}`) : "-"}</span>
        </span>
        {terbuka ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
      </button>

      {terbuka ? (
        <div className="mt-1 rounded-lg border border-border bg-card p-2 text-[11px] leading-snug shadow-sm">
          {memuat && !rinci ? <div className="min-h-[1.25rem]" aria-busy="true" /> : null}

          {rinci ? (
            <>
              {konseptorSipp && konseptorSipp.length ? (
                <p className="mb-1 text-muted-foreground" data-konseptor-sipp>
                  Konseptor tercatat di SIPP: <span className="font-medium text-foreground">{konseptorSipp.join(", ")}</span>
                </p>
              ) : null}
              <p className="mb-1 text-muted-foreground" data-blangko-derry>
                {rinci.blangko
                  ? `Blangko Derry: ${rinci.blangko.berkas || "blangko putusan"} - ${rinci.blangko.terisi} dari ${rinci.blangko.jumlah} isian terisi` +
                    (rinci.blangko.pada ? ` (dibuka ${waktuSingkat(rinci.blangko.pada)})` : "") +
                    "."
                  : "Blangko putusan belum dibuka di Blangko ABT by Derry Briantono - isian kosong belum dapat diperiksa."}
              </p>
              <ul className="space-y-1">
                {rinci.langkah.map((l) => {
                  // Butir 36: "Dikoreksi majelis" terkunci bagi yang bukan majelis perkara ini.
                  const terkunciMajelis = l.hanyaMajelis && rinci.hakKoreksi === false;
                  return (
                  <li key={l.kode} className="flex items-start gap-1.5" data-langkah={l.kode} data-status={l.status} data-syarat={l.syarat || undefined}>
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-emerald-600"
                      checked={l.dicentang}
                      disabled={!bolehCentang || terkunciMajelis || sibuk === l.kode}
                      aria-label={`Tandai selesai: ${l.judul}`}
                      title={terkunciMajelis ? "Hanya ketua atau anggota majelis perkara ini yang dapat mencentang." : undefined}
                      onChange={(e) => void centang(l.kode, e.target.checked)}
                    />
                    <div className="min-w-0">
                      <span
                        className={cn(
                          "font-medium",
                          l.status === "selesai" && "text-emerald-700 dark:text-emerald-300",
                          l.status === "kosong" && "text-orange-700 dark:text-orange-300"
                        )}
                        title={l.keterangan}
                      >
                        {l.status === "selesai" ? <CheckCircle2 className="mr-0.5 inline h-3 w-3" aria-hidden="true" /> : null}
                        {l.judul}
                      </span>
                      {l.status === "selesai" && (l.oleh || l.pada) ? (
                        <span className="text-muted-foreground">
                          {" "}
                          - {l.sumber === "blangko" ? "terisi di blangko" : "selesai"}
                          {l.oleh ? ` oleh ${l.oleh}` : ""}
                          {l.pada ? `, ${waktuSingkat(l.pada)}` : ""}
                        </span>
                      ) : null}
                      {l.status === "kosong" && l.blangko ? (
                        <span className="block text-orange-700 dark:text-orange-300">
                          {l.blangko.jumlah - l.blangko.terisi} isian masih kosong di blangko
                          {l.blangko.kosong.length ? `: ${l.blangko.kosong.join(", ")}` : ""}
                          {l.dicentang ? " (sudah dicentang, tetapi belum dapat dianggap selesai)" : ""}.
                        </span>
                      ) : null}
                      {l.status === "belum" && l.dicentang === false && l.oleh && l.pada ? (
                        <span className="text-muted-foreground">
                          {" "}
                          - centang dicabut oleh {l.oleh}, {waktuSingkat(l.pada)}
                        </span>
                      ) : null}
                      {terkunciMajelis && l.status !== "selesai" ? (
                        <span className="block text-muted-foreground" data-hanya-majelis>
                          Dicentang ketua atau anggota majelis.
                        </span>
                      ) : null}
                    </div>
                  </li>
                  );
                })}
              </ul>
              {rinci.siap ? (
                <p className="mt-1 font-medium text-emerald-700 dark:text-emerald-300">Draf siap dibacakan.</p>
              ) : null}
              <BagianDrafH7 h7={h7} />
              {!bolehCentang ? (
                <p className="mt-1 text-muted-foreground">Anda dapat melihat kemajuan ini; centang hanya oleh majelis dan panitera pengganti.</p>
              ) : null}
            </>
          ) : null}

          {galat ? <p className="mt-1 text-red-600">{galat}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
