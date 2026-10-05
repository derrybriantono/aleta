"use client";

/**
 * ============================================================================
 * JADWAL MEDIASI: "SEDANG BERJALAN" DAN "SELESAI" - BUTIR 35 (5 OKT 2026)
 * ============================================================================
 *
 * Tombol Tandai berjalan / Selesai, lencana, dan bingkai baris - rupanya
 * mengikuti Jadwal Sidang (biru = berjalan, hijau = selesai). Datanya di basis
 * data ALETA (aleta_bot_mediasi_status) lewat /api/aleta-ecourt/mediasi-status.
 *
 * "Selesai" di sini = PERTEMUAN mediasi pada tanggal itu sudah selesai. Itu
 * bukan "selesai" SIPP (laporan mediator masuk), yang tetap ditampilkan kolom
 * Tenggang seperti sebelumnya - karena itu lencananya berbunyi "pertemuan
 * selesai".
 */

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, PlayCircle, Undo2 } from "lucide-react";

import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { cn } from "@/lib/utils";

export type StatusMediasi = {
  keadaan: "berjalan" | "selesai";
  sejak: string;
  oleh: string;
};

export type PetaStatusMediasi = Record<string, StatusMediasi>;

/** Kunci baris - SAMA dengan kunciBaris layar Jadwal Mediasi dan kunciMediasi bot. */
export function kunciStatusMediasi(mediasiId: string | number, tanggal: string) {
  return `${String(mediasiId ?? "").trim()}|${String(tanggal ?? "").slice(0, 10)}`;
}

/** Bingkai baris: biru berjalan, hijau selesai - kelas yang sama dengan Jadwal Sidang. */
export function kelasBarisMediasi(status: StatusMediasi | undefined): string {
  if (!status) return "";
  return status.keadaan === "berjalan"
    ? "border-l-4 border-l-sky-500 bg-sky-500/5 outline outline-2 -outline-offset-2 outline-sky-500/50"
    : "border-l-4 border-l-emerald-600 bg-emerald-500/5";
}

/**
 * Peta status untuk rentang yang tampil. Dibaca ulang tiap daftar mediasinya
 * dimuat ulang (`pemicu`), dan sesudah tombol ditekan (`muatUlang`).
 */
export function useStatusMediasi(dari: string, sampai: string, pemicu: unknown) {
  const [peta, setPeta] = useState<PetaStatusMediasi>({});
  const [alasan, setAlasan] = useState("");
  const [putaran, setPutaran] = useState(0);

  useEffect(() => {
    let batal = false;
    void (async () => {
      try {
        const params = new URLSearchParams({ dari, sampai });
        const jawaban = await fetch(apiPath(`/api/aleta-ecourt/mediasi-status?${params.toString()}`), {
          cache: "no-store",
        });
        const isi = await jawaban.json().catch(() => ({}));
        if (batal) return;
        const data = (isi?.data ?? isi) as { available?: boolean; ok?: boolean; alasan?: string; peta?: PetaStatusMediasi };
        if (!jawaban.ok || data.available === false || data.ok === false) {
          setAlasan(String(data.alasan || pesanGalatPortal(isi, "Status mediasi tidak terbaca.")));
          return;
        }
        setAlasan("");
        setPeta(data.peta && typeof data.peta === "object" ? data.peta : {});
      } catch (galat) {
        if (!batal) setAlasan(galat instanceof Error ? galat.message : String(galat));
      }
    })();
    return () => {
      batal = true;
    };
  }, [dari, sampai, pemicu, putaran]);

  const muatUlang = useCallback(() => setPutaran((x) => x + 1), []);
  return { peta, alasan, muatUlang };
}

function jam(teks: string) {
  const m = /(\d{2}:\d{2})/.exec(String(teks || ""));
  return m ? m[1] : "";
}

