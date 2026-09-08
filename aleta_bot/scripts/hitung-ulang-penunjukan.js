"use strict";

/**
 * ============================================================================
 * HITUNG ULANG RIWAYAT - EMPAT UNSUR YANG BERGANTUNG PADA PENETAPAN PERTAMA
 * ============================================================================
 *
 * Aturan penilaian SK Dirjen Badilag 048/2024 diperbaiki: yang dinilai
 * PENETAPAN PERTAMA, bukan penetapan kembali. Perbaikan aturan selalu menuntut
 * satu pertanyaan lanjutan - APA YANG BERUBAH PADA ANGKA LAMA?
 *
 * ============================================================================
 * EMPAT UNSUR, BUKAN DUA - SEBAB PMH ADALAH ACUAN
 * ============================================================================
 *
 * Mula-mula yang diperbaiki hanya penunjukan panitera pengganti (I.4) dan juru
 * sita (I.6). PMH sengaja dikecualikan, dengan alasan ia menetapkan satu
 * MAJELIS - bukan satu orang - sehingga tanggal tiap anggotanya belum tentu
 * sama dengan tanggal majelisnya.
 *
 * Alasan itu tidak bertahan menghadapi datanya. Dari 9.834 perkara, TIDAK SATU
 * PUN penetapan pertamanya lebih baru daripada yang tersimpan: MIN memang
 * hanya dapat memundurkan tanggal, tidak pernah memajukannya. Yang benar-benar
 * terjadi adalah mutasi hakim yang menetapkan kembali seluruh majelis
 * sekaligus, lalu menimpa tanggal di perkara_penetapan - 996 perkara.
 *
 * Dan akibatnya berantai. PMH adalah ACUAN bagi penunjukan PP, juru sita, dan
 * PHS. Satu tanggal PMH yang keliru mundur menjatuhkan EMPAT unsur sekaligus:
 * penetapan majelisnya bernilai nol, sedangkan tiga lainnya - yang sungguh
 * dikerjakan pada hari pendaftaran - tampak dikerjakan sebelum acuannya.
 *
 * Karena itu yang dihitung ulang di sini keempatnya.
 *
 * ============================================================================
 * TIDAK ADA NILAI TERSIMPAN YANG PERLU DIPERBAIKI
 * ============================================================================
 *
 * Diperiksa pada basis data bot di server: tabel aleta_bot_nilai_riwayat -
 * satu-satunya tempat nilai periode disimpan - BELUM ADA. Ia dibuat sesaat
 * sebelum penulisan pertama, dan penulisan itu belum pernah terjadi sebab
 * simpanNilai() belum dipanggil dari mana pun kecuali skrip ujinya. Seluruh
 * nilai yang tampil di layar dihitung saat layar dibuka.
 *
 * Akibatnya menyenangkan: tidak ada baris lama yang menyimpan angka keliru,
 * dan begitu perbaikan ini terpasang, SELURUH riwayat langsung memakai aturan
 * yang benar. Tidak ada migrasi yang perlu ditulis.
 *
 * Yang tetap perlu diketahui adalah SEBERAPA BESAR pergeserannya - berapa
 * perkara yang nilainya berubah, dan ke arah mana. Itulah yang dihitung di
 * sini, atas seluruh perkara yang ada, bukan atas contoh.
 *
 * ============================================================================
 * CARA PAKAI
 * ============================================================================
 *
 * Tanggalnya diambil lebih dahulu dari SIPP (baca saja, tanpa menulis apa pun)
 * menjadi TSV berkolom sepuluh:
 *
 *   perkara_id  tahun  pendaftaran
 *   pmh_tersimpan  pmh_pertama
 *   ppp_tersimpan  ppp_pertama
 *   pjs_tersimpan  pjs_pertama
 *   phs
 *
 *   SELECT p.perkara_id, YEAR(p.tanggal_pendaftaran), DATE(p.tanggal_pendaftaran),
 *          DATE(pen.penetapan_majelis_hakim),        DATE(h.pertama),
 *          DATE(pen.penetapan_panitera_pengganti),   DATE(a.pertama),
 *          DATE(pen.penetapan_jurusita),             DATE(b.pertama),
 *          DATE(pen.penetapan_hari_sidang)
 *     FROM perkara p
 *     JOIN perkara_penetapan pen ON pen.perkara_id = p.perkara_id
 *     LEFT JOIN (SELECT perkara_id, MIN(tanggal_penetapan) AS pertama
 *                  FROM perkara_hakim_pn WHERE tanggal_penetapan IS NOT NULL
 *                 GROUP BY perkara_id) h ON h.perkara_id = p.perkara_id
 *     LEFT JOIN (SELECT perkara_id, MIN(tanggal_penetapan) AS pertama
 *                  FROM perkara_panitera_pn WHERE tanggal_penetapan IS NOT NULL
 *                 GROUP BY perkara_id) a ON a.perkara_id = p.perkara_id
 *     LEFT JOIN (SELECT perkara_id, MIN(tanggal_penetapan) AS pertama
 *                  FROM perkara_jurusita WHERE tanggal_penetapan IS NOT NULL
 *                 GROUP BY perkara_id) b ON b.perkara_id = p.perkara_id
 *
 * lalu:
 *
 *   node aleta_bot/scripts/hitung-ulang-penunjukan.js <berkas.tsv>
 *
 * Skrip ini TIDAK menyentuh basis data mana pun. Ia hanya membaca berkas dan
 * memanggil mesin nilai yang sama dengan yang dipakai layar.
 */

