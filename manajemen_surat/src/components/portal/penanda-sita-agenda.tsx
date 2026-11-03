"use client";

/**
 * Penanda Sita di kolom Agenda Jadwal Sidang, dan bagian "Eksepsi,
 * rekonvensi, sita & eksekusi" di rincian Jadwal Sidang dan Status Perkara
 * (antrian sidang butir 22-24, 12 Okt 2026). Aturannya di lib/penanda-sita.ts;
 * penentu sitanya di bot (sitaEksekusiPerkaraService).
 *
 * Berkas sendiri, bukan di aleta-ecourt-sidang.tsx / status perkara: layar itu
 * hanya memasang satu elemen di blok berlabel 12OKT-K.
 */

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import type { PenandaJawabanPerkara } from "@/lib/penanda-jawaban";
import {
  butirSita,
  keadaanJawaban,
  penandaSitaBaris,
  ringkasanEksekusi,
  tanggalTampil,
  type BarisPenandaSita,
  type EksekusiPerkara,
  type SitaPerkara,
} from "@/lib/penanda-sita";
import { KUNCI_SIMPANAN_TAMPILAN, bacaTampilan, tampil } from "@/lib/tampilan-antrian-sidang";
import { cn } from "@/lib/utils";

/**
 * Lencana Sita di kolom Agenda, tepat di bawah Eksepsi/Rekonvensi. Gaya sama
 * dengan PenandaJawabanAgenda. Tidak ada / tidak terbaca = tidak digambar.
 */
