// @vitest-environment node
/**
 * 31 OKT 2026 - SISA 79: rincian alasan 5227 dari posita SIPP vs 5227 yang DIKETIK petugas (aps_badilag_2810, 344 perkara).
 * 79 kunci isian yang dulu tidak tertangkap digolongkan satu per satu (D:/aleta-dev/kerja/deteksi-sisa79/golongan.js):
 *   a 34 tidak tertulis di posita (dari saksi/BAS) | b 30 bunyi ada, pola/mesin belum mengenali -> 26 kini tertangkap |
 *   c 8 beda kerincian/sinonim | d 2 isian tidak sesuai posita | e 5 kunci jawaban berupa TUDUHAN / pihak terbalik.
 * Ukur (kunci jawaban tetap = mesin lama atas isian): tertangkap persis 697 -> 718 dari 776; "setara" 709 -> 729.
 * Atas 4.049 posita: 83 salah tangkap lama "Tergugat berselingkuh" dari kalimat TUDUHAN ("Tergugat menuduh Penggugat
 * selingkuh") hilang. Kasus di bawah = kalimat posita nyata (nomor perkara di judul).
 */
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type Butir = { sebab: string[]; bunyi: { nilai: string }[] };
type Pihak = { pelaku: string; lawan: string };
const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(process.cwd(), "../aleta_bot");
const mesin = require_(path.join(AKAR, "services/deteksi/alasanRincian.js")) as {
  deteksiRincian: (o: { gugatan: string[]; saksi?: unknown[]; saksiTidakDibaca?: boolean; jawab?: unknown[]; pihak?: Pihak }) => { butir: Butir[] };
};
const kamus = require_(path.join(AKAR, "services/kamusDeteksi.js")) as { lupakan: () => void };
const CG: Pihak = { pelaku: "Tergugat", lawan: "Penggugat" };
const CT: Pihak = { pelaku: "Termohon", lawan: "Pemohon" };
const rinci = (pihak: Pihak, ...g: string[]) => mesin.deteksiRincian({ gugatan: g, saksi: [], saksiTidakDibaca: true, jawab: [], pihak });
const kunci = (r: { butir: Butir[] }) => new Set(r.butir.flatMap((b) => b.sebab));
const bunyi = (r: { butir: Butir[] }, k: string) => r.butir.find((b) => b.sebab.includes(k))?.bunyi[0]?.nilai ?? "";
afterEach(() => kamus.lupakan());

describe("mesin: akibat konkret tidak hilang karena sebab tersambung ke 'pertengkaran'", () => {
  it("519/Pdt.G/2025: '... pertengkaran yang disebabkan karena Tergugat tidak memberikan nafkah hingga ... dibantu oleh orangtua Penggugat'", () => {
    const r = rinci(CG, "sejak bulan Januari 2024 sering terjadi perselisihan dan pertengkaran yang disebabkan karena Tergugat tidak memberikan nafkah hingga untuk memenuhi kebutuhan rumah tangga dibantu oleh orangtua Penggugat");
    expect(kunci(r).has("kebutuhan-dibantu")).toBe(true);
    expect(bunyi(r, "nafkah")).toMatch(/^Tergugat tidak memberikan nafkah kepada Penggugat sehingga .*dibantu oleh orangtua Penggugat$/);
  });
  it("602/Pdt.G/2025: '... nafkah DAN UNTUK MEMENUHI kebutuhan sehari-hari dibantu dari orangtua Penggugat'", () => {
    const r = rinci(CG, "c. Tergugat kurang dalam memberikan nafkah dan untuk memenuhi kebutuhan sehari-hari dibantu dari orangtua Penggugat");
    expect(bunyi(r, "nafkah")).toBe("Tergugat kurang memberikan nafkah kepada Penggugat sehingga untuk memenuhi kebutuhan sehari-hari dibantu dari orangtua Penggugat");
  });
  it("pisah rumah TIDAK menggantikan sambungan ke pertengkaran (bunyi lama tetap)", () => {
    const r = rinci(CG, "sering terjadi pertengkaran karena Tergugat sering berjudi, sehingga saat ini Penggugat dan Tergugat telah pisah rumah");
    expect(kunci(r).has("pisah-rumah")).toBe(false);
    expect(kunci(r).has("judi")).toBe(true);
  });
});