const fs = require("fs");
const path = require("path");

const penilaian = require("../services/penilaianSippService");

const UNSUR = [
  { kunci: "penetapanMajelis", nama: "Penetapan majelis hakim (I.2)" },
  { kunci: "penunjukanPp", nama: "Penunjukan panitera pengganti (I.4)" },
  { kunci: "penunjukanJurusita", nama: "Penunjukan juru sita (I.6)" },
  { kunci: "penetapanHariSidang", nama: "Penetapan hari sidang pertama (I.8)" },
];

/** Satu butir hasil penilaian, dicari menurut kuncinya. */
function butir(fakta, kunci) {
  const hasil = penilaian.poinPerkara(fakta);
  const ketemu = hasil.rinci.find((x) => x.kunci === kunci);
  if (!ketemu) throw new Error(`unsur ${kunci} tidak ada pada mesin nilai`);
  return ketemu;
}

/**
 * Keadaan satu unsur diringkas menjadi satu kata, sebab yang dibandingkan
 * bukan hanya angkanya. "tidak dinilai" bukan nilai nol, dan menyamakan
 * keduanya akan menyembunyikan justru perubahan yang paling penting.
 */
function keadaan(b) {
  if (!b.terbaca) return "tidak-dinilai";
  return `poin-${b.poin}`;
}

function bacaTsv(berkas) {
  const isi = fs.readFileSync(berkas, "utf8");
  const baris = [];
  for (const t of isi.split(/\r?\n/)) {
    if (!t.trim()) continue;
    const k = t.split("\t");
    if (k.length < 10) continue;
    baris.push({
      perkaraId: k[0],
      tahun: Number(k[1]) || 0,
      daftar: k[2] || null,
      pmhTersimpan: k[3] || null,
      pmhPertama: k[4] || "",
      pppTersimpan: k[5] || null,
      pppPertama: k[6] || "",
      pjsTersimpan: k[7] || null,
      pjsPertama: k[8] || "",
      phs: k[9] || null,
    });
  }
  return baris;
}

