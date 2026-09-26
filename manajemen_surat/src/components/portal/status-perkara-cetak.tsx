"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  pengukurKanvas,
  susunTataLetakCetak,
  type PengukurTeks,
} from "@/components/portal/status-perkara-cetak-lebar";
import { tanggalPanjangDenganHari } from "@/lib/tanggal-indonesia";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";

/**
 * Lembar cetak hasil pencarian Status Perkara.
 *
 * ============================================================================
 * POLANYA SAMA DENGAN LEMBAR CETAK JADWAL
 * ============================================================================
 *
 * aleta-ecourt-cetak-jadwal.tsx sudah menempuh jalan ini: lembar disusun dari
 * data yang SUDAH ada di layar, ditempel ke body lewat portal, dan aturan
 * cetaknya membunyikan seluruh anak body selain lembar ini. Tidak ada tab baru,
 * tidak ada rute kedua yang harus dijaga kewenangannya, tidak ada pemuatan
 * ulang data yang bisa berbeda dari yang sedang dibaca orang.
 *
 * ============================================================================
 * LEMBAR INI TIDAK TAHU APA ITU PERKARA
 * ============================================================================
 *
 * Ia hanya menerima kepala kolom dan teks tiap sel yang sudah jadi. Urutan dan
 * saringan yang sedang tampil sudah diterapkan oleh yang memanggil - lembar
 * yang mengurutkan sendiri akan mencetak urutan yang berbeda dari layar, dan
 * orang yang membandingkan keduanya tidak punya cara tahu mana yang benar.
 *
 * ============================================================================
 * TIDAK TERPOTONG DI KANAN
 * ============================================================================
 *
 * table-layout: fixed dengan lebar 100% memaksa seluruh kolom masuk ke lebar
 * kertas; teks yang tetap lebih lebar dari kolomnya dipatahkan di dalam selnya
 * (overflow-wrap: anywhere), bukan didorong keluar tepi. Lebar kolom dinyatakan
 * dalam persen dan jumlahnya selalu 100.
 *
 * Terukur di peramban pada bidang cetak 277 mm (A4 mendatar dikurangi tepi
 * 10 mm): 22 kolom, lebar tabel = lebar bidang, tidak satu kolom pun lewat
 * kanan dan tidak satu sel pun meluap.
 *
 * ============================================================================
 * KATA TIDAK DIPATAHKAN BILA MASIH DAPAT DIHINDARI
 * ============================================================================
 *
 * Lebar kolom dan ukuran hurufnya disusun dari kata terpanjang tiap kolom -
 * lihat status-perkara-cetak-lebar.ts. Dengan bobot tetap saja, "Semua kolom"
 * mematahkan 350 dari 2.222 sel termasuk seluruh nomor perkara (telaah 26
 * September 2026).
 */

export const ID_LEMBAR_CETAK_HASIL = "aleta-cetak-hasil-perkara";

const GAYA_CETAK = `
@media print {
  body > *:not(#${ID_LEMBAR_CETAK_HASIL}) { display: none !important; }
  #${ID_LEMBAR_CETAK_HASIL} { display: block !important; }
  @page { size: A4 landscape; margin: 10mm; }
}
#${ID_LEMBAR_CETAK_HASIL} { display: none; }
#${ID_LEMBAR_CETAK_HASIL} table { table-layout: fixed; width: 100%; border-collapse: collapse; }
#${ID_LEMBAR_CETAK_HASIL} th, #${ID_LEMBAR_CETAK_HASIL} td { overflow-wrap: anywhere; word-break: break-word; }
#${ID_LEMBAR_CETAK_HASIL} thead { display: table-header-group; }
#${ID_LEMBAR_CETAK_HASIL} tr { break-inside: avoid; page-break-inside: avoid; }
`;

