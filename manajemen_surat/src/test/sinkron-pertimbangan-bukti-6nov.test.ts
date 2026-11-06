import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { BarisBukti } from "@/lib/bukti-tertulis";
import {
  bacaKeadaan,
  gabungKode,
  isiKartu,
  KARTU_PERTIMBANGAN,
  namaTanpaBin,
  susunParagrafBukti,
  type BuktiMasuk,
  type MasukanPertimbangan,
} from "@/lib/sinkron-pertimbangan-bukti";

const KTP: BarisBukti = { nm: "Kartu Tanda Penduduk", an: "Fulanah binti Fulan", no: "1234567890123456", tgl: "2020-01-02", oleh: "Dinas Kependudukan", meterai: 0, cocok: 0, manual: null };
const NIKAH: BarisBukti = { nm: "Kutipan Akta Nikah", an: "", no: "123/45/VI/2010", tgl: "2010-06-01", oleh: "KUA", meterai: 0, cocok: 0, manual: null };
const KK: BarisBukti = { nm: "Kartu Keluarga", an: "Fulan", no: "99", tgl: "", oleh: "", meterai: 0, cocok: 0, manual: null };
const bukti = (): BuktiMasuk[] => [
  { sisi: "P", nomor: 1, baris: { ...KTP } },
  { sisi: "P", nomor: 2, baris: { ...NIKAH } },
];
const dasar = (o: Partial<MasukanPertimbangan> = {}): MasukanPertimbangan => ({
  jenisCerai: "CG",
  status: "Dikabulkan",
  verstek: false,
  lawanHadir: true,
  lawanMembantah: false,
  agendaPembuktianKe: 1,
  bukti: bukti(),
  ...o,
});
const teks = (m: MasukanPertimbangan) => susunParagrafBukti(m).paragraf.map((p) => p.bunyi).join("\n");

describe("pembacaan keadaan", () => {
  it("membedakan status dan verstek", () => {
    expect(bacaKeadaan("Dikabulkan", true).kunci).toBe("kabul-verstek");
    expect(bacaKeadaan("Dikabulkan", false).kunci).toBe("kabul");
    expect(bacaKeadaan("Ditolak", true).kunci).toBe("tolak-verstek");
    expect(bacaKeadaan("Ditolak", false).kunci).toBe("tolak");
    expect(bacaKeadaan("Tidak Dapat Diterima", false).kunci).toBe("tdt");
    expect(bacaKeadaan("Dicabut", false).kunci).toBe("cabut");
    for (const s of ["Gugur", "Digugurkan", "Perdamaian"]) expect(bacaKeadaan(s, false).kunci).toBe("kosong");
  });
  it("gabungKode dan namaTanpaBin", () => {
    expect(gabungKode(["P.1"])).toBe("P.1");
    expect(gabungKode(["P.1", "P.2"])).toBe("P.1 dan P.2");
    expect(gabungKode(["P.1", "P.2", "P.3"])).toBe("P.1, P.2 dan P.3");
    expect(namaTanpaBin("Fulanah binti Fulan")).toBe("FULANAH");
    expect(namaTanpaBin("Fulan bin Fulin alias Ful")).toBe("FULAN");
  });
});