function jalankan(berkas) {
  const baris = bacaTsv(berkas);
  if (!baris.length) {
    console.error(`Tidak ada baris terbaca dari ${berkas}`);
    process.exit(2);
  }

  const ringkas = {};
  for (const u of UNSUR) {
    ringkas[u.kunci] = {
      seluruh: 0,
      nilaiBerubah: 0,
      naik: 0,
      turun: 0,
      jadiTidakDinilai: 0,
      jadiDinilai: 0,
      poinLama: 0,
      poinBaru: 0,
      perTahun: new Map(),
      contoh: [],
    };
  }
  let tanggalPmhBerubah = 0;

  for (const b of baris) {
    // Tanggal lama: apa adanya dari perkara_penetapan - yang tertimpa oleh
    // penetapan kembali. Tanggal baru: penetapan pertama, dan hanya bila
    // terbaca, persis seperti sippTahapanService memperlakukannya.
    const lama = {
      tanggalDaftar: b.daftar,
      tanggalPmh: b.pmhTersimpan,
      tanggalPpp: b.pppTersimpan,
      tanggalPjs: b.pjsTersimpan,
      tanggalPhs: b.phs,
    };
    const baru = {
      tanggalDaftar: b.daftar,
      tanggalPmh: b.pmhPertama || b.pmhTersimpan,
      tanggalPpp: b.pppPertama || b.pppTersimpan,
      tanggalPjs: b.pjsPertama || b.pjsTersimpan,
      tanggalPhs: b.phs,
    };
    if (String(lama.tanggalPmh || "") !== String(baru.tanggalPmh || "")) tanggalPmhBerubah += 1;

    for (const u of UNSUR) {
      const r = ringkas[u.kunci];
      r.seluruh += 1;

      const bLama = butir(lama, u.kunci);
      const bBaru = butir(baru, u.kunci);
      r.poinLama += Number(bLama.poin) || 0;
      r.poinBaru += Number(bBaru.poin) || 0;

      const kLama = keadaan(bLama);
      const kBaru = keadaan(bBaru);
      if (kLama === kBaru) continue;

      r.nilaiBerubah += 1;
      if (!bBaru.terbaca) r.jadiTidakDinilai += 1;
      else if (!bLama.terbaca) r.jadiDinilai += 1;
      else if (bBaru.poin > bLama.poin) r.naik += 1;
      else if (bBaru.poin < bLama.poin) r.turun += 1;

      const tahun = b.tahun || 0;
      r.perTahun.set(tahun, (r.perTahun.get(tahun) || 0) + 1);

      if (r.contoh.length < 4) {
        r.contoh.push(`perkara ${b.perkaraId} - ${kLama} -> ${kBaru} (PMH ${b.pmhTersimpan || "-"} -> ${baru.tanggalPmh || "-"})`);
      }
    }
  }

  console.log("=".repeat(78));
  console.log("HITUNG ULANG RIWAYAT - PENETAPAN PERTAMA, BUKAN PENETAPAN KEMBALI");
  console.log(`Sumber   : ${path.basename(berkas)} - ${baris.length} perkara`);
  console.log(`Tanggal PMH yang berubah: ${tanggalPmhBerubah} perkara`);
  console.log("Tersimpan: tidak ada. aleta_bot_nilai_riwayat belum pernah dibuat,");
  console.log("           jadi tidak ada baris lama yang perlu ditimpa.");
  console.log("=".repeat(78));

  let totalLama = 0;
  let totalBaru = 0;

  for (const u of UNSUR) {
    const r = ringkas[u.kunci];
    const selisihPoin = r.poinBaru - r.poinLama;
    totalLama += r.poinLama;
    totalBaru += r.poinBaru;
    console.log("");
    console.log(u.nama);
    console.log("-".repeat(78));
    console.log(`  keadaan nilainya berubah ${r.nilaiBerubah}`);
    console.log(`    naik                   ${r.naik}`);
    console.log(`    turun                  ${r.turun}`);
    console.log(`    jadi tidak dinilai     ${r.jadiTidakDinilai}   (urutan terbalik - tidak mungkin menurut hukum acara)`);
    console.log(`    tadinya tidak dinilai  ${r.jadiDinilai}   (urutannya pulih, kini dapat dinilai)`);
    console.log(`  jumlah poin  ${r.poinLama} -> ${r.poinBaru}  (${selisihPoin >= 0 ? "+" : ""}${selisihPoin})`);

    const tahun = [...r.perTahun.entries()].sort((a, b) => a[0] - b[0]);
    if (tahun.length) {
      console.log(`  menurut tahun pendaftaran: ${tahun.map(([t, n]) => `${t || "?"}:${n}`).join("  ")}`);
    }
    for (const c of r.contoh) console.log(`  contoh: ${c}`);
  }

  console.log("");
  console.log("-".repeat(78));
  console.log(`JUMLAH POIN EMPAT UNSUR  ${totalLama} -> ${totalBaru}  (${totalBaru - totalLama >= 0 ? "+" : ""}${totalBaru - totalLama})`);
  console.log("");
}

const berkas = process.argv[2];
if (!berkas) {
  console.error("Pakai: node aleta_bot/scripts/hitung-ulang-penunjukan.js <berkas.tsv>");
  process.exit(2);
}
jalankan(path.resolve(berkas));