export function PenandaSitaAgenda({ baris, onBuka }: { baris: BarisPenandaSita; onBuka?: () => void }) {
  const penanda = penandaSitaBaris(baris);
  if (penanda.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {penanda.map((p) => (
        <button
          key={p.kunci}
          type="button"
          data-penanda-sita={p.kunci}
          onClick={onBuka}
          disabled={!onBuka}
          className={cn(
            "whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold disabled:cursor-default",
            p.kelas
          )}
          title={p.keterangan}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Saklar panel Tampilan Jadwal Sidang untuk layar yang tidak memegang
 * pilihan itu sendiri (Status Perkara) - pola useSaklarKumulasi. Bawaan
 * menyala; gagal dibaca = bawaan; ikut berubah bila panelnya diubah di tab lain.
 */
export function useSaklarTampilanAntrian(kunci: string): boolean {
  const [menyala, setMenyala] = useState(true);
  useEffect(() => {
    const baca = () => {
      try {
        setMenyala(tampil(bacaTampilan(window.localStorage.getItem(KUNCI_SIMPANAN_TAMPILAN)), kunci));
      } catch {
        /* bawaan tetap */
      }
    };
    baca();
    const dengar = (e: StorageEvent) => {
      if (e.key === null || e.key === KUNCI_SIMPANAN_TAMPILAN) baca();
    };
    window.addEventListener("storage", dengar);
    return () => window.removeEventListener("storage", dengar);
  }, [kunci]);
  return menyala;
}

export type BahanRincianJawabanSita = {
  penandaJawaban?: PenandaJawabanPerkara | null;
  penandaJawabanTerbaca?: boolean;
  sita?: SitaPerkara | null;
  eksekusi?: EksekusiPerkara[];
  sitaTerbaca?: boolean;
};

/**
 * SATU penentu "ada isi" untuk Jadwal Sidang dan Status Perkara (butir 21-22,
 * 3 Nov 2026): yang tampil hanya yang ADA. Eksepsi/rekonvensi hanya bila
 * diajukan, sita hanya bila ada permohonan/catatan, eksekusi hanya bila ada.
 * Yang tidak dapat dibaca tetap dilaporkan (jangan diam atas data yang gagal
 * dibaca), tetapi bukan "tidak ada".
 */
export function isiJawabanSitaEksekusi(
  bahan: BahanRincianJawabanSita,
  saklar: { tampilJawaban: boolean; tampilSita: boolean; tampilEksekusi?: boolean }
) {
  const adaJawaban = saklar.tampilJawaban && bahan.penandaJawabanTerbaca !== undefined;
  const adaSita = saklar.tampilSita && bahan.sitaTerbaca !== undefined;
  const adaEksekusi = Boolean(saklar.tampilEksekusi) && bahan.sitaTerbaca !== undefined;
  const jawabanTakTerbaca = adaJawaban && bahan.penandaJawabanTerbaca === false;
  const jawaban =
    adaJawaban && !jawabanTakTerbaca
      ? keadaanJawaban(bahan.penandaJawaban, bahan.penandaJawabanTerbaca).filter((k) => k.ada)
      : [];
  const sitaTakTerbaca = (adaSita || adaEksekusi) && bahan.sitaTerbaca === false;
  const sita = adaSita && !sitaTakTerbaca ? butirSita(bahan.sita) : [];
  const eksekusi = adaEksekusi && !sitaTakTerbaca && Array.isArray(bahan.eksekusi) ? bahan.eksekusi : [];
  const tampil = jawaban.length > 0 || sita.length > 0 || eksekusi.length > 0 || jawabanTakTerbaca || sitaTakTerbaca;
  return { adaJawaban, adaSita, adaEksekusi, jawaban, sita, eksekusi, jawabanTakTerbaca, sitaTakTerbaca, tampil };
}

/** Kelas kotak bersama Kumulasi/Eksepsi - huruf selaras layar sekitarnya (butir 21-22). */
export const KELAS_KOTAK_KETERANGAN = "rounded-lg border border-border/70 bg-card/60 px-3 py-2 text-sm";

/**
 * Bagian rincian: Eksepsi & Rekonvensi (saklar penanda-jawaban), Sita dan
 * Eksekusi (saklar penanda-eksekusi, terpisah sejak 12 Okt sore). Semua
 * saklar mati = tidak digambar.
 * Bot lama yang belum mengirim ruasnya (Terbaca undefined) = bagiannya diam.
 *
 * `hanyaYangAda` (Jadwal Sidang dan Status Perkara): seluruh blok hilang bila
 * tidak ada isi, dan bila ada hanya baris yang berisi yang digambar. Komponen
 * ini dipanggil dari SATU tempat per layar supaya letaknya mudah digeser.
 */
export function RincianJawabanSitaEksekusi({
  bahan,
  tampilJawaban,
  tampilSita,
  tampilEksekusi = false,
  hanyaYangAda = false,
}: {
  bahan: BahanRincianJawabanSita;
  tampilJawaban: boolean;
  tampilSita: boolean;
  /** 12OKT-N: saklar penanda-eksekusi, terpisah dari penanda-sita. */
  tampilEksekusi?: boolean;
  hanyaYangAda?: boolean;
}) {
  const isi = isiJawabanSitaEksekusi(bahan, { tampilJawaban, tampilSita, tampilEksekusi });
  const { adaJawaban, adaSita, adaEksekusi } = isi;
  if (!adaJawaban && !adaSita && !adaEksekusi) return null;
  if (hanyaYangAda && !isi.tampil) return null;
  const sita = butirSita(bahan.sita);
  const eksekusi = Array.isArray(bahan.eksekusi) ? bahan.eksekusi : [];
  const rinci = !hanyaYangAda;
  const baris = rinci
    ? { jawaban: adaJawaban, sita: adaSita, eksekusi: adaEksekusi }
    : {
        jawaban: adaJawaban && (isi.jawaban.length > 0 || isi.jawabanTakTerbaca),
        sita: adaSita && (sita.length > 0 || bahan.sitaTerbaca === false),
        eksekusi: adaEksekusi && (eksekusi.length > 0 || bahan.sitaTerbaca === false),
      };
  const judul = [
    baris.jawaban ? "Eksepsi & rekonvensi" : "",
    baris.sita ? "sita" : "",
    baris.eksekusi ? "eksekusi" : "",
  ]
    .filter(Boolean)
    .join(", ");
  const judulTampil = hanyaYangAda ? judul.charAt(0).toUpperCase() + judul.slice(1) : judul;
  return (
    <div className={KELAS_KOTAK_KETERANGAN} data-rincian-jawaban-sita="">
      <div className="mb-1 font-semibold">{judulTampil}</div>
      <ul className="space-y-1">
        {baris.jawaban
          ? keadaanJawaban(bahan.penandaJawaban, bahan.penandaJawabanTerbaca)
              .filter((k) => rinci || k.ada || bahan.penandaJawabanTerbaca === false)
              .map((k) => (
                <li key={k.judul} data-keadaan-jawaban={k.ada ? "ada" : "tidak"}>
                  <span className="font-medium">{k.judul}:</span>{" "}
                  <span className={k.ada ? "font-semibold" : "text-muted-foreground"}>{k.isi}</span>
                  {k.kalimat ? <div className="mt-0.5 break-words italic text-muted-foreground">&ldquo;{k.kalimat}&rdquo;</div> : null}
                </li>
              ))
          : null}
        {baris.sita ? (
          <li data-rincian-sita="">
            <span className="font-medium">Sita:</span>{" "}
            {bahan.sitaTerbaca === false ? (
              <span className="text-muted-foreground">tidak dapat dibaca saat ini</span>
            ) : sita.length === 0 ? (
              <span className="text-muted-foreground">tidak ada permohonan sita di petitum, tidak ada catatan sita di SIPP</span>
            ) : (
              <ul className="mt-0.5 space-y-1 pl-3">
                {sita.map((b) => (
                  <li key={`${b.kode}:${b.nama}`}>
                    <span className="font-semibold">{b.nama}</span>{" "}
                    <Badge variant={b.sumber === "sipp" ? "muted" : "warning"} className="px-1.5 py-0 text-xs">
                      {b.sumber === "petitum" ? "dari petitum" : b.sumber === "sipp" ? "SIPP" : "petitum + SIPP"}
                    </Badge>
                    {b.kutipan ? <div className="mt-0.5 break-words italic text-muted-foreground">&ldquo;{b.kutipan}&rdquo;</div> : null}
                    {b.catatanSipp ? <div className="mt-0.5 text-muted-foreground">SIPP: {b.catatanSipp}</div> : null}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ) : null}
        {baris.eksekusi ? (
          <li data-rincian-eksekusi="">
            <span className="font-medium">Eksekusi:</span>{" "}
            {bahan.sitaTerbaca === false ? (
              <span className="text-muted-foreground">tidak dapat dibaca saat ini</span>
            ) : eksekusi.length === 0 ? (
              <span className="text-muted-foreground">tidak ada permohonan eksekusi tercatat di SIPP</span>
            ) : (
              <ul className="mt-0.5 space-y-1 pl-3">
                {eksekusi.map((e, i) => (
                  <li key={`${e.nomorRegister}-${i}`}>
                    <div className="font-semibold">{ringkasanEksekusi(e)}</div>
                    {e.nomorPutusanDieksekusi ? (
                      <div className="text-muted-foreground">
                        Putusan yang dieksekusi: {e.nomorPutusanDieksekusi}
                        {e.tingkatPutusan ? ` (${e.tingkatPutusan})` : ""}
                      </div>
                    ) : null}
                    {e.tahap.length > 0 ? (
                      <div className="text-muted-foreground">
                        {e.tahap.map((t) => `${t.nama} ${tanggalTampil(t.tanggal)}`).join(" · ")}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ) : null}
      </ul>
      {!hanyaYangAda && adaSita && sita.some((b) => b.sumber !== "sipp") ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Sita bertanda &ldquo;dari petitum&rdquo; dibaca ALETA dari tuntutan primer - yang diminta penggugat, belum tentu
          sudah diletakkan.
        </p>
      ) : null}
    </div>
  );
}