describe("subjek: keterangan orang dalam kurung tidak menghalangi", () => {
  it("425/Pdt.G/2025: 'Orang Tua Tergugat (ibu mertua Penggugat) selalu ikut campur'", () => {
    expect(bunyi(rinci(CG, "Orang Tua Tergugat (ibu mertua Penggugat) selalu ikut campur dalam urusan rumah tangga Penggugat dan Tergugat"), "campur-keluarga")).toMatch(/Tergugat/);
  });
  it("angka dalam kurung tetap pemisah: 403/Pdt.G/2025 '6 (enam) tahun dan Tergugat tidak memberikan nafkah'", () => {
    expect(kunci(rinci(CG, "Tergugat dan Penggugat telah pisah tempat tinggal lebih dari 6 (enam) tahun dan Tergugat tidak memberikan nafkah kepada Penggugat.")).has("nafkah")).toBe(true);
  });
});

describe("tuduhan bukan perbuatan (salah tangkap lama 83 posita)", () => {
  it("'Tergugat menuduh Penggugat selingkuh' / 'mencurigai Pemohon memiliki wanita idaman lain' bukan selingkuh", () => {
    for (const k of ["Tergugat sering menuduh Penggugat selingkuh dengan laki-laki lain", "Tergugat memiliki kecemburuan yang berlebihan hingga menuduh Penggugat memiliki lelaki idaman lain"]) {
      const r = rinci(CG, k);
      expect(kunci(r).has("selingkuh")).toBe(false);
    }
    expect(kunci(rinci(CT, "Termohon sering mencurigai Pemohon memiliki wanita idaman lain")).has("selingkuh")).toBe(false);
    expect(kunci(rinci(CG, "Tergugat memiliki kecemburuan yang berlebihan hingga menuduh Penggugat memiliki lelaki idaman lain")).has("cemburu")).toBe(true);
  });
  it("perbuatan sungguhan tetap: 450/Pdt.G/2025 'Termohon diketahui memiliki lelaki idaman lain'", () => {
    expect(bunyi(rinci(CT, "pada awal tahun 2017 Termohon diketahui memiliki lelaki idaman lain"), "selingkuh")).toMatch(/^Termohon /);
  });
});

