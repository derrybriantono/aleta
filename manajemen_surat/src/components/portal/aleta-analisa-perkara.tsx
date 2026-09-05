"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { apiPath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * ANALISIS LANJUTAN - SATU TOMBOL, SATU PERHITUNGAN
 * ============================================================================
 *
 * Sepuluh analisis, dan tidak satu pun berjalan sampai tombolnya ditekan.
 *
 * Itu bukan kehati-hatian yang berlebihan: layar Status Perkara sudah
 * menjalankan tiga puluh satu kueri untuk membuka satu perkara, dan sebagian
 * analisis di sini mengagregasi seluruh register - membandingkan perkara ini
 * dengan ribuan perkara sejenis, atau menghitung beban seluruh perkara yang
 * pernah ditangani majelisnya. Menjalankan kesepuluhnya di muka berarti
 * MEMBUKA perkara menunggu angka yang mungkin tidak akan dilihat siapa pun.
 *
 * ============================================================================
 * SATU PERENDER UNTUK SEPULUHNYA
 * ============================================================================
 *
 * Bot menjawab dengan bentuk yang sama untuk seluruh analisis:
 *
 *     { judul, ringkas, metrik[], kolom[], baris[], catatan }
 *
 * sehingga di sini cukup satu komponen kecil, bukan sepuluh. Menambah analisis
 * kesebelas nanti tidak menuntut satu baris pun kode tampilan - cukup satu
 * fungsi di sisi bot.
 *
 * Hasil yang sudah diambil DISIMPAN: menekan tombol yang sama dua kali tidak
 * mengulang perhitungannya, dan berpindah antar analisis tidak kehilangan yang
 * sudah dibaca.
 */

type Metrik = { label: string; nilai: string; keterangan?: string };
type Kolom = { kunci: string; label: string; angka?: boolean };
type Hasil = {
  ok?: boolean;
  alasan?: string;
  judul?: string;
  ringkas?: string;
  metrik?: Metrik[];
  kolom?: Kolom[];
  baris?: Array<Record<string, unknown>>;
  catatan?: string;
};

/**
 * Daftarnya disalin dari sisi bot dengan sengaja.
 *
 * Tombolnya harus tergambar SEBELUM permintaan pertama - kalau daftarnya
 * diambil lewat jaringan, layarnya kosong sampai jawabannya tiba, dan itu
 * persis yang hendak dihindari. Kunci yang tidak dikenali bot dijawab
 * "jenis_analisa_tidak_dikenali", bukan menjalankan sesuatu yang lain.
 */
const ANALISA = [
  { kunci: "tenggat", label: "Ketepatan input", keterangan: "Jeda peristiwa ke input tiap tahapan" },
  { kunci: "sejenis", label: "Banding sejenis", keterangan: "Dibandingkan perkara jenis yang sama" },
  { kunci: "majelis", label: "Kinerja majelis", keterangan: "Beban dan kecepatan hakimnya" },
  { kunci: "pihak", label: "Riwayat pihak", keterangan: "Perkara lain lewat NIK, nama, dan tanggal lahir" },
  { kunci: "pasangan", label: "Pasangan pihak", keterangan: "Apakah kedua belah pihak pernah berhadapan" },
  { kunci: "panggilan", label: "Analisa panggilan", keterangan: "Tenggang, retur, dan cara panggil" },
  { kunci: "prakiraan", label: "Prakiraan selesai", keterangan: "Sebaran perkara sejenis yang sudah putus" },
  { kunci: "biaya", label: "Peta biaya", keterangan: "Panjar, pengeluaran, dan sisanya" },
  { kunci: "penundaan", label: "Pola penundaan", keterangan: "Jeda antar sidang dan alasannya" },
  { kunci: "ecourt", label: "Kelengkapan e-Court", keterangan: "Dokumen elektronik yang wajib ada" },
  { kunci: "kronologi", label: "Kronologi lengkap", keterangan: "Seluruh peristiwa dalam satu deret" },
];

