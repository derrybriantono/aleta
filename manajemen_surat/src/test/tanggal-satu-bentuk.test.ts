// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PENJAGA PENYISIR: TIDAK ADA ISO TELANJANG DI LAYAR e-COURT
 * ============================================================================
 *
 * Butir 1 permintaan 25 September 2026 dikerjakan DUA KALI, dan sebab teknisnya
 * persis ketiadaan berkas ini.
 *
 * Putaran pertama mengalihkan 74 tempat ke src/lib/tanggal-indonesia.ts, dan
 * tetap meninggalkan 13 ruas mencetak ISO - termasuk kotak kuning "Ditunda
 * sampai" yang justru pengguna fotokan. Tidak ada satu pun yang berbunyi:
 *
 *   - tsc HIJAU, sebab ISO yang lolos ke layar bukan galat tipe. Ia hanya
 *     terbaca salah oleh orang.
 *   - eslint HIJAU, sebab tidak ada aturan tentang arti sebuah string.
 *   - tanggal-indonesia.test.ts HIJAU, sebab ia menguji PUSTAKANYA - dan
 *     pustakanya memang benar. Ia tidak tahu siapa yang memanggilnya.
 *
 * Akibatnya empat panel memuat DUA bentuk untuk tanggal yang SAMA. Terukur di
 * sipp_donggala: panel Mediasi membaca "Laporan mediator: 2026-09-08" tepat di
 * atas "Kesepakatan perdamaian: Sel, 08-09-2026" pada 210 baris perkara_mediasi
 * yang kedua ruasnya terisi. Itu lebih buruk daripada sebelum butir ini
 * dikerjakan: keluhan asal pengguna - dua bentuk dalam satu layar - justru
 * diperkuat.
 *
 * ============================================================================
 * APA YANG DISISIR, DAN APA YANG MEMANG BOLEH ISO
 * ============================================================================
 *
 * Yang dicari: ungkapan JSX bertuliskan `{sesuatu.tanggalXxx}` yang TIDAK
 * dibungkus salah satu pemformat. Yang DIKECUALIKAN bukan selera, tiap satunya
 * punya sebab:
 *
 *   key=                   kunci React. Ia tidak pernah terbaca orang, dan
 *                          mengubahnya menjadi bentuk berhuruf membuat dua
 *                          tanggal berbeda dapat berkunci sama.
 *   namaCadangan=          nama berkas unduhan. "bas-419-2026-10-07.pdf" terurut
 *                          benar di dalam folder; "07-10-2026" tidak.
 *   type="date"            nilai <input type="date"> WAJIB ISO menurut HTML.
 *   encodeURIComponent(    ruas kueri URL yang dibaca peladen.
 *   Date.parse / .slice(   perhitungan, bukan tampilan.
 *   === !== localeCompare  perbandingan dan pengurutan.
 *   ruas berakhiran Teks   teks BEBAS hasil kerukan e-Court, bukan ISO.
 *                          Memaksanya lewat pemformat justru MENGOSONGKANNYA.
 *
 * ============================================================================
 * BATASNYA DISEBUTKAN, SUPAYA TIDAK DIPERCAYA LEBIH DARIPADA KEMAMPUANNYA
 * ============================================================================
 *
 * Penyisir ini membaca SATU BARIS pada satu waktu, jadi ungkapan JSX yang
 * memanjang beberapa baris tidak terjangkau. Itu cukup: ISO telanjang selalu
 * lahir sebagai `{x.tanggalY || "—"}` satu baris, sementara yang berbilang baris
 * justru yang sudah dibungkus pemformat. Yang tidak terjangkau karena itu bukan
 * bentuk kegagalan yang pernah terjadi - tetapi ia disebut di sini supaya
 * pembaca berikutnya tidak menyangka penjaga ini lebih kuat daripada adanya.
 *
 * Penyisirnya DIUJI ATAS BARIS YANG SENGAJA SALAH di bawah. Penjaga yang tidak
 * pernah dapat menangkap apa pun akan selalu hijau, dan hijau semacam itu lebih
 * berbahaya daripada tidak ada penjaga sama sekali.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");

/** Keenam layar e-Court yang butir 1 mengalihkan ke satu bentuk tanggal. */
const LAYAR = [
  "aleta-ecourt-sidang.tsx",
  "aleta-ecourt-status-perkara.tsx",
  "aleta-ecourt-mediasi.tsx",
  "aleta-ecourt-sk-majelis.tsx",
  "aleta-ecourt-cetak-jadwal.tsx",
  "bentuk-sajian.tsx",
];

/** Pemformat yang sah - satu di antaranya cukup membuat ungkapan itu benar. */
const PEMFORMAT = [
  "tanggalHariPendek(",
  "tanggalHariPanjang(",
  "tanggalPanjangDenganHari(",
  "tanggalPanjang(",
  "tanggalRingkas(",
  "tanggalDMY(",
  "namaHari",
  // Cap waktu SUNGGUHAN (terakhir dibaca, diberitahukan pada) memang berjam,
  // dan itu bukan pekerjaan tanggal-indonesia.ts.
  "formatDateTime(",
  "formatDate(",
  "toLocaleString(",
  "toLocaleDateString(",
];

/** Penanda yang membuat satu ungkapan dikecualikan - sebabnya di kepala berkas. */
const DIKECUALIKAN = [
  "encodeURIComponent(",
  "Date.parse",
  ".slice(",
  "localeCompare",
  "===",
  "!==",
  ">=",
  "<=",
];

/**
 * Atribut yang isinya TETAP dibaca orang, jadi pengecualian atribut tidak
 * berlaku padanya.
 *
 * Nilai atribut pada umumnya bukan tulisan - key, value, namaCadangan,
 * className tidak pernah terbaca siapa pun - tetapi kedua ini justru terbaca,
 * dan pembaca layar MEMBACAKANNYA.
 */
const ATRIBUT_TERBACA = ["title=", "aria-label=", "aria-description="];

/**
 * Menyisir satu isi berkas, memulangkan pelanggaran sebagai teks yang dapat
 * dibaca manusia: "baris 2765: {baris.tanggalPenetapan || "—"}".
 */
function sisirIso(isi: string): string[] {
  const pelanggaran: string[] = [];
  const baris = isi.split("\n");

  baris.forEach((teks, i) => {
    // Baris yang seluruhnya komentar dilewati - kepala berkas ini sendiri
    // memuat contoh ISO di dalam penjelasannya.
    const dipangkas = teks.trim();
    if (dipangkas.startsWith("//") || dipangkas.startsWith("*") || dipangkas.startsWith("/*")) {
      return;
    }

    // Tiap ungkapan JSX dinilai SENDIRI-SENDIRI. Itu yang membuat baris
    // bercampur tetap tertangkap: satu ruas dibungkus, satu ruas tidak.
    for (const cocok of teks.matchAll(/\{[^{}]*\}/g)) {
      const satu = cocok[0];
      const mulai = cocok.index ?? 0;
      if (!/\.(tanggal|tgl)[A-Za-z0-9]*/.test(satu)) continue;

      // Ruas berakhiran Teks adalah teks bebas hasil kerukan, bukan ISO.
      if (/\.(tanggal|tgl)[A-Za-z0-9]*Teks\b/.test(satu)) continue;

      // Bukan tanggalnya yang dipakai, melainkan sesuatu PADA tanggalnya -
      // mis. {antrian.tanggal.length} adalah banyaknya tanggal, bukan tanggal.
      if (/\.(tanggal|tgl)[A-Za-z0-9]*\./.test(satu)) continue;

      // Sisipan template literal: `${x.tanggal} ${x.jam}` dipakai sebagai kunci
      // urut, kunci peta, atau nama berkas unduhan - tidak pernah digambar
      // sebagai tulisan. Yang menandainya adalah tanda dolar TEPAT SEBELUM
      // kurung kurawalnya; kurawal itu sendiri tidak memuatnya.
      if (mulai > 0 && teks[mulai - 1] === "$") continue;
      if (satu.includes("`")) continue;

      if (PEMFORMAT.some((p) => satu.includes(p))) continue;
      if (DIKECUALIKAN.some((p) => satu.includes(p))) continue;

      // Nilai ATRIBUT - tepat sesudah tanda sama dengan. key, value,
      // namaCadangan, className: tidak satu pun terbaca orang. Kecuali title
      // dan aria-label, yang justru dibacakan pembaca layar.
      const sebelum = teks.slice(0, mulai);
      const atribut = /([A-Za-z-]+)=$/.exec(sebelum);
      if (atribut && !ATRIBUT_TERBACA.includes(`${atribut[1]}=`)) continue;

      // Tanggalnya diserahkan ke fungsi LAIN, dan yang digambar hasil fungsi
      // itu - mis. {sidangKeHari(baris.tanggal)} menggambar nomor sidang.
      // BINTIK BUTA YANG DISENGAJA: {String(x.tanggal)} juga lolos di sini.
      // Belum pernah terjadi, dan menutupnya menuntut penguraian JSX sungguhan.
      if (/[A-Za-z_$][\w$]*\([^)]*\.(tanggal|tgl)/.test(satu)) continue;

      pelanggaran.push(`baris ${i + 1}: ${dipangkas.slice(0, 110)}`);
    }
  });

  return pelanggaran;
}

describe("penyisir ISO - ujilah penjaganya sendiri lebih dahulu", () => {
  it("menangkap ruas tanggal yang tidak dibungkus", () => {
    const salah = `
      <dd className="inline">{baris.tanggalPenetapan || "—"}</dd>
      <span>Daftar {item.tanggalDaftar}</span>
    `;
    const hasil = sisirIso(salah);
    expect(hasil).toHaveLength(2);
    expect(hasil[0]).toContain("tanggalPenetapan");
    expect(hasil[1]).toContain("tanggalDaftar");
  });

  it("melewatkan yang sudah dibungkus pemformat", () => {
    const benar = `
      <dd>{tanggalHariPendek(baris.tanggalPenetapan, baris.tanggalPenetapan || "—")}</dd>
      <dd>{tanggalHariPanjang(status.putusanLengkap.tanggalPutusan, "—")}</dd>
      <dd>{tanggalDMY(lingkup.dari, lingkup.dari)}</dd>
    `;
    expect(sisirIso(benar)).toEqual([]);
  });

  it("melewatkan pengecualian yang memang wajib ISO", () => {
    const sah = `
      <li key={\`\${x.tanggal}-\${urutan}\`}>
      namaCadangan={\`bas-\${nomorPerkara}-\${sidang.tanggalSidang}.pdf\`}
      <input type="date" value={saringan.tanggalMulai} />
      <dd>{status.putusanEcourt.ecourt.tanggalPutusanTeks}</dd>
      {Date.parse(\`\${t.tanggal}T00:00:00Z\`)}
      {a.tanggalSidang === b.tanggalSidang ? 0 : 1}
    `;
    expect(sisirIso(sah)).toEqual([]);
  });

  it("menangkap baris bercampur - satu ruas dibungkus, satu ruas tidak", () => {
    // Inilah bentuk yang paling menipu, dan yang benar-benar terjadi: pada satu
    // kalimat, "dimohon 2024-12-11, untuk sidang Kam, 19-12-2024".
    const campur = `
      dimohon {x.tanggalPermohonan || "—"}, untuk sidang {tanggalHariPendek(x.tanggalSidang, "—")}
    `;
    const hasil = sisirIso(campur);
    expect(hasil).toHaveLength(1);
    expect(hasil[0]).toContain("tanggalPermohonan");
  });
});

describe("butir 1 - tidak ada ISO telanjang di keenam layar e-Court", () => {
  for (const nama of LAYAR) {
    it(nama, () => {
      const pelanggaran = sisirIso(baca(`manajemen_surat/src/components/portal/${nama}`));
      expect(
        pelanggaran,
        `${nama} masih mencetak ISO pada ${pelanggaran.length} tempat:\n${pelanggaran.join("\n")}`
      ).toEqual([]);
    });
  }
});

describe("butir 1 - kotak Ditunda sampai, tempat yang pengguna tunjukkan", () => {
  const SIDANG = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");

  it("tanggal tundaan dibungkus beserta nama harinya", () => {
    // Hidup pada 8.477 baris - terukur:
    //   SELECT COUNT(*) FROM perkara_jadwal_sidang a WHERE a.ditunda='Y'
    //     AND EXISTS (sidang berikutnya) = 8477
    // Dan dari kedelapan ribu itu tidak satu pun jatuh pada akhir pekan, jadi
    // nama hari adalah satu-satunya tanda yang menampakkan salah ketik sebelum
    // hari H.
    expect(SIDANG).toContain("tanggalHariPendek(\n                                      baris.tanggalSidangBerikut,");
    expect(SIDANG).not.toContain("sampai {baris.tanggalSidangBerikut}");
  });

  it("tidak dibiarkan terpotong ke baris sendiri", () => {
    // "Kam, 17-09-2026" 15 aksara melawan "2026-09-17" 10 aksara, di dalam
    // kotak kuning yang sempit. Tanpa whitespace-nowrap nama harinya pindah
    // baris dan justru lebih sulit dibaca daripada ISO yang diganti.
    //
    // Sejak 28 Sep 2026 yang nowrap hanya TANGGALNYA, bukan "sampai
    // <tanggal>" seluruhnya: potongan nowrap selebar 175 px itu menentukan
    // lebar minimum kolom Perkara dan mendorong tabel melewati kartunya.
    // Janji di atas tetap: nama hari dan tanggalnya tidak pernah terpisah.
    const i = SIDANG.indexOf("sampai{\" \"}");
    expect(i, "kalimat tundaan tidak ditemukan").toBeGreaterThan(-1);
    const sesudah = SIDANG.slice(i, SIDANG.indexOf("tanggalHariPendek(", i));
    expect(sesudah).toContain('<span className="whitespace-nowrap">');
  });
});
