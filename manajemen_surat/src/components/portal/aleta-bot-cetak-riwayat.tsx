"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Lembar cetak riwayat pengiriman pesan - untuk pelaporan ke pihak luar.
 *
 * ============================================================================
 * DICETAK DARI HALAMAN YANG SAMA, TANPA TAB BARU
 * ============================================================================
 *
 * Pola yang sama dengan lembar cetak jadwal sidang: disusun dari data yang
 * SUDAH dimuat dengan penyaring yang sedang aktif, ditempel ke body lewat
 * portal, dan aturan cetaknya menyembunyikan seluruh anak body yang lain.
 * Menyembunyikan bagian aplikasi satu per satu akan gagal begitu ada bagian
 * baru - dan yang tercetak menjadi sidebar dan tombol.
 *
 * ============================================================================
 * LAPORAN MENYEBUT SARINGANNYA
 * ============================================================================
 *
 * Lembar yang dicetak dari hasil saringan harus mengatakannya di kepalanya.
 * Daftar dua puluh pesan tanpa keterangan dibaca orang luar sebagai seluruh
 * pengiriman bulan itu. Karena itu kepala laporan memuat rentang waktu,
 * setiap penyaring yang aktif, urutannya, dan jumlah per status atas SELURUH
 * hasil saringan - bukan hanya baris yang muat di halaman.
 */

export type BarisCetakRiwayat = {
  id: string;
  recipientName: string;
  recipientNumber: string;
  recipientNumberMasked: boolean;
  penerima: "pegawai" | "pihak" | "";
  caseOrPosition: string;
  statusLabel: string;
  status: string;
  sourceFeatureLabel: string;
  createdAt: string;
  sentAt: string | null;
  errorMessage: string | null;
  messagePreview: string;
};

export type RingkasanCetakRiwayat = {
  total: number;
  terkirim: number;
  gagal: number;
  simulasi: number;
  lainnya: number;
};

const GAYA_CETAK = `
@media print {
  body > *:not(#aleta-cetak-riwayat) { display: none !important; }
  #aleta-cetak-riwayat { display: block !important; }
  @page { size: A4 landscape; margin: 12mm; }
}
#aleta-cetak-riwayat { display: none; }
#aleta-cetak-riwayat table { page-break-inside: auto; }
#aleta-cetak-riwayat tr { page-break-inside: avoid; page-break-after: auto; }
#aleta-cetak-riwayat thead { display: table-header-group; }
`;

function tulisWaktu(iso: string | null | undefined) {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Makassar",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

function tulisTanggalPanjang(tanggal: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Makassar",
  }).format(tanggal);
}

const sel: React.CSSProperties = {
  border: "1px solid #000",
  padding: "3px 5px",
  verticalAlign: "top",
  wordBreak: "break-word",
};

const kepala: React.CSSProperties = {
  ...sel,
  background: "#e5e5e5",
  fontWeight: 700,
  textAlign: "center",
};

