"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Lembar cetak jadwal sidang.
 *
 * ============================================================================
 * DICETAK DARI HALAMAN YANG SAMA, TANPA MEMBUKA TAB BARU
 * ============================================================================
 *
 * Membuka halaman cetak tersendiri berarti memuat ulang seluruh data yang sudah
 * ada di layar, dan menambah satu rute yang harus dijaga kewenangannya sendiri.
 * Lembar ini disusun dari data yang SUDAH dimuat, lalu ditempel ke body lewat
 * portal supaya berada di luar tata letak portal.
 *
 * ============================================================================
 * ATURAN CETAK MEMBUNYIKAN SISANYA, BUKAN SEBALIKNYA
 * ============================================================================
 *
 * Saat mencetak, seluruh anak langsung body disembunyikan kecuali lembar ini.
 * Menyembunyikan satu per satu bagian aplikasi akan gagal begitu ada bagian
 * baru ditambahkan - dan yang tercetak menjadi sidebar dan tombol.
 */

type BarisCetak = {
  sidangId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  jamSidang: string;
  tanggalSidang: string;
  agenda: string;
  ruangan: string;
  ditunda: boolean;
  majelisKode: string;
  majelisNama: string;
  paniteraNama: string;
  jurusitaNama: string;
  pihak: { penggugat: string[]; tergugat: string[] };
  // --- keterangan keadaan ---
  perkaraId?: string | number;
  alasanDitunda?: string;
  tanggalSidangBerikut?: string;
  adaBas?: boolean;
  urutanSidang?: number;
  panggilan?: {
    belumDipanggil: number;
    retur: number;
    wajibDipanggil: number[];
  };
  putusanEcourt?: { perluTindakan: boolean; sebutan: string } | null;
};

const GAYA_CETAK = `
@media print {
  body > *:not(#aleta-cetak-jadwal) { display: none !important; }
  #aleta-cetak-jadwal { display: block !important; }
  @page { size: A4 landscape; margin: 12mm; }
}
#aleta-cetak-jadwal { display: none; }
`;