export function AletaAnalisaPerkara({ nomorPerkara }: { nomorPerkara: string }) {
  const [terpilih, setTerpilih] = useState("");
  const [sibuk, setSibuk] = useState("");
  // Hasil yang sudah diambil disimpan supaya tidak dihitung ulang.
  const [simpanan, setSimpanan] = useState<Record<string, Hasil>>({});

  const ambil = useCallback(
    async (kunci: string) => {
      // Menekan tombol yang sedang terbuka menutupnya kembali - layar ini
      // panjang, dan menutup yang sudah dibaca lebih sering diperlukan
      // daripada membacanya dua kali.
      if (terpilih === kunci) {
        setTerpilih("");
        return;
      }

      setTerpilih(kunci);
      if (simpanan[kunci]) return;

      setSibuk(kunci);
      try {
        const respons = await fetch(
          apiPath(
            `/api/aleta-ecourt/analisa?nomor=${encodeURIComponent(nomorPerkara)}&jenis=${encodeURIComponent(kunci)}`
          ),
          { cache: "no-store" }
        );
        const isi = (await respons.json()) as { data?: Hasil };
        const hasil = (isi.data ?? isi) as Hasil;
        setSimpanan((sebelumnya) => ({ ...sebelumnya, [kunci]: hasil }));
      } catch (galat) {
        setSimpanan((sebelumnya) => ({
          ...sebelumnya,
          [kunci]: {
            ok: false,
            alasan: galat instanceof Error ? galat.message : String(galat),
          },
        }));
      } finally {
        setSibuk("");
      }
    },
    [nomorPerkara, simpanan, terpilih]
  );

  const hasil = terpilih ? simpanan[terpilih] : null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Tekan satu untuk menghitungnya. Yang tidak ditekan tidak dijalankan - sebagian analisis
        membandingkan perkara ini dengan ribuan perkara lain, dan itu perlu beberapa detik.
      </p>

      <div className="flex flex-wrap gap-2">
        {ANALISA.map((satu) => (
          <button
            key={satu.kunci}
            type="button"
            onClick={() => void ambil(satu.kunci)}
            title={satu.keterangan}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm transition",
              terpilih === satu.kunci
                ? "border-primary bg-primary/10 font-medium shadow-sm"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
            )}
          >
            {satu.label}
            {sibuk === satu.kunci ? " …" : ""}
          </button>
        ))}
      </div>

      {terpilih && sibuk === terpilih ? (
        <div className="rounded-lg border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
          Menghitung…
        </div>
      ) : null}

      {hasil ? <IsiAnalisa hasil={hasil} /> : null}
    </div>
  );
}

function IsiAnalisa({ hasil }: { hasil: Hasil }) {
  if (hasil.ok === false) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        {hasil.alasan || "Analisis ini belum dapat dijalankan."}
      </div>
    );
  }

  const kolom = hasil.kolom || [];
  const baris = hasil.baris || [];

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div>
        <h4 className="font-semibold">{hasil.judul}</h4>
        {hasil.ringkas ? <p className="mt-0.5 text-sm">{hasil.ringkas}</p> : null}
      </div>

      {/* Angka pokok lebih dulu. Yang membuka analisis biasanya mencari satu
          angka; tabelnya untuk yang ingin memeriksa dari mana angka itu. */}
      {hasil.metrik && hasil.metrik.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {hasil.metrik.map((satu) => (
            <div key={satu.label} className="rounded-lg border bg-muted/20 px-3 py-2">
              <p className="text-sm text-muted-foreground">{satu.label}</p>
              <p className="text-lg font-semibold tabular-nums">{satu.nilai}</p>
              {satu.keterangan ? (
                <p className="text-sm text-muted-foreground">{satu.keterangan}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {kolom.length > 0 && baris.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                {kolom.map((satu) => (
                  <th key={satu.kunci} className="px-2 py-1.5 font-medium text-muted-foreground">
                    {satu.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {baris.slice(0, 200).map((satu, urutan) => (
                <tr key={urutan} className="border-b last:border-0">
                  {kolom.map((k) => {
                    const nilai = satu[k.kunci];
                    return (
                      <td
                        key={k.kunci}
                        className={cn("px-2 py-1.5 align-top", k.angka ? "tabular-nums" : "")}
                      >
                        {nilai === null || nilai === undefined || nilai === "" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          String(nilai)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {baris.length > 200 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Ditampilkan 200 dari {baris.length} baris.
            </p>
          ) : null}
        </div>
      ) : null}

      {hasil.catatan ? (
        <p className="border-t pt-2 text-sm text-muted-foreground">{hasil.catatan}</p>
      ) : null}
    </div>
  );
}