describe("bunyi posita yang dulu tidak dikenali", () => {
  const ada = (pihak: Pihak, k: string, kalimat: string) => expect(kunci(rinci(pihak, kalimat)).has(k)).toBe(true);
  it("salah ketik: higga/dibetu/temparamen/temprametal/Kerasan/menhancurkan/memliki/menghaburkan/mementingankan", () => {
    ada(CG, "kebutuhan-dibantu", "Tergugat kurang dalam memberikan nafkah, higga untuk memenuhi kebutuhan sehari-hari dibantu penghasilan penggugat");
    ada(CG, "kebutuhan-dibantu", "Tergugat malas dalam bekerja dan kurang dalam memberikan nafkah hingga untuk memenuhi kebutuhan sehari-hari dibetu oleh orangtua Penggugat");
    ada(CG, "temperamental", "b. Tergugat memiliki sifat temparamen hingga ketika sedang marah Tergugat sering menghancurkan perabotan rumah tangga");
    ada(CG, "temperamental", "b. Tergugat memiliki sifat temprametal hingga melakukan kekerasan kepada penggugat");
    ada(CG, "kdrt-fisik", "jika dalam pengaruh obat-obat terlarang Tergugat melakukan Kerasan kepada Penggugat");
    ada(CG, "merusak-barang", "Tergugat sering menhancurkan barang rumah tangga dan mengancam ingin memukul Penggugat");
    ada(CG, "tanpa-kerja", "c. Saat berumah tangga Tergugat tidak memliki pekerjaan sehingga tidak memberikan nafkah kepada Penggugat");
    ada(CG, "boros", "b. Tergugat sering menghaburkan uang untuk bermain Judi Online");
    ada(CG, "orang-tua-utama", "c. Dalam hal keuangan Tergugat lebih mementingankan Keluarga Tergugat ketimbang Penggugat");
  });
  it("ungkapan: larut malam, hanya marah, lawan jenis, pernikahan siri, pelit, rasa hormat, sikap kasar", () => {
    ada(CG, "keluar-malam", "Tergugat sering keluar larut malam dengan alasan berkumpul dengan teman Tergugat");
    ada(CG, "keluar-malam", "a. Tergugat sering keluar rumah tanpa sepengetahuan Penggugat dan pulang hingga larut malam");
    ada(CG, "temperamental", "a. Tergugat kurang dalam memberikan nafkah apabila Penggugat menasehati Tergugat hanya marah kepada Penggugat");
    ada(CG, "selingkuh", "a. Tergugat sering bertemu dangan lawan jenis tanpa sepengetahuan Penggugat");
    ada(CG, "menikah-lagi", "c. Tergugat memilki wanita idaman lain dan telah melakukan pernikahan siri dengan wanita lain");
    ada(CG, "menikah-lagi", "Tergugat diketahui telah menikah dengan wanita tersebut bahkan telah memiliki anak");
    ada(CG, "nafkah", "a. Tergugat pelit kepada Penggugat dalam memberikan nafkah untuk kebutuhan sehari-hari");
    ada(CG, "merendahkan", "Tergugat tidak memiliki rasa hormat kepada orangtua Penggugat");
    ada(CG, "kasar-sikap", "b. Tergugat memiliki sikap temperamental dan kasar kepada Penggugat");
  });
  it("pernikahan siri para pihak SENDIRI bukan menikah lagi", () => {
    expect(kunci(rinci(CG, "antara Penggugat dan Tergugat telah melangsungkan pernikahan siri/tidak tercatat pada awal tahun 2018")).has("menikah-lagi")).toBe(false);
  });
});

/**
 * 31 Okt (arahan pengguna, MENGUBAH keputusan 27 Okt): alasan yang diterangkan KEDUA saksi tetapi tidak di posita ikut
 * DIUSULKAN (ragu, tidak mengisi sendiri), bertanda asal; satu saksi = catatan; saksi menyangkal posita = catatan temuan.
 * Ukur 344 perkara (posita + tanya-jawab saksi ABT): persis 718 -> 736 dari 776, setara 729 -> 746; usulan dari saksi 58
 * (18 sama dengan isian petugas, 40 di luar isian).
 */