export function AletaBotCetakRiwayat({
  baris,
  ringkasan,
  keterangan,
  urutan,
  namaPengadilan,
  alamatPengadilan,
  dicetakOleh,
  terpotong,
  onSelesai,
}: {
  baris: BarisCetakRiwayat[];
  ringkasan: RingkasanCetakRiwayat;
  keterangan: string[];
  urutan: string;
  namaPengadilan: string;
  alamatPengadilan?: string;
  dicetakOleh: string;
  /** Benar bila jumlah sesuai saringan melebihi baris yang dimuat. */
  terpotong: boolean;
  onSelesai: () => void;
}) {
  useEffect(() => {
    // Cetak dipanggil setelah lembarnya benar-benar tergambar. Pada putaran
    // yang sama sebagian peramban mencetak halaman kosong.
    const timer = window.setTimeout(() => {
      window.print();
      onSelesai();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [onSelesai]);

  if (typeof document === "undefined") return null;

  const sekarang = new Date();

  const isi = (
    <div id="aleta-cetak-riwayat" style={{ color: "#000", background: "#fff", fontFamily: "serif" }}>
      <style>{GAYA_CETAK}</style>

      <div style={{ textAlign: "center", borderBottom: "3px double #000", paddingBottom: 6, marginBottom: 10 }}>
        <div style={{ fontSize: "13pt", fontWeight: 700, textTransform: "uppercase" }}>{namaPengadilan}</div>
        {alamatPengadilan ? <div style={{ fontSize: "9pt" }}>{alamatPengadilan}</div> : null}
      </div>

      <h1 style={{ margin: "0 0 2px", fontSize: "14pt", textAlign: "center" }}>
        LAPORAN PENGIRIMAN PESAN WHATSAPP ALETA BOT
      </h1>
      <p style={{ margin: "0 0 8px", fontSize: "9.5pt", textAlign: "center" }}>
        Dicetak {tulisTanggalPanjang(sekarang)} pukul{" "}
        {new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" }).format(sekarang)}{" "}
        WITA
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt", marginBottom: 8, fontFamily: "sans-serif" }}>
        <tbody>
          <tr>
            <td style={{ ...sel, width: "18%", fontWeight: 700 }}>Penyaring</td>
            <td style={sel}>{keterangan.length > 0 ? keterangan.join("; ") : "Tidak ada"}</td>
            <td style={{ ...sel, width: "14%", fontWeight: 700 }}>Urutan</td>
            <td style={{ ...sel, width: "20%" }}>{urutan}</td>
          </tr>
          <tr>
            <td style={{ ...sel, fontWeight: 700 }}>Jumlah</td>
            <td style={sel} colSpan={3}>
              {ringkasan.total} pesan sesuai saringan: {ringkasan.terkirim} terkirim, {ringkasan.gagal} gagal,{" "}
              {ringkasan.simulasi} simulasi, {ringkasan.lainnya} lainnya (menunggu/dilewati/dibatalkan).
              {terpotong
                ? ` Lembar ini memuat ${baris.length} baris pertama; sisanya tersedia pada unduhan Excel.`
                : ""}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Diberi id tersendiri: lembar ini memuat tiga tabel (kepala saringan,
          daftar pesan, dan ruang tanda tangan), dan yang dihitung barisnya
          hanya yang ini. */}
      <table
        id="aleta-cetak-riwayat-daftar"
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt", fontFamily: "sans-serif" }}
      >
        <thead>
          <tr>
            {["No", "Waktu diproses", "Waktu terkirim", "Penerima", "Nomor WhatsApp", "Pegawai/Pihak", "Perkara/Jabatan", "Jenis pesan", "Status", "Keterangan"].map(
              (judul) => (
                <th key={judul} style={kepala}>
                  {judul}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {baris.length === 0 ? (
            <tr>
              <td style={{ ...sel, textAlign: "center" }} colSpan={10}>
                Tidak ada pesan pada saringan ini.
              </td>
            </tr>
          ) : null}
          {baris.map((satu, urut) => (
            <tr key={satu.id}>
              <td style={{ ...sel, textAlign: "center" }}>{urut + 1}</td>
              <td style={{ ...sel, whiteSpace: "nowrap" }}>{tulisWaktu(satu.createdAt)}</td>
              <td style={{ ...sel, whiteSpace: "nowrap" }}>{tulisWaktu(satu.sentAt)}</td>
              <td style={sel}>{satu.recipientName}</td>
              <td style={{ ...sel, whiteSpace: "nowrap" }}>{satu.recipientNumber}</td>
              <td style={{ ...sel, textAlign: "center" }}>
                {satu.penerima === "pegawai" ? "Pegawai" : satu.penerima === "pihak" ? "Pihak" : "-"}
              </td>
              <td style={sel}>{satu.caseOrPosition}</td>
              <td style={sel}>{satu.sourceFeatureLabel}</td>
              <td style={{ ...sel, textAlign: "center" }}>{satu.statusLabel}</td>
              <td style={sel}>{satu.errorMessage || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {baris.some((satu) => satu.recipientNumberMasked) ? (
        <p style={{ fontSize: "8pt", margin: "6px 0 0", fontStyle: "italic" }}>
          Nomor WhatsApp disamarkan sesuai hak akses akun yang mencetak.
        </p>
      ) : null}

      <table style={{ width: "100%", marginTop: 24, fontSize: "9.5pt", fontFamily: "serif" }}>
        <tbody>
          <tr>
            <td style={{ width: "55%" }} />
            <td style={{ textAlign: "center" }}>
              <div>Dicetak oleh,</div>
              <div style={{ height: 56 }} />
              <div style={{ fontWeight: 700, textDecoration: "underline" }}>{dicetakOleh || "(nama)"}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <p style={{ fontSize: "7.5pt", margin: "12px 0 0", color: "#333" }}>
        Laporan ini dihasilkan otomatis oleh ALETA Judicia dari catatan pengiriman WhatsApp ALETA Bot. Status
        &quot;Terkirim&quot; berarti pesan diterima layanan WhatsApp; status &quot;Simulasi&quot; berarti pesan
        disusun tanpa dikirim.
      </p>
    </div>
  );

  return createPortal(isi, document.body);
}
