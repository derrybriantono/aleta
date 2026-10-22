// @vitest-environment node
/**
 * W49 22 Okt 2026 - keterangan saksi SUSUNAN (Susun saksi / tanya jawab Blangko Derry) mengikuti POSITA.
 *
 * Jawaban "apa penyebab perselisihan" pada modus "sama dengan gugatan" disusun dari ciri lama saja, sehingga
 * sebab yang didalilkan posita di luar ciri lama (kurang perhatian, marah bila dinasihati, tidak taat, ...)
 * tidak diterangkan saksi - dan "nafkah batin" terbaca "melalaikan kewajiban nafkah lahir".
 *
 * Templat = abt_tanyajawab_template "A1" server (baca saja 22 Okt 2026); posita dipetik dari SIPP, nama dan
 * tempat diganti. Ukur atas 1.367 posita cerai 2025-2026 (templat A1): sebab posita yang diterangkan saksi
 * 2.923/3.835 -> 3.583/3.835; perkara yang seluruh sebabnya diterangkan 717 -> 1.072; tidak satu pun jawaban
 * yang memuat sebab lebih sedikit dari sebelumnya.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type Apa = any;
const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const U: Apa = muat(path.join(AKAR, "aleta_bot/services/abtUsulanService.js"));

const A1 = (law: string, pel: string) => [
  { no: "6", tanya: `Kenapa ${law} mengajukan cerai terhadap ${pel}?`, jawab: `${law} mengajukan cerai terhadap ${pel} karena sudah tidak rukun dalam rumah tangganya;` },
  { no: "8", tanya: `Apa yang biasa menjadi penyebab perselisihan dan pertengkaran antara ${law} dan ${pel}?`, jawab: `Yang biasa menjadi penyebab perselisihan dan pertengkaran antara ${law} dan ${pel} adalah karena ........;` },
  { no: "11", tanya: `Apakah ${law} dan ${pel} masih tinggal satu rumah sampai saat ini?`, jawab: `${law} dan ${pel} sudah pisah tempat tinggal sejak ....., kira-kira sampai sekarang sudah sekitar ........ tahun;` },
];
const susun = (posita: string, ct = false, opsi: Apa = {}) => {
  const law = ct ? "Pemohon" : "Penggugat";
  const pel = ct ? "Termohon" : "Tergugat";
  return U.susunKeteranganSaksiSdg({
    templat: A1(law, pel),
    posita,
    pelaku: pel,
    lawan: law,
    nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
    kodeKumpulan: "A1",
    jenisPerkara: ct ? "346" : "347",
    alur: "15",
    modus: { saksi1: { modus: "sama" }, saksi2: { modus: "sama" } },
    ...opsi,
  });
};
const penyebab = (h: Apa) => String(h.saksi1.find((b: Apa) => b.no === "8").jawab);

describe("keterangan saksi susunan memuat sebab yang didalilkan posita", () => {
  it("87/Pdt.G/2026 (disamarkan): kurang perhatian + nafkah batin - bukan 'melalaikan kewajiban nafkah lahir'", () => {
    const h = susun(
      "Bahwa sejak awal tahun 2020 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran yang disebabkan karena Tergugat kurang memberikan perhatian kepada Penggugat hingga kurangnya memberikan nafkah batin;\nBahwa sejak Juni 2025 Penggugat dan Tergugat telah pisah tempat tinggal;"
    );
    expect(penyebab(h)).toMatch(/Tergugat kurang memberikan perhatian/);
    expect(penyebab(h)).not.toMatch(/nafkah lahir/);
  });

  it("ciri lama DAN sebab baru: keduanya diterangkan, disambung 'selain itu'", () => {
    const h = susun(
      "Bahwa sejak 2022 sering terjadi perselisihan dan pertengkaran yang disebabkan karena Tergugat tidak memberikan nafkah yang cukup kepada Penggugat dan Tergugat marah setiap kali diingatkan oleh Penggugat;"
    );
    const j = penyebab(h);
    expect(j).toMatch(/nafkah/);
    expect(j).toMatch(/selain itu Tergugat marah setiap kali dinasihati atau diingatkan oleh Penggugat/);
  });

  it("cerai talak: sebab Termohon dari posita (tidak taat, tidak mendengar nasihat) beserta menikah lagi", () => {
    const h = susun(
      "Bahwa sejak 2024 sering terjadi pertengkaran yang disebabkan karena Termohon telah menikah lagi dengan laki-laki lain, Termohon tidak taat dan tidak patuh kepada Pemohon dan Termohon sering tidak mendengarkan nasehat Pemohon;",
      true
    );
    const j = penyebab(h);
    expect(j).toMatch(/Termohon (?:telah|sudah) menikah lagi/);
    expect(j).toMatch(/tidak taat kepada Pemohon/);
    expect(j).toMatch(/tidak mau mendengarkan nasihat Pemohon/);
  });

  it("tanpa ciri lama, klausa sebab posita yang rinci tetap dipakai apa adanya (tidak menyempit)", () => {
    const h = susun(
      "Bahwa sejak 2016 sering terjadi pertengkaran yang disebabkan karena Termohon tidak pernah pamit keluar rumah, pelit dengan keluarga Pemohon, serta jarang mengunjungi orang tua Pemohon;",
      true
    );
    expect(penyebab(h)).toMatch(/pelit dengan keluarga Pemohon/);
  });

  it("alasan yang DIPILIH petugas tidak ditambah sebab dari posita", () => {
    const h = susun("Bahwa disebabkan karena Tergugat tidak memberikan nafkah dan Tergugat marah setiap kali diingatkan oleh Penggugat;", false, {
      alasan: ["tidak memberi nafkah"],
    });
    expect(penyebab(h)).not.toMatch(/marah setiap kali/);
  });

  it("tidak ada kata nama aplikasi di jawaban mana pun", () => {
    const h = susun("Bahwa disebabkan karena Tergugat marah setiap kali diingatkan oleh Penggugat dan Tergugat sering berjudi;");
    for (const s of h.saksi) for (const b of s.jawaban) expect(b.jawab).not.toMatch(/aleta/i);
  });
});
