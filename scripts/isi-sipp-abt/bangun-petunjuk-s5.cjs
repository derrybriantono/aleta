// Membangun manajemen_surat/src/app/api/aleta-ecourt/blangko-derry/petunjuk-s5.ts dari METADATA bot
// (aleta_bot/services/isiOtomatisS5/metadata.js). Portal dan bot dipasang terpisah, jadi datanya disalin; uji
// isi-otomatis-s5-20okt.test.ts menjaga keduanya sama.   node scripts/isi-sipp-abt/bangun-petunjuk-s5.cjs
const fs = require("fs");
const path = require("path");

const akar = path.resolve(__dirname, "..", "..");
const { METADATA } = require(path.join(akar, "aleta_bot", "services", "isiOtomatisS5", "metadata.js"));
const tujuan = path.join(akar, "manajemen_surat", "src", "app", "api", "aleta-ecourt", "blangko-derry", "petunjuk-s5.ts");

const baris = Object.keys(METADATA)
  .sort()
  .map((kode) => {
    const m = METADATA[kode];
    const isi = m.manual ? `manual: true, alasan: ${JSON.stringify(m.alasan)}` : `opsional: true, labelPengguna: ${JSON.stringify(m.labelPengguna)}`;
    return `  "${kode}": { ${isi} },`;
  });

const teks = `/**
 * Petunjuk isian jenis S5 (dispensasi kawin, perwalian, asal usul anak, wali adhal, penetapan ahli waris) - SALINAN dari
 * aleta_bot/services/isiOtomatisS5/metadata.js (dibangun scripts/isi-sipp-abt/bangun-petunjuk-s5.cjs; uji isi-otomatis-s5-20okt
 * menjaga keduanya sama).
 *
 *   manual    isian yang tidak mungkin otomatis: tampil "diisi manual" dengan alasan di ikon keterangan
 *   opsional  isian tambahan (bila ada) dengan labelPengguna
 *
 * Hanya MENAMBAH keterangan pada isian yang ada; tidak mengubah isian, urutan, atau hitungan "perlu diisi".
 */

export type PetunjukIsian = { manual?: true; alasan?: string; opsional?: true; labelPengguna?: string };

export const PETUNJUK_ISIAN_S5: Readonly<Record<string, PetunjukIsian>> = {
${baris.join("\n")}
};

type IsianBerKode = { kode: string };

/**
 * Menempelkan petunjuk ke isian susunan blangko: manual + alasanManual, opsional + labelPengguna. Nilai yang sudah ada pada
 * isian (mis. dari pekerjaan lain) tidak ditimpa.
 */
export function terapkanPetunjukS5(susunan: { isian: IsianBerKode[] }): void {
  for (const b of susunan.isian as Array<IsianBerKode & Record<string, unknown>>) {
    const p = PETUNJUK_ISIAN_S5[b.kode];
    if (!p) continue;
    if (p.manual && b.manual === undefined) {
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
