// Membangun manajemen_surat/src/app/api/aleta-ecourt/blangko-derry/petunjuk-s6.ts dari tabel MANUAL bot
// (aleta_bot/services/isiOtomatisJenisS6.js). Portal dan bot dipasang terpisah, jadi datanya disalin; uji
// isi-otomatis-s6-20okt.test.ts menjaga keduanya sama.   node scripts/isi-sipp-abt/bangun-petunjuk-s6.cjs
const fs = require("fs");
const path = require("path");

const akar = path.resolve(__dirname, "..", "..");
const { MANUAL } = require(path.join(akar, "aleta_bot", "services", "isiOtomatisJenisS6.js"));
const tujuan = path.join(akar, "manajemen_surat", "src", "app", "api", "aleta-ecourt", "blangko-derry", "petunjuk-s6.ts");

/** Entri statis portal: tanpa yang bacaan utamanya berkas e-Court (itu hanya cadangan dinamis di usulan bot). */
const kode = Object.keys(MANUAL)
  .filter((k) => !MANUAL[k].ecourt)
  .sort();
const baris = kode.map((k) => {
  const m = MANUAL[k];
  const bagian = [`manual: true`, `alasan: ${JSON.stringify(m.alasan)}`];
  if (m.opsional) bagian.push(`opsional: true`, `labelPengguna: ${JSON.stringify(m.labelPengguna || m.alasan)}`);
  return `  "${k}": { ${bagian.join(", ")} },`;
});

const teks = `/**
 * Petunjuk isian jenis S6 (harta bersama, kewarisan, wasiat, hibah, wakaf, izin poligami, pembatalan/pencegahan perkawinan,
 * hak asuh/nafkah anak, Lain-Lain, ekonomi syariah) - SALINAN dari tabel MANUAL di
 * aleta_bot/services/isiOtomatisJenisS6.js (dibangun scripts/isi-sipp-abt/bangun-petunjuk-s6.cjs; uji isi-otomatis-s6-20okt
 * menjaga keduanya sama).
 *
 *   manual    isian yang tidak mungkin otomatis: tampil "diisi manual" dengan alasan di ikon keterangan
 *   opsional  isian yang boleh dikosongkan, dengan labelPengguna (kolom CORET, isian bawaan ABT, petunjuk majelis)
 *
 * Pengisi otomatis tetap menang bila menemukan nilai. Hanya MENAMBAH keterangan pada isian yang ada; tidak mengubah isian,
 * urutan, atau hitungan "perlu diisi".
 */

export type PetunjukIsianS6 = { manual: true; alasan: string; opsional?: true; labelPengguna?: string };

export const PETUNJUK_ISIAN_S6: Readonly<Record<string, PetunjukIsianS6>> = {
${baris.join("\n")}
};

type IsianBerKode = { kode: string };

/**
 * Menempelkan petunjuk ke isian susunan blangko: manual + alasanManual, opsional + labelPengguna. Nilai yang sudah ada pada
 * isian (mis. dari pekerjaan lain) tidak ditimpa.
 */
export function terapkanPetunjukS6(susunan: { isian: IsianBerKode[] }): void {
  for (const b of susunan.isian as Array<IsianBerKode & Record<string, unknown>>) {
    const p = PETUNJUK_ISIAN_S6[b.kode];
    if (!p) continue;
    if (b.manual === undefined) {
      b.manual = true;
      if (!b.alasanManual) b.alasanManual = p.alasan;
    }
    if (p.opsional && b.opsional === undefined) {
      b.opsional = true;
      if (!b.labelPengguna) b.labelPengguna = p.labelPengguna;
    }
  }
}
`;
fs.writeFileSync(tujuan, teks, "utf8");
console.log(`ditulis ${tujuan} (${baris.length} petunjuk)`);