describe("kabul verstek", () => {
  it("menulis bunyi KTP dan Kutipan Akta Nikah otomatis, tanpa kalimat tidak dibantah", () => {
    const h = susunParagrafBukti(dasar({ verstek: true, lawanHadir: false }));
    expect(h.paragraf.map((p) => p.kode)).toEqual(["P.1", "P.2"]);
    expect(h.paragraf.every((p) => p.cara === "otomatis")).toBe(true);
    expect(h.paragraf[0].bunyi).toContain("alat bukti P.1 merupakan keterangan mengenai identitas dan domisili Penggugat");
    expect(h.paragraf[1].bunyi).toContain("alat bukti P.2 menunjukkan Penggugat dan Tergugat telah terikat sebagai suami istri");
    expect(h.paragraf.map((p) => p.bunyi).join(" ")).not.toContain("tidak dibantah");
    expect(h.paragraf[0].asal).toContain("Kabul Verstek");
  });
  it("cerai talak memakai Pemohon dan Termohon", () => {
    const t = teks(dasar({ jenisCerai: "CT", verstek: true, lawanHadir: false }));
    expect(t).toContain("Pemohon");
    expect(t).toContain("Termohon");
    expect(t).not.toContain("Penggugat");
  });
  it("tanpa penanda mentah, tanpa titik-titik", () => {
    const t = teks(dasar({ verstek: true }));
    expect(t).not.toMatch(/#\d+#|\{\w+\}|\[\[|\{\{|\.{3,}/);
  });
});

describe("kabul kontradiktoir", () => {
  it("menulis paragraf penuh menurut kartu dan urut bukti", () => {
    const h = susunParagrafBukti(dasar());
    const t = h.paragraf.map((p) => p.bunyi).join("\n");
    expect(t).toContain("Bahwa bukti P.1 dan P.2 yang diajukan Penggugat telah diberi meterai cukup");
    expect(t).toContain("Bahwa bukti P.1 dan P.2 adalah fotokopi yang telah dicocokkan dengan aslinya");
    expect(t).toContain("Kartu Tanda Penduduk atas nama FULANAH dalam perkara a quo");
    expect(t).toContain("mengajukan gugatan cerai terhadap Tergugat");
    expect(h.paragraf.every((p) => p.cara === "otomatis")).toBe(true);
    expect(t).not.toMatch(/#\d+#|\{\w+\}|\[\[|\{\{/);
  });
  it("cerai talak menyebut permohonan", () => {
    const t = teks(dasar({ jenisCerai: "CT" }));
    expect(t).toContain("mengajukan permohonan cerai terhadap Termohon");
  });
  it("kalimat tidak dibantah hanya bila lawan hadir; toggle membantah mengubah bunyinya", () => {
    const hadir = teks(dasar());
    expect(hadir).toContain("serta tidak dibantah kebenarannya oleh Tergugat");
    const bantah = teks(dasar({ lawanMembantah: true }));
    expect(bantah).not.toContain("tidak dibantah");
    expect(bantah).toContain("pejabat yang berwenang untuk itu, sehingga mempunyai nilai kekuatan pembuktian sempurna");
    const tidakHadir = teks(dasar({ lawanHadir: false }));
    expect(tidakHadir).not.toContain("tidak dibantah");
  });
  it("sisi tergugat memakai pihak sendiri", () => {
    const m = dasar({ bukti: [{ sisi: "T", nomor: 1, baris: { ...KTP, an: "Fulan bin Fulin" } }, { sisi: "T", nomor: 2, baris: { ...NIKAH } }] });
    const t = teks(m);
    expect(t).toContain("identitas resmi penduduk Tergugat");
    expect(t).toContain("tidak dibantah kebenarannya oleh Penggugat");
    expect(t).toContain("T.1 dan T.2 yang diajukan Tergugat");
  });
  it("tanggal nikah ditulis hanya bila diberikan", () => {
    expect(teks(dasar())).not.toContain("menikah pada tanggal");
    expect(teks(dasar({ konteks: { tglNikah: "2010-06-01" } }))).toContain("suami istri sah yang menikah pada tanggal 1 Juni 2010 yang hingga kini belum pernah bercerai");
  });
  it("pasal acara mengikuti hukum acara; kosong menulis keduanya", () => {
    expect(teks(dasar())).toContain("Pasal 285 RBg/Pasal 165 HIR");
    expect(teks(dasar({ konteks: { hukumAcara: "HIR" } }))).toContain("Pasal 165 HIR jo. Pasal 1870");
    expect(teks(dasar({ konteks: { hukumAcara: "RBg" } }))).not.toContain("HIR");
  });
});

describe("bukti disunting, dihapus, tanpa asli", () => {
  it("nama pada KTP memengaruhi paragraf; kosong tidak ditebak", () => {
    const b = bukti();
    b[0].baris.an = "Siti Aminah binti Ali";
    expect(teks(dasar({ bukti: b }))).toContain("atas nama SITI AMINAH dalam");
    b[0].baris.an = "";
    const t = teks(dasar({ bukti: b }));
    expect(t).not.toContain("atas nama");
    expect(t).toContain("Kartu Tanda Penduduk dalam perkara a quo");
  });
  it("bukti yang dihapus hilang dari paragraf dan sebutan kode", () => {
    const t = teks(dasar({ bukti: bukti().slice(0, 1) }));
    expect(t).toContain("Bahwa bukti P.1 yang diajukan");
    expect(t).not.toContain("P.2");
  });
  it("bukti tanpa asli: cukup 'tidak dapat dicocokkan dengan aslinya', kekuatan tidak berubah", () => {
    const b = bukti();
    b[1].baris.cocok = 1;
    const h = susunParagrafBukti(dasar({ bukti: b }));
    const t = h.paragraf.map((p) => p.bunyi).join("\n");
    expect(t).toContain("Bahwa bukti P.2 adalah fotokopi yang tidak dapat dicocokkan dengan aslinya");
    expect(t).toContain("Bahwa bukti P.1 adalah fotokopi yang telah dicocokkan dengan aslinya");
    expect(t).toContain("Bahwa bukti P.1 dan P.2 merupakan akta autentik");
  });
  it("isian meterai atau pencocokan yang tidak ada bunyinya dicatat, tidak dikarang", () => {
    const b = bukti();
    b[0].baris.meterai = 1;
    b[1].baris.cocok = 2;
    const h = susunParagrafBukti(dasar({ bukti: b }));
    expect(h.belumAdaBunyi.map((x) => x.kode).sort()).toEqual(["P.1", "P.2"]);
    expect(teks(dasar({ bukti: b }))).not.toContain("tidak dinazegelen");
  });
  it("kalimat bebas tidak mengarang isian", () => {
    const b = bukti();
    b[0].baris = { nm: "Kartu Tanda Penduduk", manual: "KTP atas nama X, lalu diberi tanda P.1 serta diberi tanggal dan paraf oleh Ketua Majelis;" };
    const t = teks(dasar({ bukti: b }));
    expect(t).toContain("Bahwa bukti P.2 yang diajukan Penggugat telah diberi meterai cukup");
  });
});

describe("pokok dan pelengkap, jenis tanpa bunyi", () => {
  it("bukti pelengkap menjadi usulan; jenis tanpa bunyi sendiri masuk belumAdaBunyi", () => {
    const b = [...bukti(), { sisi: "P" as const, nomor: 3, baris: { ...KK } }];
    const h = susunParagrafBukti(dasar({ bukti: b }));
    const usulan = h.paragraf.filter((p) => p.cara === "usulan");
    expect(usulan.length).toBeGreaterThan(0);
    expect(usulan.every((p) => p.kode === "P.3")).toBe(true);
    expect(h.paragraf.filter((p) => p.cara === "otomatis").every((p) => !p.kode.includes("P.3"))).toBe(true);
    expect(h.belumAdaBunyi).toEqual([{ kode: "P.3", kunci: "kk", nama: "Kartu Keluarga", alasan: "Blangko tidak memuat bunyi untuk jenis bukti ini." }]);
  });
  it("bukti tidak dikenal tidak menghasilkan bunyi karangan", () => {
    const h = susunParagrafBukti(dasar({ bukti: [{ sisi: "P", nomor: 1, baris: { ...KK, nm: "Benda aneh" } }] }));
    expect(h.paragraf.every((p) => p.cara === "usulan")).toBe(true);
    expect(h.belumAdaBunyi).toHaveLength(1);
  });
});

describe("ditolak, tidak dapat diterima, gugur, perdamaian", () => {
  it("ditolak verstek memakai bunyi verstek", () => {
    const h = susunParagrafBukti(dasar({ status: "Ditolak", verstek: true, lawanHadir: false }));
    expect(h.paragraf.map((p) => p.kode)).toEqual(["P.1", "P.2"]);
  });
  it("ditolak kontradiktoir: bukti dinilai, tidak menyimpulkan dalil perceraian terbukti", () => {
    const h = susunParagrafBukti(dasar({ status: "Ditolak" }));
    expect(h.paragraf).toHaveLength(1);
    expect(h.paragraf[0].kode).toBe("P.1 dan P.2");
    expect(h.paragraf[0].bunyi).toContain("adalah suami istri sah yang hingga kini belum pernah bercerai");
    expect(h.paragraf[0].bunyi).not.toMatch(/perselisihan dan pertengkaran/);
    expect(h.catatan.join(" ")).toContain("tanpa menyimpulkan");
  });
  it("tidak dapat diterima tidak menulis paragraf per bukti", () => {
    const h = susunParagrafBukti(dasar({ status: "Tidak Dapat Diterima" }));
    expect(h.paragraf).toEqual([]);
    expect(h.belumAdaBunyi).toHaveLength(2);
  });
  it("gugur, digugurkan, perdamaian kosong", () => {
    for (const status of ["Gugur", "Digugurkan", "Perdamaian"]) {
      const h = susunParagrafBukti(dasar({ status }));
      expect(h.paragraf).toEqual([]);
      expect(h.belumAdaBunyi).toEqual([]);
    }
  });
});

describe("dicabut menurut agenda pembuktian", () => {
  const dua = (): BuktiMasuk[] => [
    { sisi: "P", nomor: 1, baris: { ...KTP }, agendaKe: 1 },
    { sisi: "P", nomor: 2, baris: { ...NIKAH }, agendaKe: 1 },
    { sisi: "P", nomor: 3, baris: { ...KTP, an: "Lain" }, agendaKe: 2 },
  ];
  it("sebelum pembuktian: tidak ada paragraf", () => {
    expect(susunParagrafBukti(dasar({ status: "Dicabut", agendaPembuktianKe: 0, bukti: dua() })).paragraf).toEqual([]);
  });
  it("pada agenda pertama: tidak ada paragraf", () => {
    expect(susunParagrafBukti(dasar({ status: "Dicabut", agendaPembuktianKe: 1, bukti: dua() })).paragraf).toEqual([]);
  });
  it("pada agenda kedua: bukti pembuktian pertama saja, semuanya usulan", () => {
    const h = susunParagrafBukti(dasar({ status: "Dicabut", agendaPembuktianKe: 2, bukti: dua() }));
    expect(h.paragraf.length).toBeGreaterThan(0);
    expect(h.paragraf.every((p) => p.cara === "usulan")).toBe(true);
    expect(h.paragraf.map((p) => p.bunyi).join(" ")).not.toContain("P.3");
    expect(h.catatan[0]).toContain("agenda pembuktian ke-2");
  });
});

describe("isiKartu", () => {
  it("segmen bersyarat hilang bila isian kosong", () => {
    expect(isiKartu("a[[ b {x}]] c", { x: "" }, true)).toBe("a c");
    expect(isiKartu("a[[ b {x}]] c", { x: "Z" }, true)).toBe("a b Z c");
    expect(isiKartu("a{{tdkbantah| b}} c", {}, false)).toBe("a c");
  });
});

/* ---------------------------------------------------------------- kepatuhan: bunyi kartu berasal dari bahan */
type Bahan = { blangko: Array<{ folder: string; berkas: string; alineaBukti: string[] }> };
const bahan = JSON.parse(readFileSync(path.resolve(__dirname, "../../../docs/arahan/awan-f46-bahan-cerai.json"), "utf8")) as Bahan;

/** Penukaran penanda blangko menjadi nama kolom bukti: sama dengan yang dipakai saat kartu dibuat. */
function majuKeKartu(t: string, sisi: "P" | "T"): string {
  const [p, l] = sisi === "P" ? ["#0046#", "#0047#"] : ["#0047#", "#0046#"];
  let x = t.split(p).join("@@P@@").split(l).join("@@L@@").split("@@P@@").join("{pihak}").split("@@L@@").join("{lawan}");
  x = x
    .replace(/#0053#/g, "{perkara}")
    .replace(/#8554#/g, "{majelis}")
    .replace(/#8008#/g, "{satker}")
    .replace(/#1011#/g, "{tglNikah}")
    .replace(/#4048#|#4050#/g, "{namaTanpaBin}")
    .replace("Pasal #11886# #11851#", "{pasalAkta}")
    .replace("Pasal #11885# #11851#", "{pasalAlatBukti}")
    .replace(/\b[PT]\.\d dan [PT]\.\d/g, "{kode}")
    .replace(/\b[PT]\.\d\b/g, "{kode}");
  return x;
}
const tanpaSegmen = (t: string) => t.replace(/\{\{tdkbantah\|([\s\S]*?)\}\}/g, "$1").replace(/\[\[([\s\S]*?)\]\]/g, "$1");

/** Kartu itsbat nikah dan dispensasi kawin diperiksa di sinkron-pertimbangan-itsbat-dk-6nov.test.ts terhadap bahan mereka. */
const KARTU_CERAI = KARTU_PERTIMBANGAN.filter((k) => k.perkara.every((j) => j === "CG" || j === "CT"));

describe("kepatuhan: bunyi kartu berasal dari bahan blangko", () => {
  it("ada kartu dan tiap kartu punya rujukan", () => {
    expect(KARTU_PERTIMBANGAN.length).toBeGreaterThanOrEqual(10);
    for (const k of KARTU_PERTIMBANGAN) expect(k.asal.length > 0 || Boolean(k.sumberKhusus)).toBe(true);
  });
  it("setiap rujukan menunjuk alinea nyata yang sama dengan bunyi kartu", () => {
    for (const k of KARTU_CERAI) {
      for (const a of k.asal) {
        const blangko = bahan.blangko.find((b) => b.folder === a.folder && b.berkas === a.berkas);
        expect(blangko, `${k.id}: blangko ${a.berkas}`).toBeTruthy();
        const alinea = blangko!.alineaBukti[a.alinea];
        expect(alinea, `${k.id}: alinea ${a.alinea}`).toBeTruthy();
        expect(tanpaSegmen(k.bunyi), `${k.id} <- ${a.berkas}`).toBe(majuKeKartu(alinea, a.sisiSumber));
      }
    }
  });
  it("kartu tanpa rujukan hanya yang disahkan keputusan pemilik, dan frasanya tertulis tepat", () => {
    for (const k of KARTU_PERTIMBANGAN.filter((x) => x.asal.length === 0)) {
      expect(k.sumberKhusus).toContain("Keputusan pemilik");
      expect(k.bunyi).toContain("tidak dapat dicocokkan dengan aslinya");
    }
  });
  it("tidak ada kata Aleta, penanda mentah, atau data perkara pada bunyi kartu", () => {
    for (const k of KARTU_PERTIMBANGAN) {
      expect(k.bunyi).not.toMatch(/aleta/i);
      expect(k.bunyi).not.toMatch(/#\d+#/);
      expect(k.bunyi).not.toMatch(/\b\d{16}\b/);
    }
  });
  it("kartu hanya memakai berkas Kabul/Tolak yang ada di bahan dan hanya untuk cerai", () => {
    for (const k of KARTU_CERAI) for (const a of k.asal) expect(/Perceraian (CG|CT)/.test(a.folder)).toBe(true);
  });
});