describe("posita + keterangan saksi", () => {
  type B = { sebab: string[]; asal: string; asalLabel: string; yakin: string; lencana: string; bunyi: { nilai: string }[] };
  const m = mesin as unknown as {
    deteksiRincian: (o: Record<string, unknown>) => { butir: B[]; diLuarGugatan: { kunci: string }[]; bertentangan: { kunci: string }[] };
    pilihanBunyi: (r: unknown) => { nilai: string }[];
  };
  const saksi = (a: string[], b: string[]) => [{ no: 1, butir: a }, { no: 2, butir: b }];
  const jalan = (gugatan: string[], s: { no: number; butir: string[] }[], pihak = CG) => m.deteksiRincian({ gugatan, saksi: s, jawab: [], pihak });

  it("(b) kedua saksi menerangkan pemukulan yang tidak di posita -> diusulkan, asal saksi, ragu, satu rangkaian", () => {
    const r = jalan(["Tergugat sering mabuk-mabukan"], saksi(["Yang menjadi penyebab pertengkaran karena Tergugat sering mabuk dan memukul Penggugat"], ["Penyebabnya karena Tergugat pernah memukul Penggugat sampai berdarah"]));
    const s = r.butir.find((b) => b.asal === "saksi")!;
    expect(s.sebab).toEqual(["kdrt-fisik"]);
    expect(s.yakin).toBe("ragu");
    expect(s.asalLabel).toBe("dari keterangan kedua saksi");
    expect(r.butir.find((b) => b.asal === "posita")!.asalLabel).toBe("dari posita");
    expect(m.pilihanBunyi(r)[0].nilai).toBe("Tergugat sering mabuk-mabukan dan Tergugat melakukan kekerasan fisik terhadap Penggugat");
  });
  it("(c) satu saksi saja -> catatan, tidak diusulkan", () => {
    const r = jalan(["Tergugat sering mabuk-mabukan"], saksi(["Penyebabnya karena Tergugat sering memukul Penggugat"], ["Penyebabnya karena Tergugat sering mabuk"]));
    expect(r.butir.some((b) => b.asal === "saksi")).toBe(false);
    expect(r.diLuarGugatan.map((x) => x.kunci)).toContain("kdrt-fisik");
  });
  it("setara dengan alasan posita tidak didobel; pihak yang mengajukan tidak dijadikan pelaku", () => {
    const r = jalan(["Tergugat sering berkata kasar kepada Penggugat"], saksi(["Penyebabnya karena Tergugat bersikap kasar kepada Penggugat"], ["Penyebabnya karena Tergugat berlaku kasar kepada Penggugat"]));
    expect(r.butir.some((b) => b.asal === "saksi")).toBe(false);
    const t = jalan(["Tergugat sering mabuk-mabukan"], saksi(["Penyebabnya karena Penggugat berselingkuh dengan laki-laki lain"], ["Penyebabnya karena Penggugat selingkuh"]));
    expect(t.butir.some((b) => b.asal === "saksi")).toBe(false);
  });
  it("bukan keterangan penyebab ('Tergugat sudah tidak pernah memberikan nafkah' selama pisah) -> tidak diusulkan", () => {
    const r = jalan(["Tergugat sering mabuk-mabukan"], saksi(["Tergugat sudah tidak pernah memberikan nafkah kepada Penggugat"], ["Selama pisah Tergugat tidak pernah memberikan nafkah kepada Penggugat"]));
    expect(r.butir.some((b) => b.asal === "saksi")).toBe(false);
  });
  it("(d) saksi menyangkal dalil posita -> catatan temuan, bukan usulan", () => {
    const r = jalan(["Tergugat sering memukul Penggugat"], saksi(["Tergugat tidak pernah memukul Penggugat"], ["Saya tidak tahu"]));
    expect(r.bertentangan.map((x) => x.kunci)).toEqual(["kdrt-fisik"]);
    expect(r.butir.every((b) => b.asal === "posita")).toBe(true);
  });
  it("huruf alasan: diterangkan kedua saksi tetapi tidak didalilkan -> diusulkan bertanda dariSaksi", () => {
    const da = require_(path.join(AKAR, "services/deteksiAlasanService.js")) as {
      sebabDariButir: (b: string[]) => unknown[];
      usulHuruf: (o: Record<string, unknown>) => { huruf: string; usul: boolean; dariSaksi?: boolean }[];
    };
    const s1 = da.sebabDariButir(["Tergugat sering mabuk dan minum minuman keras"]);
    const s2 = da.sebabDariButir(["Tergugat sering mabuk-mabukan"]);
    const p = da.sebabDariButir(["Tergugat tidak memberikan nafkah"]);
    const a = da.usulHuruf({ s1, s2, posita: p }).find((h) => h.huruf === "A")!;
    expect(a.usul).toBe(true);
    expect(a.dariSaksi).toBe(true);
  });
});
