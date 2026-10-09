"use strict";

/**
 * ============================================================================
 * KEMAJUAN TARIKAN e-COURT YANG NYATA (butir 8, 1.189.x)
 * ============================================================================
 *
 * "Tarik dari e-Court" dulu hanya berkata "Memeriksa e-Court..." selama 1-3
 * menit. Sekarang jembatan (tools/ecourt-bridge/run.js) MELAPORKAN tahap yang
 * sungguh dikerjakannya lewat satu baris keluaran bertanda:
 *
 *   @@ALETA-KEMAJUAN {"tahap":"unduh","i":2,"n":5,"judul":"Jawaban"}
 *
 * Penjadwal meneruskan tiap baris ke ecourtVerifikasiHarianService, yang
 * menyimpannya di tarikan (statusTarikan) - layar menanyakan status itu dan
 * menggambar bar + nama tahap. Persennya DIHITUNG dari tahap + i/n yang
 * dilaporkan, bukan waktu yang berlalu: bar yang tidak bergerak berarti
 * jembatan memang belum maju.
 *
 * Murni (tanpa I/O), dipakai bersama oleh run.js dan layanan.
 */

const PENANDA = "@@ALETA-KEMAJUAN ";

/**
 * Tahap berurutan. `dari`..`sampai` = rentang persen tahap itu; tahap ber-i/n
 * maju di dalam rentangnya menurut i/n.
 */
const TAHAP = {
  mulai: { label: "Memeriksa jadwal SIPP", dari: 1, sampai: 3 },
  "buka-peramban": { label: "Membuka peramban e-Court", dari: 4, sampai: 7 },
  "masuk-sesi": { label: "Masuk sesi e-Court", dari: 8, sampai: 12 },
  "cari-perkara": { label: "Mencari perkara di daftar e-Court", dari: 13, sampai: 40 },
  "buka-perkara": { label: "Membuka halaman perkara", dari: 41, sampai: 45 },
  "daftar-dokumen": { label: "Membaca daftar dokumen", dari: 46, sampai: 50 },
  unduh: { label: "Mengunduh berkas", dari: 50, sampai: 90 },
  simpan: { label: "Menyimpan ke arsip ALETA", dari: 91, sampai: 97 },
  selesai: { label: "Selesai", dari: 100, sampai: 100 },
};

const URUTAN = Object.keys(TAHAP);

function angka(x) {
  const n = Number(x);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** Baris yang dicetak run.js. */
function barisKemajuan(tahap, rinci = {}) {
  const isi = { tahap: String(tahap || "") };
  if (rinci && typeof rinci === "object") {
    if (rinci.i !== undefined) isi.i = angka(rinci.i);
    if (rinci.n !== undefined) isi.n = angka(rinci.n);
    if (rinci.judul) isi.judul = String(rinci.judul).slice(0, 120);
    if (rinci.nomor) isi.nomor = String(rinci.nomor).slice(0, 60);
  }
  return `${PENANDA}${JSON.stringify(isi)}`;
}

/** Satu baris keluaran -> laporan, atau null bila bukan baris kemajuan. */
function bacaBaris(teks) {
  const s = String(teks || "");
  const awal = s.indexOf(PENANDA);
  if (awal < 0) return null;
  try {
    const isi = JSON.parse(s.slice(awal + PENANDA.length).trim());
    if (!isi || typeof isi !== "object" || !TAHAP[isi.tahap]) return null;
    return isi;
  } catch {
    return null;
  }
}

/**
 * Laporan -> { tahap, label, persen, i, n, judul, teks }. persen 0..100,
 * bulat. Untuk tahap ber-i/n: i = butir yang SEDANG dikerjakan (1..n), jadi
 * persennya (i-1)/n di dalam rentang - "berkas 1/4" belum berarti seperempat
 * selesai.
 */
function hitungKemajuan(laporan) {
  const l = laporan && typeof laporan === "object" ? laporan : {};
  const t = TAHAP[l.tahap] || TAHAP.mulai;
  const tahap = TAHAP[l.tahap] ? l.tahap : "mulai";
  const i = angka(l.i);
  const n = angka(l.n);
  let persen = t.dari;
  if (n > 0 && i > 0) {
    const bagian = Math.min(1, Math.max(0, (i - 1) / n));
    persen = t.dari + (t.sampai - t.dari) * bagian;
  }
  persen = Math.max(0, Math.min(100, Math.round(persen)));
  let teks = t.label;
  if (tahap === "unduh" && n > 0) teks = `Mengunduh berkas ${Math.min(i, n)}/${n}`;
  else if (tahap === "daftar-dokumen") teks = `Membaca daftar dokumen (${n} dokumen)`;
  else if (tahap === "cari-perkara" && n > 0) teks = `Mencari perkara di daftar e-Court (${Math.min(i, n)}/${n})`;
  return {
    tahap,
    label: t.label,
    persen,
    i: i || 0,
    n: n || 0,
    judul: l.judul ? String(l.judul) : "",
    teks,
  };
}

/**
 * Kemajuan baru tidak pernah MUNDUR dari yang lama dalam satu tarikan
 * (mis. dua kategori sapuan - satu yang kosong dilaporkan lebih belakang).
 */
function majukan(lama, laporan) {
  const baru = hitungKemajuan(laporan);
  if (lama && Number(lama.persen) > baru.persen && URUTAN.indexOf(lama.tahap) >= URUTAN.indexOf(baru.tahap)) {
    return { ...baru, persen: Number(lama.persen) };
  }
  return baru;
}

/**
 * Pemilah keluaran proses anak: potongan stdout tidak selalu sebaris (dan
 * satu baris kemajuan dapat terbelah dua potongan). Mengembalikan fungsi
 * (potongan) yang memanggil padaLaporan untuk tiap baris kemajuan utuh.
 */
function pemilahBaris(padaLaporan) {
  let sisa = "";
  return (potongan) => {
    const baris = (sisa + String(potongan || "")).split(/\r?\n/);
    sisa = baris.pop() || "";
    if (sisa.length > 4000) sisa = "";
    for (const b of baris) {
      const laporan = bacaBaris(b);
      if (!laporan) continue;
      try {
        padaLaporan(laporan);
      } catch {
        // Pelapor yang rusak tidak boleh menghentikan penarikan.
      }
    }
  };
}

module.exports = { PENANDA, TAHAP, URUTAN, barisKemajuan, bacaBaris, hitungKemajuan, majukan, pemilahBaris };