export function AletaEcourtCetakJadwal({
  sidang,
  antrian = {},
  catatanSaringan = "",
  dari,
  sampai,
  namaPengadilan,
  onSelesai,
}: {
  sidang: BarisCetak[];
  antrian?: Record<string, { nomor: number | null }>;
  catatanSaringan?: string;
  dari: string;
  sampai: string;
  namaPengadilan: string;
  onSelesai: () => void;
}) {
  useEffect(() => {
    // Cetak dipanggil setelah lembarnya benar-benar tergambar. Memanggilnya
    // pada putaran yang sama menghasilkan halaman kosong pada sebagian
    // peramban - isinya belum sempat masuk ke pohon tampilan.
    const timer = window.setTimeout(() => {
      window.print();
      onSelesai();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [onSelesai]);

  if (typeof document === "undefined") return null;

  const isi = (
    <div id="aleta-cetak-jadwal" style={{ color: "#000", background: "#fff" }}>
      <style>{GAYA_CETAK}</style>

      <div style={{ fontFamily: "serif", padding: "0 0 10px" }}>
        <h1 style={{ margin: 0, fontSize: "16pt", textAlign: "center" }}>JADWAL SIDANG</h1>
        <h2 style={{ margin: "2px 0 0", fontSize: "13pt", textAlign: "center", fontWeight: 600 }}>
          {namaPengadilan}
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: "10pt", textAlign: "center" }}>
          {dari === sampai ? tanggalPanjang(dari) : `${tanggalPanjang(dari)} s.d. ${tanggalPanjang(sampai)}`}
          {" · "}
          {sidang.length} perkara
        </p>

        {/* Lembar yang dicetak dari hasil yang SEDANG DISARING harus
            mengatakannya. Tanpa kalimat ini, daftar berisi tiga perkara
            dibaca orang berikutnya sebagai seluruh sidang hari itu. */}
        {catatanSaringan ? (
          <p style={{ margin: "3px 0 0", fontSize: "9pt", textAlign: "center", fontStyle: "italic" }}>
            {catatanSaringan}
          </p>
        ) : null}

        {/* Ringkasan keadaan - yang menuntut tindakan disebut lebih dulu.
            Lembar ini kerap dibaca sambil berjalan; angka di kepala
            menghemat menyisir sepuluh halaman untuk tahu ada berapa
            relaas yang retur. */}
        {ringkasKeadaan(sidang) ? (
          <p style={{ margin: "4px 0 0", fontSize: "9pt", textAlign: "center" }}>
            {ringkasKeadaan(sidang)}
          </p>
        ) : null}
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "8.5pt",
          fontFamily: "sans-serif",
        }}
      >
        <thead>
          <tr>
            {[
              "No",
              "Antrian / Jam",
              "Nomor Perkara",
              "Jenis Perkara",
              "Para Pihak",
              "Majelis",
              "Panitera Sidang",
              "Jurusita",
              "Agenda",
              "Ruang",
              "Keterangan",
            ].map(
              (judul) => (
                <th
                  key={judul}
                  style={{
                    border: "1px solid #000",
                    padding: "4px 5px",
                    background: "#e8e8e8",
                    textAlign: "left",
                    fontWeight: 700,
                  }}
                >
                  {judul}
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody>
          {sidang.map((baris, urutan) => (
            <tr key={`${baris.nomorPerkara}|${baris.sidangId}`}>
              <td style={sel({ textAlign: "right" })}>{urutan + 1}</td>
              <td style={sel({ whiteSpace: "nowrap" })}>
                {/* Nomor antrian di atas jamnya, sama seperti di layar -
                    itulah yang disebut petugas saat memanggil. */}
                {antrian[String(baris.perkaraId)]?.nomor ? (
                  <div style={{ fontWeight: 700 }}>{antrian[String(baris.perkaraId)]?.nomor}</div>
                ) : null}
                <div>{baris.jamSidang || "—"}</div>
              </td>
              <td style={sel({ fontWeight: 600, whiteSpace: "nowrap" })}>
                {baris.nomorPerkara}
                {baris.ditunda ? <div style={{ fontWeight: 400 }}>(ditunda)</div> : null}
              </td>
              <td style={sel()}>{baris.jenisPerkara || "—"}</td>

              {/* Para pihak: penggugat/pemohon lebih dulu, lalu lawannya -
                  urutan yang sama dengan pembacaan di ruang sidang. */}
              <td style={sel()}>
                {baris.pihak.penggugat.length > 0 ? (
                  <div>{baris.pihak.penggugat.join("; ")}</div>
                ) : null}
                {baris.pihak.tergugat.length > 0 ? (
                  <div style={{ marginTop: 2 }}>
                    <span style={{ fontStyle: "italic" }}>lawan</span> {baris.pihak.tergugat.join("; ")}
                  </div>
                ) : null}
                {baris.pihak.penggugat.length === 0 && baris.pihak.tergugat.length === 0 ? "—" : null}
              </td>

              <td style={sel()}>
                <div style={{ fontFamily: "monospace" }}>{baris.majelisKode || "—"}</div>
                {baris.majelisNama ? (
                  <div style={{ fontSize: "7.5pt" }}>{baris.majelisNama}</div>
                ) : null}
              </td>
              <td style={sel()}>{baris.paniteraNama || "—"}</td>
              <td style={sel()}>{baris.jurusitaNama || "—"}</td>
              <td style={sel()}>{baris.agenda || "—"}</td>
              <td style={sel()}>{baris.ruangan || "—"}</td>

              {/* Keterangan: apa yang harus dikerjakan orang terhadap
                  perkara ini. Diurut menurut kegentingannya - relaas yang
                  retur lebih dulu daripada catatan bahwa BAS belum ada. */}
              <td style={sel({ fontSize: "8pt" })}>
                {daftarKeterangan(baris).length === 0
                  ? "—"
                  : daftarKeterangan(baris).map((teks, i) => (
                      <div key={i} style={{ marginTop: i === 0 ? 0 : 2 }}>
                        {teks}
                      </div>
                    ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: "10px", fontSize: "8pt", fontFamily: "sans-serif" }}>
        Dicetak dari ALETA pada {new Date().toLocaleString("id-ID")}. Sumber data: SIPP.
      </p>
    </div>
  );

  return createPortal(isi, document.body);
}

/**
 * Keterangan satu perkara, diurut menurut kegentingannya.
 *
 * Yang menuntut tindakan juru sita lebih dulu (retur, belum dipanggil),
 * lalu keadaan sidangnya, lalu catatan administrasi. Lembar ini dipakai
 * sambil berjalan - urutan yang salah berarti yang penting terbaca
 * terakhir.
 */
function daftarKeterangan(baris: BarisCetak) {
  const keterangan: string[] = [];
  const panggilan = baris.panggilan;

  if (panggilan && panggilan.retur > 0) {
    keterangan.push(`RETUR${panggilan.retur > 1 ? ` ${panggilan.retur}` : ""} - panggilan harus diulang`);
  }
  if (panggilan && panggilan.belumDipanggil > 0) {
    keterangan.push(`Belum dipanggil (${panggilan.belumDipanggil} pihak)`);
  }
  if (panggilan && panggilan.wajibDipanggil.length === 0) {
    keterangan.push("Tidak perlu dipanggil");
  }

  if (baris.ditunda) {
    // Ditunda sampai kapan dan karena apa - keduanya sudah terbaca dari
    // SIPP. Sebelumnya lembar ini hanya bertulis "(ditunda)", dan yang
    // ditanya orang berikutnya selalu dua hal itu.
    const sampaiKapan = baris.tanggalSidangBerikut
      ? ` s.d. ${tanggalPanjang(baris.tanggalSidangBerikut)}`
      : "";
    const sebab = baris.alasanDitunda ? ` (${baris.alasanDitunda})` : "";
    keterangan.push(`Ditunda${sampaiKapan}${sebab}`);
  }

  if (baris.putusanEcourt && baris.putusanEcourt.perluTindakan) {
    keterangan.push(`Putusan e-Court: ${baris.putusanEcourt.sebutan || "belum beres"}`);
  }
  if (baris.adaBas === false) keterangan.push("Belum ada BAS");
  if (baris.urutanSidang === 1) keterangan.push("Sidang pertama");

  return keterangan;
}

/** Sebaris ringkasan keadaan untuk kepala lembar. */
function ringkasKeadaan(sidang: BarisCetak[]) {
  let retur = 0;
  let belumDipanggil = 0;
  let ditunda = 0;
  let belumBas = 0;

  for (const baris of sidang) {
    if (baris.panggilan && baris.panggilan.retur > 0) retur += 1;
    if (baris.panggilan && baris.panggilan.belumDipanggil > 0) belumDipanggil += 1;
    if (baris.ditunda) ditunda += 1;
    if (baris.adaBas === false) belumBas += 1;
  }

  const bagian: string[] = [];
  if (retur > 0) bagian.push(`${retur} retur`);
  if (belumDipanggil > 0) bagian.push(`${belumDipanggil} belum dipanggil`);
  if (ditunda > 0) bagian.push(`${ditunda} ditunda`);
  if (belumBas > 0) bagian.push(`${belumBas} belum ada BAS`);
  return bagian.join(" · ");
}

function sel(tambahan: React.CSSProperties = {}): React.CSSProperties {
  return {
    border: "1px solid #000",
    padding: "4px 5px",
    verticalAlign: "top",
    ...tambahan,
  };
}

const NAMA_BULAN_PANJANG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function tanggalPanjang(tanggalIso: string) {
  const [tahun, bulan, hari] = String(tanggalIso || "").split("-").map((x) => Number(x));
  if (!tahun || !bulan || !hari) return tanggalIso;
  return `${hari} ${NAMA_BULAN_PANJANG[bulan - 1]} ${tahun}`;
}