export function LencanaStatusMediasi({ status }: { status: StatusMediasi | undefined }) {
  if (!status) return null;
  const pukul = jam(status.sejak);
  if (status.keadaan === "berjalan") {
    return (
      <div
        data-mediasi-berjalan=""
        className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-sky-500 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-sky-800 dark:border-sky-400 dark:text-sky-200"
        title={`Ditandai sedang berjalan${status.oleh ? ` oleh ${status.oleh}` : ""}${pukul ? ` pukul ${pukul}` : ""}.`}
      >
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
        </span>
        sedang berjalan{pukul ? ` · ${pukul}` : ""}
      </div>
    );
  }
  return (
    <div
      data-mediasi-selesai=""
      className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-emerald-600 bg-emerald-600/15 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-emerald-800 dark:border-emerald-400 dark:text-emerald-200"
      title={`Pertemuan mediasi hari ini ditandai selesai${status.oleh ? ` oleh ${status.oleh}` : ""}${pukul ? ` pukul ${pukul}` : ""}. Bukan laporan mediator - itu tetap diisi di SIPP.`}
    >
      <CheckCircle2 className="h-3 w-3" aria-hidden />
      pertemuan selesai{pukul ? ` · ${pukul}` : ""}
    </div>
  );
}

export function TombolStatusMediasi({
  baris,
  status,
  onBerubah,
}: {
  baris: { mediasiId: string; perkaraId: string; nomorPerkara: string; tanggal: string; tempat?: string };
  status: StatusMediasi | undefined;
  onBerubah: () => void;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");

  const setel = async (keadaan: "berjalan" | "selesai", batal: boolean) => {
    if (batal && !window.confirm(`Batalkan tanda ${keadaan === "selesai" ? "selesai" : "sedang berjalan"} mediasi ${baris.nomorPerkara}?`)) {
      return;
    }
    setSibuk(true);
    setPesan("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/mediasi-status"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediasiId: baris.mediasiId,
          perkaraId: baris.perkaraId,
          tanggal: baris.tanggal,
          nomorPerkara: baris.nomorPerkara,
          tempat: baris.tempat ?? "",
          keadaan,
          batal,
          kering: false,
        }),
      });
      const isi = await jawaban.json().catch(() => ({}));
      const data = (isi?.data ?? isi) as { available?: boolean; ok?: boolean; alasan?: string; pesan?: string };
      if (!jawaban.ok || data.available === false || data.ok === false) {
        setPesan(String(data.pesan || data.alasan || pesanGalatPortal(isi, "Tanda belum tersimpan.")));
        return;
      }
      onBerubah();
    } catch (galat) {
      setPesan(galat instanceof Error ? galat.message : "Tanda belum tersimpan.");
    } finally {
      setSibuk(false);
    }
  };

  const berjalan = status?.keadaan === "berjalan";
  const selesai = status?.keadaan === "selesai";
  return (
    <span className="inline-flex flex-col items-end gap-1" data-tombol-status-mediasi>
      <span className="inline-flex flex-wrap justify-end gap-1">
        {!selesai ? (
          <button
            type="button"
            disabled={sibuk}
            aria-pressed={berjalan}
            onClick={() => void setel("berjalan", berjalan)}
            title={berjalan ? "Tekan untuk membatalkan tanda sedang berjalan." : "Tandai pertemuan mediasi ini sedang berjalan."}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition",
              berjalan
                ? "border-sky-600 bg-sky-600 text-white hover:bg-sky-700"
                : "text-muted-foreground hover:bg-sky-600/10 hover:text-sky-700 dark:hover:text-sky-300"
            )}
          >
            {berjalan ? <Undo2 className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
            {sibuk ? "…" : berjalan ? "Batalkan berjalan" : "Tandai berjalan"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={sibuk}
          aria-pressed={selesai}
          onClick={() => void setel("selesai", selesai)}
          title={selesai ? "Tekan untuk membatalkan tanda selesai." : "Tandai pertemuan mediasi hari ini selesai (bukan laporan mediator)."}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition",
            selesai
              ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
              : "text-muted-foreground hover:bg-emerald-600/10 hover:text-emerald-700 dark:hover:text-emerald-300"
          )}
        >
          {selesai ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
          {sibuk ? "…" : "Selesai"}
        </button>
      </span>
      {pesan ? <span className="max-w-[14rem] text-right text-[11px] text-rose-700 dark:text-rose-300">{pesan}</span> : null}
    </span>
  );
}