export function LembarCetakHasil({
  namaPengadilan,
  kriteria,
  catatan,
  kepala,
  bobot,
  utuh,
  baris,
  ukur,
  onSelesai,
}: {
  namaPengadilan: string;
  /** Kalimat-kalimat kriteria pencarian: kata, saringan, tag, rentang waktu. */
  kriteria: string[];
  /** Kalimat tambahan tentang urutan, saringan di layar, dan yang belum termuat. */
  catatan: string[];
  /** Kepala kolom, TANPA kolom nomor urut - kolom itu ditambahkan di sini. */
  kepala: string[];
  /**
   * Bobot lebar tiap kolom, sejajar dengan `kepala`. Tanpa bobot semua kolom
   * dibagi rata. Lebarnya dinyatakan dalam PERSEN dan jumlahnya 100 - jadi
   * sebanyak apa pun kolom yang dipilih, tabelnya tidak pernah melebihi lebar
   * kertas.
   */
  bobot?: number[];
  /**
   * Kolom yang katanya tidak boleh dipatahkan (nomor, tanggal, angka...),
   * sejajar dengan `kepala`. Hanya berarti bila kolomnya tidak muat utuh
   * seluruhnya - lihat status-perkara-cetak-lebar.ts.
   */
  utuh?: boolean[];
  /** Teks tiap sel, baris demi baris, dalam urutan yang sedang tampil. */
  baris: string[][];
  /**
   * Pengukur teks. Tidak diisi: kanvas peramban. null: tanpa pengukuran -
   * lebar menurut bobot saja. Uji mengisinya dengan pengukur buatan.
   */
  ukur?: PengukurTeks | null;
  onSelesai: () => void;
}) {
  // Pengukurnya dibuat sekali seumur lembar - kanvas yang sama untuk semua kata.
  const [pengukur] = useState<PengukurTeks | null>(() => (ukur === undefined ? pengukurKanvas() : ukur));
  const tataLetak = useMemo(
    () => susunTataLetakCetak({ kepala, baris, bobot, utuh, ukur: pengukur }),
    [kepala, baris, bobot, utuh, pengukur]
  );

  useEffect(() => {
    // Cetak dipanggil sesudah lembarnya benar-benar tergambar. Memanggilnya
    // pada putaran yang sama menghasilkan halaman kosong pada sebagian
    // peramban - isinya belum sempat masuk ke pohon tampilan.
    const timer = window.setTimeout(() => {
      window.print();
      onSelesai();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [onSelesai]);

  if (typeof document === "undefined") return null;

  // Tanggal cetak menurut jam PENGADILAN (WITA), bukan jam mesin yang
  // mencetak - lembar yang dicetak dari laptop berzona lain tetap menyebut
  // hari yang sama dengan register.
  const kini = waktuPengadilan();
  const huruf = `${tataLetak.ukuranPt}pt`;
  const lebar = tataLetak.lebarPersen;
  const padding = `${tataLetak.padding.atas}px ${tataLetak.padding.samping}px`;

  const isi = (
    <div id={ID_LEMBAR_CETAK_HASIL} style={{ color: "#000", background: "#fff" }}>
      <style>{GAYA_CETAK}</style>

      <div style={{ fontFamily: "serif", padding: "0 0 8px" }}>
        <h1 style={{ margin: 0, fontSize: "15pt", textAlign: "center" }}>HASIL PENCARIAN PERKARA</h1>
        <h2
          style={{
            margin: "2px 0 0",
            fontSize: "12pt",
            textAlign: "center",
            fontWeight: 600,
            textTransform: "uppercase",
          }}
        >
          {namaPengadilan}
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: "9.5pt", textAlign: "center" }}>
          {baris.length.toLocaleString("id-ID")} perkara · dicetak{" "}
          {tanggalPanjangDenganHari(kini.tanggal, kini.tanggal)} pukul {kini.jam.slice(0, 5)} WITA
        </p>
      </div>

      {/* Kriteria DITULIS SEBAGAI KALIMAT. Lembar berisi dua puluh nomor
          perkara tanpa pertanyaannya akan dibaca orang berikutnya sebagai
          seluruh perkara - bukan sebagai jawaban atas satu pertanyaan. */}
      <div style={{ fontFamily: "sans-serif", fontSize: "8.5pt", margin: "0 0 6px" }} data-bagian="kriteria">
        <p style={{ margin: 0, fontWeight: 700 }}>Kriteria pencarian:</p>
        {kriteria.length === 0 ? (
          <p style={{ margin: "1px 0 0" }}>(tidak tercatat)</p>
        ) : (
          kriteria.map((kalimat, i) => (
            <p key={i} style={{ margin: "1px 0 0" }}>
              {kalimat}
            </p>
          ))
        )}
        {catatan.map((kalimat, i) => (
          <p key={`c${i}`} style={{ margin: "1px 0 0", fontStyle: "italic" }}>
            {kalimat}
          </p>
        ))}
      </div>

      <table style={{ fontSize: huruf, fontFamily: "sans-serif" }} data-terukur={tataLetak.terukur ? "ya" : "tidak"}>
        <colgroup>
          {lebar.map((persen, i) => (
            <col key={i} style={{ width: persen }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {["No", ...kepala].map((judul) => (
              <th
                key={judul}
                style={{
                  border: "1px solid #000",
                  padding,
                  background: "#e8e8e8",
                  textAlign: "left",
                  fontWeight: 700,
                  verticalAlign: "bottom",
                }}
              >
                {judul}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.map((sel, urutan) => (
            <tr key={urutan}>
              <td style={gayaSel(padding, { textAlign: "right" })}>{urutan + 1}</td>
              {sel.map((teks, i) => (
                <td key={i} style={gayaSel(padding)}>
                  {teks}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: "8px", fontSize: "7.5pt", fontFamily: "sans-serif" }}>
        Dicetak dari ALETA. Sumber data: SIPP.
      </p>
    </div>
  );

  return createPortal(isi, document.body);
}

function gayaSel(padding: string, tambahan: React.CSSProperties = {}): React.CSSProperties {
  return {
    border: "1px solid #000",
    padding,
    verticalAlign: "top",
    ...tambahan,
  };
}
