"use strict";

/**
 * ============================================================================
 * HURUF ALASAN PERCERAIAN (isian huruf alasan) - PASTI ATAU USULAN (G1, 30 Okt 2026)
 * ============================================================================
 *
 * Gelombang 1 "cegah salah": huruf alasan yang terbaca PASTI dari keterangan kedua saksi dan posita langsung terisi
 * (alur isi SIPP -> ABT otomatis hakim/panitera); yang MUNGKIN tetap usulan (Tab), yang tak terbaca tetap kosong.
 * Isian yang sudah diisi/diketik manusia tidak pernah ditimpa (dijaga pemanggil di panel).
 *
 * Bahan: hasil deteksi alasan (deteksiAlasanService.deteksiPerkara -> huruf[]: { huruf, usul, kesesuaian.status,
 * didalilkan }), usulan lama pisah dari keterangan saksi (nilai + pembanding hitungan), dan posita.
 *
 * ATURAN "PASTI" - SATU-SATUNYA bentuk yang terukur cukup tepat (lihat ukuran di bawah):
 *   huruf F SAJA, yaitu
 *     - mesin hanya mengusulkan F;
 *     - perselisihan terus-menerus diterangkan KEDUA saksi (kesesuaian "sama") dan didalilkan posita;
 *     - tidak ada ciri huruf lain sama sekali (A, C, D, E, G, H) - pada saksi mana pun maupun posita;
 *     - tidak ada tanda pisah 24 bulan atau lebih (huruf B): ucapan saksi, hitungan dari "pisah sejak", lama pisah
 *       menurut posita, dan "pisah sejak" menurut posita sampai tanggal acuan, semuanya di bawah 24 bulan atau tidak ada.
 *   Huruf lain dan gabungan apa pun TIDAK PERNAH pasti: majelis PA Donggala memilih secara berbeda-beda untuk bahan
 *   yang sama (mis. usulan "BF": hakim memilih B 46, BF 33, F 30 dari 110), jadi huruf itu keputusan hakim.
 *
 * UKURAN (data 28 Okt, aps_badilag_2810 + sipp_2810, perkara cerai 2025-2026 yang SUDAH putus dan berisi huruf alasan
 * sah, n = 384; alat D:/aleta-dev/kerja/g1-huruf/ukur-huruf.js + analisa.py):
 *   usulan mesin apa adanya sama persis dengan pilihan hakim 161/372 (43%);
 *   usulan "F" (tanpa saringan) 94/103 (91%);
 *   aturan PASTI di atas 52/53 (98%; 2025: 20/20, 2026: 32/33). Satu-satunya beda: 627/Pdt.G/2026 hakim memilih EF tanpa
 *   ciri E di saksi maupun posita. Golongan lain: usulan 319 (34% sama persis), kosong 12.
 *   Perkara cerai BERJALAN dengan huruf alasan kosong (87): pasti 2, usulan 83 (40 dari saksi, 43 posita saja), kosong 2.
 * Huruf D tetap diusulkan (keputusan pengguna 10 Okt) - hanya tidak pernah pasti.
 */

/** Ambang lama pisah huruf B (PP 9/1975 Pasal 19 huruf b: dua tahun berturut-turut). */
const BULAN_HURUF_B = 24;

/** Hasil ukur aturan pasti (lihat kepala berkas). Diperbarui bila aturannya diukur ulang. */
const PASTI_TERUKUR = Object.freeze({ cocok: 52, dari: 53, data: "28 Okt 2026, perkara cerai putus 2025-2026 (2025: 20/20, 2026: 32/33)" });

const teks = (v) => (v === null || v === undefined ? "" : String(v));

function layananUsulan() {
  return require("./abtUsulanService");
}

