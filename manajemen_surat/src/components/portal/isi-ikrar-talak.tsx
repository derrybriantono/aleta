"use client";

import { useCallback, useState } from "react";

import { apiPath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

/**
 * Tombol "Isi form ikrar" pada baris Jadwal Sidang yang keterangannya sudah
 * menyatakan ikrar talak dilaksanakan (diisi lewat SIPP) tetapi form ikrarnya di
 * SIPP belum terisi. Dua langkah (tanya dulu, baru tulis) karena ini menulis ke
 * SIPP. Atas nama siapa ditulis diturunkan server dari perkaranya (ketua majelis
 * ikrar) - tidak ditanyakan di sini.
 */
export function IsiIkrarTalak({
  jadwalId,
  perkaraId,
  nomorPerkara,
  onSelesai,
}: {
  jadwalId: string | number;
  perkaraId?: string | number;
  nomorPerkara: string;
  onSelesai?: () => void;
}) {
  const [tahap, setTahap] = useState<"diam" | "tanya" | "sibuk" | "selesai" | "gagal">("diam");
  const [pesan, setPesan] = useState("");

  const isi = useCallback(async () => {
    setTahap("sibuk");
    setPesan("");
    try {
      const balasan = await fetch(apiPath("/api/aleta-ecourt/sidang-ikrar-isi"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jadwalId, perkaraId, kering: false }),
      });
      const mentah = (await balasan.json()) as { data?: Record<string, unknown> } & Record<string, unknown>;
      const isiBalasan = (mentah && typeof mentah === "object" && "data" in mentah && mentah.data ? mentah.data : mentah) as {
        ok?: boolean;
        alasan?: string;
        error?: string;
        tanggalIkrar?: string;
        andaian?: string[];
      };
      if (isiBalasan.ok) {
        setTahap("selesai");
        setPesan(
          `Form ikrar talak ${nomorPerkara} terisi di SIPP${isiBalasan.tanggalIkrar ? ` (tanggal ikrar ${isiBalasan.tanggalIkrar})` : ""}.` +
            (isiBalasan.andaian && isiBalasan.andaian.length ? ` ${isiBalasan.andaian.join(" ")}` : "")
        );
        onSelesai?.();
      } else {
        setTahap("gagal");
        setPesan(isiBalasan.error || isiBalasan.alasan || "Form ikrar tidak dapat diisi.");
      }
    } catch (e) {
      setTahap("gagal");
      setPesan(e instanceof Error ? e.message : "Permintaan gagal.");
    }
  }, [jadwalId, perkaraId, nomorPerkara, onSelesai]);

  if (tahap === "selesai") {
    return (
      <span className="text-[11px] text-emerald-800 dark:text-emerald-200" role="status">
        {pesan}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle" data-isi-ikrar="">
      {tahap === "tanya" ? (
        <>
          <span className="text-[11px]">Isi form ikrar {nomorPerkara} di SIPP sekarang?</span>
          <button
            type="button"
            onClick={() => void isi()}
            className="rounded-md border border-primary bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground"
          >
            Ya, isi
          </button>
          <button
            type="button"
            onClick={() => setTahap("diam")}
            className="rounded-md border px-1.5 py-0.5 text-[11px] font-semibold"
          >
            Batal
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={tahap === "sibuk"}
          onClick={() => setTahap("tanya")}
          title={`Isi form ikrar talak ${nomorPerkara} di SIPP (tanggal ikrar = tanggal sidang ini)`}
          aria-label={`Isi form ikrar talak ${nomorPerkara}`}
          className={cn(
            "rounded-md border border-emerald-500 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-500/15",
            tahap === "sibuk" && "opacity-60"
          )}
        >
          {tahap === "sibuk" ? "Mengisi…" : "Isi form ikrar"}
        </button>
      )}
      {tahap === "gagal" && pesan ? (
        <span className="text-[11px] text-red-700 dark:text-red-300" role="alert">
          {pesan}
        </span>
      ) : null}
    </span>
  );
}
