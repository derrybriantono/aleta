"use client";

import { useCallback, useState } from "react";

import { KabarDiantrekan, TanyaJamKerja, type PilihJamKerja } from "@/components/portal/pilihan-jam-kerja";
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
  // Di luar jam kerja (keputusan 104): pertanyaan Antrekan / Tulis sekarang.
  const [tanyaJam, setTanyaJam] = useState<string | null>(null);
  const [diantrekan, setDiantrekan] = useState("");

  const isi = useCallback(async (pilihJam?: PilihJamKerja) => {
    setTahap("sibuk");
    setPesan("");
    setTanyaJam(null);
    try {
      const balasan = await fetch(apiPath("/api/aleta-ecourt/sidang-ikrar-isi"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jadwalId, perkaraId, kering: false, tanyaJamKerja: true, ...(pilihJam ? { jamKerja: pilihJam } : {}) }),
      });
      const mentah = (await balasan.json()) as { data?: Record<string, unknown> } & Record<string, unknown>;
      const isiBalasan = (mentah && typeof mentah === "object" && "data" in mentah && mentah.data ? mentah.data : mentah) as {
        ok?: boolean;
        alasan?: string;
        error?: string;
        kode?: string;
        perluPilihan?: boolean;
        diantrekan?: boolean;
        pesan?: string;
        kalimat?: string;
        tanggalIkrar?: string;
        andaian?: string[];
        formSudahTerisi?: boolean;
        edocIkrar?: { ok?: boolean; nama?: string; pesan?: string; alasan?: string };
      };
      if (isiBalasan.perluPilihan || isiBalasan.kode === "di_luar_jam_kerja") {
        setTahap("diam");
        setTanyaJam(isiBalasan.pesan || isiBalasan.error || isiBalasan.alasan || "Sekarang di luar jam kerja.");
        return;
      }
      if (isiBalasan.ok && isiBalasan.diantrekan) {
        setTahap("selesai");
        setDiantrekan(isiBalasan.kalimat || isiBalasan.pesan || "");
        return;
      }
      if (isiBalasan.ok) {
        setTahap("selesai");
        const edoc = isiBalasan.edocIkrar;
        const kataEdoc = edoc
          ? edoc.ok
            ? ` e-Doc penetapan ikrar terunggah (${edoc.nama ?? "berkas"}).`
            : ` e-Doc penetapan ikrar BELUM terunggah: ${edoc.pesan ?? edoc.alasan ?? "sebab tidak dikenali"}`
          : "";
        setPesan(
          (isiBalasan.formSudahTerisi
            ? `Form ikrar talak ${nomorPerkara} sudah terisi di SIPP.`
            : `Form ikrar talak ${nomorPerkara} terisi di SIPP${isiBalasan.tanggalIkrar ? ` (tanggal ikrar ${isiBalasan.tanggalIkrar})` : ""}.`) +
            kataEdoc +
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

  if (tahap === "selesai" && diantrekan) {
    return <KabarDiantrekan pesan={diantrekan} />;
  }

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
      {tanyaJam !== null ? <TanyaJamKerja pesan={tanyaJam} sibuk={tahap === "sibuk"} onPilih={(p) => void isi(p)} /> : null}
      {tahap === "gagal" && pesan ? (
        <span className="text-[11px] text-red-700 dark:text-red-300" role="alert">
          {pesan}
        </span>
      ) : null}
    </span>
  );
}