/** Bulan dari teks lama ("1 tahun 4 bulan"); null bila tidak terbaca. */
function bulanDari(nilai) {
  const t = teks(nilai).trim();
  if (!t) return null;
  try {
    const n = layananUsulan().totalBulan(t);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Lama pisah terpanjang yang terbaca dari semua sumber (bulan), beserta asalnya. null = tidak ada yang terbaca.
 *   lama9944     usulan lama pisah dari keterangan saksi: { nilai, pembanding: { totalBulan } }
 *   pisah0246    usulan pisah rumah sejak (bulan/tahun) dari keterangan saksi
 *   butirPosita  posita yang sudah dipecah (butirKeterangan)
 *   tanggalAcuan tanggal sidang/putusan (YYYY-MM-DD) untuk menghitung "pisah sejak" posita
 */
function lamaPisahTerpanjang({ lama9944, pisah0246, butirPosita, tanggalAcuan }) {
  const calon = [];
  const sejak = (nilai, asal) => {
    try {
      const k = nilai && tanggalAcuan ? layananUsulan().lamaSejakAcuan(teks(nilai).replace(/^(awal|akhir|pertengahan) bulan /, "bulan "), tanggalAcuan) : null;
      if (k && Number.isFinite(k.totalBulan)) calon.push({ bulan: k.totalBulan, asal });
    } catch {
      /* tidak terbaca */
    }
  };
  sejak(pisah0246 && pisah0246.nilai, "pisah rumah sejak (keterangan saksi)");
  const u = lama9944 || {};
  const ucap = bulanDari(u.nilai);
  if (ucap !== null) calon.push({ bulan: ucap, asal: "keterangan saksi" });
  const hit = u.pembanding && Number(u.pembanding.totalBulan);
  if (Number.isFinite(hit) && hit > 0) calon.push({ bulan: hit, asal: "hitungan dari pisah rumah" });
  const butir = Array.isArray(butirPosita) ? butirPosita : [];
  if (butir.length) {
    const U = layananUsulan();
    try {
      const lp = U.lamaPisahPosita(butir);
      const b = lp && lp.nilai ? bulanDari(lp.nilai) : null;
      if (b !== null) calon.push({ bulan: b, asal: "lama pisah menurut posita" });
    } catch {
      /* posita tak terbaca bagian ini */
    }
    try {
      const ps = U.pisahSejakPosita(butir);
      sejak(ps && ps.nilai, "pisah sejak menurut posita");
    } catch {
      /* posita tak terbaca bagian ini */
    }
  }
  if (!calon.length) return null;
  return calon.reduce((a, b) => (b.bulan > a.bulan ? b : a));
}

/**
 * Golongan huruf alasan untuk satu perkara.
 *   deteksi      deteksiAlasanService.deteksiPerkara(...).huruf
 *   lama9944     usulan 9944 dari keterangan saksi (boleh kosong)
 *   pisah0246    usulan 0246 dari keterangan saksi (boleh kosong)
 *   butirPosita  posita terpecah (boleh kosong)
 *   tanggalAcuan YYYY-MM-DD (boleh kosong)
 * -> { huruf: "F"|"BF"|...|"", golongan: "pasti"|"usulan"|"", sebab, lamaPisah: {bulan, asal}|null }
 */
function golonganHurufAlasan({ deteksi, lama9944, pisah0246, butirPosita, tanggalAcuan } = {}) {
  const daftar = Array.isArray(deteksi) ? deteksi : [];
  const usul = daftar.filter((h) => h && h.usul).map((h) => teks(h.huruf)).filter((h) => /^[A-H]$/.test(h));
  const huruf = [...new Set(usul)].sort().join("");
  const lamaPisah = lamaPisahTerpanjang({ lama9944, pisah0246, butirPosita, tanggalAcuan });
  if (!huruf) return { huruf: "", golongan: "", sebab: "tidak ada huruf yang terbaca dari keterangan saksi dan posita", lamaPisah };
  const usulan = (sebab) => ({ huruf, golongan: "usulan", sebab, lamaPisah });
  if (huruf !== "F") return usulan("selain huruf F saja, huruf alasan adalah pilihan majelis");
  const f = daftar.find((h) => h && h.huruf === "F");
  const st = f && f.kesesuaian ? teks(f.kesesuaian.status) : "";
  if (st !== "sama") return usulan("perselisihan belum diterangkan kedua saksi");
  if (f.didalilkan !== true) return usulan("perselisihan tidak terbaca di posita");
  const ciriLain = daftar.filter((h) => h && h.huruf !== "F" && h.huruf !== "B" && ((h.kesesuaian && teks(h.kesesuaian.status) && teks(h.kesesuaian.status) !== "tidak ada") || h.didalilkan === true));
  if (ciriLain.length) return usulan(`ada ciri huruf ${ciriLain.map((h) => h.huruf).join(", ")}`);
  const b = daftar.find((h) => h && h.huruf === "B");
  if (b && ((b.kesesuaian && teks(b.kesesuaian.status) && teks(b.kesesuaian.status) !== "tidak ada") || b.didalilkan === true)) return usulan("ada ciri meninggalkan/pisah rumah yang dapat menjadi huruf B");
  if (lamaPisah && lamaPisah.bulan >= BULAN_HURUF_B) return usulan(`pisah ${lamaPisah.bulan} bulan (${lamaPisah.asal}) - dapat menjadi huruf B`);
  return { huruf: "F", golongan: "pasti", sebab: "perselisihan terus-menerus diterangkan kedua saksi dan didalilkan posita, tanpa ciri huruf lain", lamaPisah };
}

module.exports = { golonganHurufAlasan, lamaPisahTerpanjang, BULAN_HURUF_B, PASTI_TERUKUR };
