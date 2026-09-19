"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { apiPath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import { langgananAba, siarkanAba } from "@/lib/alat-bagian";

/**
 * ============================================================================
 * ANALISIS LANJUTAN - SATU TOMBOL, SATU PERHITUNGAN
 * ============================================================================
 *
 * Empat puluh satu analisis, dan tidak satu pun berjalan sampai tombolnya
 * ditekan.
 *
 * Itu bukan kehati-hatian yang berlebihan: layar Status Perkara sudah
 * menjalankan tiga puluh satu kueri untuk membuka satu perkara, dan sebagian
 * analisis di sini mengagregasi seluruh register - membandingkan perkara ini
 * dengan ribuan perkara sejenis, atau menghitung beban seluruh perkara yang
 * pernah ditangani majelisnya. Menjalankan seluruhnya di muka berarti
 * MEMBUKA perkara menunggu angka yang mungkin tidak akan dilihat siapa pun.
 *
 * ============================================================================
 * SATU PERENDER UNTUK SEMUANYA
 * ============================================================================
 *
 * Bot menjawab dengan bentuk yang sama untuk seluruh analisis:
 *
 *     { judul, ringkas, metrik[], kolom[], baris[], catatan }
 *
 * sehingga di sini cukup satu komponen kecil, bukan tiga puluh satu. Menambah
 * analisis berikutnya tidak menuntut satu baris pun kode tampilan - cukup satu
 * fungsi di sisi bot dan satu baris di daftar.
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
const ANALISA: Array<{
  kunci: string;
  lingkup: "perkara" | "pengadilan";
  label: string;
  keterangan: string;
}> = [
  // ---- lingkup perkara ----
  { kunci: "tenggat", lingkup: "perkara", label: "Ketepatan input", keterangan: "Jeda peristiwa ke input tiap tahapan" },
  { kunci: "kesehatan", lingkup: "perkara", label: "Kesehatan berkas", keterangan: "Satu angka kelengkapan berkas perkara ini" },
  { kunci: "suntingan", lingkup: "perkara", label: "Jejak suntingan", keterangan: "Data yang diubah sesudah diinput, oleh siapa" },
  { kunci: "pegawai", lingkup: "perkara", label: "Rapor pegawai", keterangan: "Rekam jejak penginput perkara ini di seluruh perkara" },
  { kunci: "tenggang", lingkup: "perkara", label: "Tenggang panggilan", keterangan: "Kepatuhan Pasal 122 HIR dan rekam juru sitanya" },
  { kunci: "aturan", lingkup: "perkara", label: "Pemantau SEMA/PERMA", keterangan: "Kepatuhan aturan yang berlaku pada perkara ini" },
  { kunci: "majelisBanding", lingkup: "perkara", label: "Majelis vs pengadilan", keterangan: "Majelis perkara ini dibanding nilai tengah pengadilan" },
  { kunci: "sejenis", lingkup: "perkara", label: "Banding sejenis", keterangan: "Dibandingkan perkara jenis yang sama" },
  { kunci: "majelis", lingkup: "perkara", label: "Kinerja majelis", keterangan: "Beban dan kecepatan hakimnya" },
  { kunci: "pihak", lingkup: "perkara", label: "Riwayat pihak", keterangan: "Perkara lain lewat NIK, nama, dan tanggal lahir" },
  { kunci: "pasangan", lingkup: "perkara", label: "Pasangan pihak", keterangan: "Apakah kedua belah pihak pernah berhadapan" },
  { kunci: "panggilan", lingkup: "perkara", label: "Analisa panggilan", keterangan: "Tenggang, retur, dan cara panggil" },
  { kunci: "prakiraan", lingkup: "perkara", label: "Prakiraan selesai", keterangan: "Sebaran perkara sejenis yang sudah putus" },
  { kunci: "biaya", lingkup: "perkara", label: "Peta biaya", keterangan: "Panjar, pengeluaran, dan sisanya" },
  { kunci: "penundaan", lingkup: "perkara", label: "Pola penundaan", keterangan: "Jeda antar sidang dan alasannya" },
  { kunci: "ecourt", lingkup: "perkara", label: "Kelengkapan e-Court", keterangan: "Dokumen elektronik yang wajib ada" },
  { kunci: "kronologi", lingkup: "perkara", label: "Kronologi lengkap", keterangan: "Seluruh peristiwa dalam satu deret" },
  { kunci: "periksaPertimbangan", lingkup: "perkara", label: "Pemeriksa pertimbangan", keterangan: "Petitum yang belum menemukan padanan di amar atau pertimbangan" },
  { kunci: "ringkasan", lingkup: "perkara", label: "Ringkasan perkara", keterangan: "Satu paragraf bahasa sederhana dari fakta yang tercatat" },
  { kunci: "mutuPertimbangan", lingkup: "perkara", label: "Mutu pertimbangan", keterangan: "Panjang dan kepadatan rujukan pertimbangan hukumnya" },
  { kunci: "keajekan", lingkup: "perkara", label: "Keajekan putusan", keterangan: "Sebaran hasil antar majelis untuk jenis perkara ini" },

  // ---- lingkup pengadilan ----
  { kunci: "bulanan", lingkup: "pengadilan", label: "Papan kendali bulanan", keterangan: "Masuk, putus, dan sisanya per bulan" },
  { kunci: "beban", lingkup: "pengadilan", label: "Sebaran beban", keterangan: "Pembagian perkara antar hakim, PP, dan juru sita" },
  { kunci: "periode", lingkup: "pengadilan", label: "Banding antar periode", keterangan: "Bulan ini lawan bulan lalu dan tahun lalu" },
  { kunci: "wilayah", lingkup: "pengadilan", label: "Sebaran wilayah", keterangan: "Dari kecamatan mana perkara paling banyak datang" },
  { kunci: "musim", lingkup: "pengadilan", label: "Musim perkara", keterangan: "Bulan dan hari mana yang paling padat" },
  { kunci: "corong", lingkup: "pengadilan", label: "Corong perkara", keterangan: "Di mana perkara tersendat, dari daftar sampai arsip" },
  { kunci: "profil", lingkup: "pengadilan", label: "Profil pihak", keterangan: "Umur, pekerjaan, pendidikan, dan usia pernikahan" },
  { kunci: "berisiko", lingkup: "pengadilan", label: "Perkara berisiko", keterangan: "Yang mendekati atau melewati ambang lima bulan" },
  { kunci: "anomali", lingkup: "pengadilan", label: "Deteksi anomali", keterangan: "Perkara yang menyimpang dari kebiasaan jenisnya" },
  { kunci: "upayaHukum", lingkup: "pengadilan", label: "Profil upaya hukum", keterangan: "Angka dasar banding, kasasi, dan PK - bukan prakiraan" },

  // ---- sepuluh tambahan (2.24.0) ----
  //
  // Daftarnya disalin dari peladen, bukan diminta darinya. Alamat daftar
  // memang ada, tetapi memintanya berarti layar ini menunggu satu pembacaan
  // sebelum dapat menggambar satu tombol pun - dan yang digambar hanya nama.
  // Yang TIDAK boleh menyimpang adalah KUNCInya; label boleh berbeda ejaan,
  // kunci yang berbeda berarti tombol yang menjawab "jenis tidak dikenali".
  { kunci: "jedaTahapan", lingkup: "perkara", label: "Jeda antar tahapan", keterangan: "Di mana perkara ini berhenti lama" },
  { kunci: "hariSidang", lingkup: "perkara", label: "Hari sidang", keterangan: "Hari apa perkara ini bersidang, dibanding pengadilan" },
  { kunci: "kecepatanRelaas", lingkup: "perkara", label: "Kecepatan relaas", keterangan: "Jarak panggilan ke sidang, dan Pasal 122 HIR" },
  { kunci: "kehadiranPihak", lingkup: "perkara", label: "Kehadiran pihak", keterangan: "Siapa yang datang pada tiap sidang" },
  { kunci: "desaPihak", lingkup: "perkara", label: "Perkara sedesa", keterangan: "Perkara lain dari desa pihak pertama" },
  { kunci: "bebanMajelisBulan", lingkup: "perkara", label: "Beban majelis bulan itu", keterangan: "Berapa perkara dipikul majelisnya bulan pendaftaran" },
  { kunci: "jedaSesudahPutus", lingkup: "perkara", label: "Jeda sesudah putus", keterangan: "Minutasi, BHT, dan akta cerai" },
  { kunci: "jamSidang", lingkup: "perkara", label: "Jam sidang", keterangan: "Jam berapa perkara ini disidangkan" },
  { kunci: "ruangSidang", lingkup: "perkara", label: "Ruang sidang", keterangan: "Dalam gedung atau sidang keliling" },
  { kunci: "rombonganSepekan", lingkup: "perkara", label: "Rombongan sepekan", keterangan: "Perkara yang masuk pada pekan yang sama" },
];

export function AletaAnalisaPerkara({ nomorPerkara }: { nomorPerkara: string }) {
  const [terpilih, setTerpilih] = useState("");
  const [sibuk, setSibuk] = useState("");
  // Hasil yang sudah diambil disimpan supaya tidak dihitung ulang.
  const [simpanan, setSimpanan] = useState<Record<string, Hasil>>({});

  /**
   * Analisis yang diminta dari tempat lain - kartu identitas pihak, misalnya.
   *
   * Didengarkan di sini alih-alih diterima sebagai prop: prop menuntut
   * induknya memegang keadaan, dan induknya adalah layar sepanjang dua puluh
   * tujuh bagian yang akan digambar ulang seluruhnya tiap kali satu analisis
   * dipilih.
   */
  // Disimpan pada ref supaya pendengarnya tidak perlu dipasang ulang tiap kali
  // `ambil` lahir kembali - dan `ambil` lahir kembali tiap kali simpanannya
  // berubah, yaitu tiap kali satu analisis selesai dihitung.
  const ambilRef = useRef<((kunci: string, paksa?: boolean) => Promise<void>) | null>(null);

  useEffect(
    () =>
      langgananAba((aba) => {
        if (aba.jenis !== "analisa") return;
        if (!ANALISA.some((x) => x.kunci === aba.kunci)) return;
        void ambilRef.current?.(aba.kunci, true);
      }),
    []
  );

  const ambil = useCallback(
    async (kunci: string, paksa = false) => {
      // Menekan tombol yang sedang terbuka menutupnya kembali - layar ini
      // panjang, dan menutup yang sudah dibaca lebih sering diperlukan
      // daripada membacanya dua kali.
      if (terpilih === kunci && !paksa) {
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

  ambilRef.current = ambil;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Tekan satu untuk menghitungnya. Yang tidak ditekan tidak dijalankan - sebagian analisis
        membandingkan perkara ini dengan ribuan perkara lain, dan itu perlu beberapa detik.
      </p>

      {/* ==================================================================
          DUA KELOMPOK, DAN PEMISAHANNYA MENENTUKAN
          ==================================================================

          Sebagian analisis menjawab tentang PERKARA INI; sebagian lagi
          tentang SELURUH PENGADILAN, dan angkanya sama siapa pun perkara
          yang sedang dibuka.

          Menaruhnya dalam satu deret tombol membuat papan kendali bulanan
          terbaca sebagai keterangan perkara ini - dan angka pengadilan yang
          disangka angka perkara adalah kekeliruan yang tidak menampakkan
          dirinya sendiri: keduanya sama-sama berupa angka yang masuk akal. */}
      {(["perkara", "pengadilan"] as const).map((lingkup) => {
        const kelompok = ANALISA.filter((x) => x.lingkup === lingkup);
        if (kelompok.length === 0) return null;

        return (
          <div key={lingkup} className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {lingkup === "perkara" ? "Tentang perkara ini" : "Tentang seluruh pengadilan"}
              {lingkup === "pengadilan" ? (
                <span className="ml-1.5 font-normal">
                  — angkanya sama siapa pun perkara yang dibuka
                </span>
              ) : null}
            </p>

            <div className="flex flex-wrap gap-2">
              {kelompok.map((satu) => (
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
          </div>
        );
      })}

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
