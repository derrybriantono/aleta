// @vitest-environment node
import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * KATALOG SUSUN SAKSI - MESIN (saksi-katalog.js)
 * ============================================================================
 *
 * Yang dijaga:
 *   - jenis perkara dikenali dari id SIPP, BUKAN dari variabel cerai: perkara
 *     yang jenisnya tidak punya katalog mendapat null (tidak jatuh ke cerai);
 *   - dua saksi pada satu butir TIDAK pernah berbunyi sama (2 sampai 5 saksi,
 *     semua jenis keterangan, semua keadaan);
 *   - ragu: kalimatnya memuat kata ragu, tanpa angka, dan butir identitas /
 *     hubungan / penutup tidak ikut ragu;
 *   - pemuat: data ekstensi memuat persis katalog yang ada di folder sumber;
 *   - penanda: yang tidak terisi menjadi "..." dan disebut, tidak pernah ditebak.
 */

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Mesin = require(path.join(AKAR, "saksi-katalog.js")) as any;
const FOLDER = path.join(AKAR, "saksi-katalog");

const katalog: any[] = readdirSync(FOLDER)
  .filter((n) => n.endsWith(".json"))
  .sort()
  .map((n) => JSON.parse(readFileSync(path.join(FOLDER, n), "utf8")))
  .filter((k) => !k.contoh);

const cerai = (k: any) => k.syarat.jenisPerkaraId.some((x: string) => ["346", "347"].includes(String(x)));
// katalog cerai SUDAH digabung dengan katalog tambahannya (kumulasi) - itulah yang dipakai borang
const CG = Mesin.kenaliPaket(katalog, { jenisPerkaraId: "347", alurPerkaraId: "15" });
const CT = Mesin.kenaliPaket(katalog, { jenisPerkaraId: "346", alurPerkaraId: "15" });

const norm = (t: string) => Mesin.rapikan(t);

/** Variabel tiruan: semua kode terisi dengan teks pendek yang tak memuat "ya, ". */
const variabelPenuh = (kode: string) => (kode === "0046" ? "Penggugat" : kode === "0047" ? "Tergugat" : `isi${kode}`);

function susun(kat: any, jumlah: number, jenis: string | string[], keadaan: Record<string, unknown> = {}, benih = "10/Pdt.G/2026/PA.Dgl", ekstra: any = {}) {
  const saksi = Array.from({ length: jumlah }, (_v, i) => ({ pihak: "P", jenis: Array.isArray(jenis) ? jenis[i % jenis.length] : jenis }));
  return Mesin.susunSaksi(kat, { keadaan, benih, saksi, variabel: variabelPenuh, ...ekstra });
}

describe("katalog yang ada", () => {
  it("cerai gugat dan cerai talak ada, dengan jumlah pertanyaan dan varian yang memadai", () => {
    expect(CG, "cerai-gugat").toBeTruthy();
    expect(CT, "cerai-talak").toBeTruthy();
    for (const k of [CG, CT]) {
      const r = Mesin.ringkasKatalog(k);
      expect(r.pertanyaan).toBeGreaterThanOrEqual(40);
      expect(r.kalimat).toBeGreaterThanOrEqual(400);
      expect(Mesin.periksaKatalog(k).galat).toEqual([]);
    }
  });
});

describe("deteksi jenis - bukan dari variabel cerai", () => {
  it("jenis_perkara_id memilih katalognya; alur yang salah tidak cocok", () => {
    expect(Mesin.kenaliKatalog(katalog, { jenisPerkaraId: "347", alurPerkaraId: "15" })?.kunci).toBe("cerai-gugat");
    expect(CG.digabungDari).toContain("cerai-kumulasi");
    expect(CT.digabungDari).toContain("cerai-kumulasi");
    expect(Mesin.kenaliKatalog(katalog, { jenisPerkaraId: 346, alurPerkaraId: "15" })?.kunci).toBe("cerai-talak");
    expect(Mesin.kenaliKatalog(katalog, { jenisPerkaraId: "347", alurPerkaraId: "16" })).toBeNull();
  });

  it("jenis lain TIDAK jatuh ke cerai - hasilnya katalog jenisnya sendiri atau null", () => {
    const lain = ["341", "342", "343", "344", "348", "349", "350", "351", "352", "353", "354", "355", "356", "357", "358", "359", "360", "361", "362", "363", "364", "365", "366", "367", "369", "370", "371", "743"];
    for (const id of lain) {
      const k = Mesin.kenaliKatalog(katalog, { jenisPerkaraId: id });
      if (k) expect(k.syarat.jenisPerkaraId.map(String), `${id} -> ${k.kunci}`).toContain(id);
      expect(k === null || !cerai(k), `${id} dikenali sebagai cerai`).toBe(true);
    }
  });

  it("id tak terbaca atau bukan angka -> null (tidak ada cadangan cerai)", () => {
    for (const id of ["", undefined, null, "Cerai Gugat", "abc", " "]) {
      expect(Mesin.kenaliKatalog(katalog, { jenisPerkaraId: id, alurPerkaraId: "15", nama: "Cerai Gugat" }), String(id)).toBeNull();
    }
    expect(Mesin.kenaliKatalog(katalog, {})).toBeNull();
    expect(Mesin.kenaliKatalog([], { jenisPerkaraId: "347" })).toBeNull();
  });

  it("katalog contoh tidak pernah dikenali", () => {
    const contoh = { ...CG, kunci: "contoh", contoh: true };
    expect(Mesin.kenaliKatalog([contoh], { jenisPerkaraId: "347", alurPerkaraId: "15" })).toBeNull();
  });

  it("polaNama memilih di antara katalog yang berbagi satu jenis", () => {
    const a = { contoh: false, kunci: "a", syarat: { jenisPerkaraId: ["369"], polaNama: "pengangkatan\\s+anak" } };
    const b = { contoh: false, kunci: "b", syarat: { jenisPerkaraId: ["369"], polaNama: "permohonan\\s+umum" } };
    expect(Mesin.kenaliKatalog([a, b], { jenisPerkaraId: "369", nama: "Lain-lain Pengangkatan Anak" })?.kunci).toBe("a");
    expect(Mesin.kenaliKatalog([a, b], { jenisPerkaraId: "369", nama: "Permohonan Umum" })?.kunci).toBe("b");
    expect(Mesin.kenaliKatalog([a, b], { jenisPerkaraId: "369", nama: "Hibah" })).toBeNull();
  });
});

describe("keadaan perkara", () => {
  it("DAN antar kunci, ATAU antar nilai, bukan: menegasikan", () => {
    const ada = { kehadiran: "verstek", kumulasi: ["hak-asuh", "mutah"] };
    expect(Mesin.cocokKeadaan({}, ada)).toBe(true);
    expect(Mesin.cocokKeadaan({ kehadiran: ["verstek", "kontradiktoir"] }, ada)).toBe(true);
    expect(Mesin.cocokKeadaan({ kehadiran: "kontradiktoir" }, ada)).toBe(false);
    expect(Mesin.cocokKeadaan({ kumulasi: "mutah" }, ada)).toBe(true);
    expect(Mesin.cocokKeadaan({ kumulasi: "mutah", kehadiran: "kontradiktoir" }, ada)).toBe(false);
    expect(Mesin.cocokKeadaan({ "bukan:kehadiran": "verstek" }, ada)).toBe(false);
    expect(Mesin.cocokKeadaan({ "bukan:kehadiran": "kontradiktoir" }, ada)).toBe(true);
  });

  it("verstek dan kontradiktoir mengaktifkan pertanyaan upaya damai yang berbeda", () => {
    const v = Mesin.pertanyaanAktif(CG, { kehadiran: "verstek", alasan: ["F"] }, "P").map((q: any) => q.id);
    const c = Mesin.pertanyaanAktif(CG, { kehadiran: "kontradiktoir", alasan: ["F"] }, "P").map((q: any) => q.id);
    expect(v).toContain("q-upaya-keluarga-verstek");
    expect(v).not.toContain("q-upaya-keluarga");
    expect(c).toContain("q-upaya-keluarga");
    expect(c).not.toContain("q-upaya-keluarga-verstek");
  });

  it("alasan dan kumulasi mengaktifkan pertanyaan khususnya, dan hanya itu", () => {
    const dasar = Mesin.pertanyaanAktif(CG, { kehadiran: "verstek", alasan: ["F"] }, "P").map((q: any) => q.id);
    expect(dasar).not.toContain("q-d-kekerasan");
    expect(dasar).not.toContain("q-anak-lahir");
    expect(dasar).not.toContain("q-in-akad");
    const khusus = Mesin.pertanyaanAktif(CG, { kehadiran: "verstek", alasan: ["F", "D"], kumulasi: ["hak-asuh", "itsbat-nikah"] }, "P").map((q: any) => q.id);
    expect(khusus).toContain("q-d-kekerasan");
    expect(khusus).toContain("q-anak-lahir");
    expect(khusus).toContain("q-in-akad");
    const alasanA = Mesin.pertanyaanAktif(CG, { kehadiran: "verstek", alasan: ["A"], perilakuA: ["judi"] }, "P").map((q: any) => q.id);
    expect(alasanA).toContain("q-a-judi");
    expect(alasanA).not.toContain("q-a-mabuk");
    // alasan F tidak dipilih: pokok perselisihan tidak ditanyakan
    expect(alasanA).not.toContain("q-penyebab");
  });

  it("urutan pertanyaan naik dan tidak ada yang kembar", () => {
    const daftar = Mesin.pertanyaanAktif(CG, { kehadiran: "kontradiktoir", alasan: ["A", "B", "C", "D", "E", "F", "G", "H"], kumulasi: ["hak-asuh", "nafkah-anak", "harta-bersama", "itsbat-nikah", "mutah"], suami: "lawan", perilakuA: ["pihak-ketiga", "mabuk", "obat-terlarang", "judi"] }, "P");
    const urutan = daftar.map((q: any) => q.urutan);
    expect([...urutan].sort((a, b) => a - b)).toEqual(urutan);
    expect(new Set(daftar.map((q: any) => q.id)).size).toBe(daftar.length);
  });
});

describe("varian - saksi 1 tidak pernah sama dengan saksi 2", () => {
  const keadaanBanyak = [
    { kehadiran: "verstek", alasan: ["F"] },
    { kehadiran: "kontradiktoir", alasan: ["F"] },
    { kehadiran: "t-tidak-hadir-setelah-mediasi", alasan: ["A", "B", "C", "D", "E", "F", "G", "H"], perilakuA: ["pihak-ketiga", "mabuk", "obat-terlarang", "judi"], kumulasi: ["hak-asuh", "nafkah-anak", "nafkah-iddah", "mutah", "harta-bersama", "itsbat-nikah"] },
  ];

  for (const kat of [CG, CT]) {
    for (const jumlah of [2, 3, 4, 5]) {
      for (const jenis of ["melihat", "mendengar", "de-auditu", "sebagian", "tidak-tahu", "ragu"]) {
        it(`${kat.kunci}: ${jumlah} saksi, semuanya ${jenis} - tiap butir berbeda antar saksi`, () => {
          for (const keadaan of keadaanBanyak) {
            const h = susun(kat, jumlah, jenis, keadaan);
            const perButir = new Map<string, string[]>();
            for (const sk of h.saksi) for (const b of sk.baris) perButir.set(b.butir, [...(perButir.get(b.butir) ?? []), norm(b.jawab)]);
            for (const [butir, jawab] of perButir) {
              const sama = jawab.length - new Set(jawab).size;
              // butir identitas/hubungan/penutup memakai 'melihat' dan 4 varian: 5 saksi memakai kedua daftar, tetap unik
              expect(sama, `${kat.kunci} ${butir} ${jenis} ${jumlah} saksi: ${JSON.stringify(jawab)}`).toBe(0);
            }
          }
        });
      }
    }
  }

  it("campuran jenis keterangan: saksi 1 melihat, saksi 2 de auditu, saksi 3 sebagian, saksi 4 ragu, saksi 5 tidak tahu", () => {
    const h = susun(CG, 5, ["melihat", "de-auditu", "sebagian", "ragu", "tidak-tahu"], { kehadiran: "verstek", alasan: ["F"] });
    expect(h.saksi).toHaveLength(5);
    const cara = h.saksi.map((s: any) => s.baris.find((b: any) => b.butir === "q-cara-tahu"));
    expect(cara.map((b: any) => b.jenis)).toEqual(["melihat", "de-auditu", "sebagian", "ragu", "tidak-tahu"]);
    expect(new Set(cara.map((b: any) => norm(b.jawab))).size).toBe(5);
    expect(cara[1].jawab).toMatch(/cerita|diberi tahu|penuturan|dikabari|mendengar dari/i);
  });

  it("deterministik: masukan sama -> keluaran sama; nomor perkara lain boleh memilih varian lain", () => {
    const a = susun(CG, 3, "melihat", { kehadiran: "verstek", alasan: ["F"] }, "1/Pdt.G/2026/PA.Dgl");
    const b = susun(CG, 3, "melihat", { kehadiran: "verstek", alasan: ["F"] }, "1/Pdt.G/2026/PA.Dgl");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const beda = ["2", "3", "4", "5", "6", "7"].map((n) => JSON.stringify(susun(CG, 2, "melihat", { kehadiran: "verstek", alasan: ["F"] }, `${n}/Pdt.G/2026/PA.Dgl`)));
    expect(new Set(beda).size).toBeGreaterThan(1);
  });

  it("saksi 1 dan saksi 2 yang sama jenisnya memakai kalimat dari daftar yang berbeda", () => {
    const q = CG.pertanyaan.find((x: any) => x.id === "q-penyebab");
    const obj = q.jawaban.melihat;
    const s1 = new Set(obj.saksi1.map(norm));
    const h = susun(CG, 2, "melihat", { kehadiran: "verstek", alasan: ["F"] });
    const j1 = norm(h.saksi[0].baris.find((b: any) => b.butir === "q-penyebab").jawab.replace("isi5227", "#5227#"));
    expect(j1.length).toBeGreaterThan(0);
    // saksi 1 dari daftar saksi1, saksi 2 dari daftar saksi2 (penanda #5227# diganti nilainya)
    const ganti = (t: string) => norm(t.replace(/#5227#/g, "isi5227"));
    const daftar1 = new Set(obj.saksi1.map(ganti));
    const daftar2 = new Set(obj.saksi2.map(ganti));
    expect(daftar1.has(norm(h.saksi[0].baris.find((b: any) => b.butir === "q-penyebab").jawab))).toBe(true);
    expect(daftar2.has(norm(h.saksi[1].baris.find((b: any) => b.butir === "q-penyebab").jawab))).toBe(true);
    expect(s1.size).toBeGreaterThanOrEqual(4);
  });
});

describe("ragu dan jenis keterangan lain", () => {
  const POLA_RAGU = /ragu|tidak yakin|kurang yakin|lupa|tidak ingat|kurang pasti|kurang jelas|kira-kira|mungkin|rasanya|entah|belum pasti|tidak pasti|kurang ingat/i;

  it("saksi ragu: butir pokok memuat kata ragu dan tanpa angka; butir hubungan dan penutup tetap menyebut sebab pengetahuan", () => {
    const h = susun(CG, 3, "ragu", { kehadiran: "verstek", alasan: ["F"] });
    for (const sk of h.saksi) {
      for (const b of sk.baris) {
        const q = CG.pertanyaan.find((x: any) => x.id === b.butir);
        if (["hubungan", "penutup", "identitas"].includes(q.kelompok)) {
          expect(b.jenis, b.butir).toBe("melihat");
        } else {
          expect(b.jenis, b.butir).toBe("ragu");
          expect(POLA_RAGU.test(b.jawab), `${b.butir}: ${b.jawab}`).toBe(true);
          expect(/\d/.test(b.jawab.replace(/#\d{4}#/g, "")), `${b.butir}: ${b.jawab}`).toBe(false);
        }
      }
    }
  });

  it("jawaban ragu tidak menurunkan fakta: tidak memuat nilai variabel penting", () => {
    // 0222, 0246, 9944 diganti nilai bersahaja; jawaban ragu tidak boleh memuatnya
    const h = susun(CG, 2, "ragu", { kehadiran: "verstek", alasan: ["F"] }, "5/Pdt.G/2026/PA.Dgl", {
      variabel: (kode: string) => (["0222", "0246", "9944"].includes(kode) ? `NILAIPENTING${kode}` : variabelPenuh(kode)),
    });
    for (const sk of h.saksi) for (const b of sk.baris) if (b.jenis === "ragu") expect(b.jawab).not.toMatch(/NILAIPENTING/);
  });

  it("pokok wajib yang semua saksinya ragu menghasilkan peringatan", () => {
    const h = susun(CG, 2, "ragu", { kehadiran: "verstek", alasan: ["F"] });
    expect(h.peringatan.some((p: string) => /belum terbukti/.test(p))).toBe(true);
    const baik = susun(CG, 2, "melihat", { kehadiran: "verstek", alasan: ["F"] });
    expect(baik.peringatan.some((p: string) => /belum terbukti/.test(p))).toBe(false);
  });

  it("baris ragu, sebagian, dan berbeda bertanda kuning; melihat tidak", () => {
    const h = susun(CG, 2, ["ragu", "melihat"], { kehadiran: "verstek", alasan: ["F"] });
    expect(h.saksi[0].baris.some((b: any) => b.tandaKuning)).toBe(true);
    expect(h.saksi[1].baris.every((b: any) => !b.tandaKuning)).toBe(true);
  });

  it("saksi berbeda keterangan: butir yang dipilih berubah menjadi versi berlawanan, hanya bila butir mendukungnya", () => {
    const saksi = [{ pihak: "P", jenis: "melihat" }, { pihak: "P", jenis: "melihat", berbeda: ["q-penyebab", "q-kenal", "q-tidak-ada"] }];
    const h = Mesin.susunSaksi(CG, { keadaan: { kehadiran: "kontradiktoir", alasan: ["F"] }, benih: "9/Pdt.G/2026/PA.Dgl", saksi, variabel: variabelPenuh });
    const a = h.saksi[0].baris.find((b: any) => b.butir === "q-penyebab");
    const b = h.saksi[1].baris.find((x: any) => x.butir === "q-penyebab");
    expect(a.jenis).toBe("melihat");
    expect(b.jenis).toBe("berbeda");
    expect(norm(a.jawab)).not.toBe(norm(b.jawab));
    // q-kenal tidak mendukung 'berbeda': tetap melihat
    expect(h.saksi[1].baris.find((x: any) => x.butir === "q-kenal").jenis).toBe("melihat");
    expect(b.tandaKuning).toBe(true);
  });

  it("jenis yang tidak masuk akal bagi butir jatuh ke 'melihat'", () => {
    const h = susun(CG, 2, "tidak-tahu", { kehadiran: "verstek", alasan: ["F"] });
    const kenal = h.saksi[0].baris.find((b: any) => b.butir === "q-kenal");
    expect(kenal.jenis).toBe("melihat");
    const penyebab = h.saksi[0].baris.find((b: any) => b.butir === "q-penyebab");
    expect(penyebab.jenis).toBe("tidak-tahu");
    expect(penyebab.jawab).toMatch(/tidak/);
  });

  it("de auditu memakai sumber cerita yang dipilih petugas, dan bawaannya pihak yang menghadirkan", () => {
    const bawaan = susun(CG, 2, "de-auditu", { kehadiran: "verstek", alasan: ["F"] });
    expect(bawaan.saksi[0].baris.find((b: any) => b.butir === "q-cara-tahu").jawab).toContain("Penggugat");
    const khusus = Mesin.susunSaksi(CG, {
      keadaan: { kehadiran: "verstek", alasan: ["F"] }, benih: "x", variabel: variabelPenuh,
      saksi: [{ pihak: "P", jenis: "de-auditu" }, { pihak: "P", jenis: "de-auditu" }],
      slotSaksi: [{ sumber: "ibu kandung Penggugat" }, {}],
    });
    expect(khusus.saksi[0].baris.find((b: any) => b.butir === "q-cara-tahu").jawab).toContain("ibu kandung Penggugat");
  });

  it("saksi dari pihak Tergugat: sebutan dan pertanyaan menyesuaikan", () => {
    const h = Mesin.susunSaksi(CG, { keadaan: { kehadiran: "kontradiktoir", alasan: ["F"] }, benih: "t", variabel: variabelPenuh, saksi: [{ pihak: "P", jenis: "melihat" }, { pihak: "T", jenis: "melihat" }] });
    const m1 = h.saksi[0].baris.find((b: any) => b.butir === "q-maksud");
    const m2 = h.saksi[1].baris.find((b: any) => b.butir === "q-maksud");
    expect(m1.tanya).toContain("Penggugat");
    expect(m2.tanya).toContain("Tergugat");
    expect(m1.jawab).toMatch(/Penggugat/);
    expect(m2.jawab).toMatch(/Tergugat/);
  });
});

describe("penanda isian", () => {
  it("variabel kosong menjadi titik-titik dan disebut; tidak pernah ditebak", () => {
    const h = susun(CG, 2, "melihat", { kehadiran: "verstek", alasan: ["F"] }, "1/Pdt.G/2026/PA.Dgl", { variabel: (kode: string) => (kode === "0046" || kode === "0047" ? variabelPenuh(kode) : "") });
    const penyebab = h.saksi[0].baris.find((b: any) => b.butir === "q-penyebab");
    expect(penyebab.jawab).toContain("...");
    expect(penyebab.kosong).toContain("#5227#");
    expect(penyebab.jawab).not.toMatch(/#\d{4}#|\{[a-z]+\}/i);
  });

  it("DATA_TIDAK_ADA dan #nnnn# yang belum terganti dianggap kosong", () => {
    for (const nilai of ["DATA_TIDAK_ADA", "#5227#", "", " ", "___", "..."]) expect(Mesin.tidakTerisi(nilai), nilai).toBe(true);
    for (const nilai of ["karena nafkah", "2 tahun"]) expect(Mesin.tidakTerisi(nilai), nilai).toBe(false);
  });

  it("slot teks bebas dari petugas dipakai; yang kosong menjadi titik-titik", () => {
    const keadaan = { kehadiran: "verstek", alasan: ["E"] };
    const kosong = susun(CG, 2, "melihat", keadaan);
    expect(kosong.saksi[0].baris.find((b: any) => b.butir === "q-e-cacat").jawab).toContain("...");
    const isi = Mesin.susunSaksi(CG, { keadaan, benih: "z", variabel: variabelPenuh, slot: { isi: "lumpuh", sejak: "2020" }, saksi: [{ pihak: "P", jenis: "melihat" }, { pihak: "P", jenis: "melihat" }] });
    const anak = isi.saksi[0].baris.find((b: any) => b.butir === "q-e-cacat");
    expect(anak.jawab).toContain("lumpuh");
    expect(anak.kosong).toEqual([]);
  });

  it("pelaku dan korban: bawaan Tergugat dan Penggugat, dapat dibalik; isi hal ikut terganti", () => {
    const keadaan = { kehadiran: "verstek", alasan: ["D"] };
    const bawaan = susun(CG, 2, "tidak-tahu", keadaan);
    const kek = bawaan.saksi[0].baris.find((b: any) => b.butir === "q-d-kekerasan");
    expect(kek.jawab).toContain("Tergugat");
    expect(kek.jawab).not.toMatch(/\{|\}/);
    const balik = Mesin.susunSaksi(CG, { keadaan, benih: "b", variabel: variabelPenuh, slot: { pelaku: "#0046#", korban: "#0047#" }, saksi: [{ pihak: "P", jenis: "melihat" }, { pihak: "P", jenis: "melihat" }] });
    expect(balik.saksi[0].baris.find((b: any) => b.butir === "q-d-kekerasan").jawab).toContain("Penggugat");
  });

  it("hubungan saksi dibaca dari variabel hubungan saksi ke-n pihaknya", () => {
    const h = Mesin.susunSaksi(CG, {
      keadaan: { kehadiran: "verstek", alasan: ["F"] }, benih: "h",
      variabel: (kode: string) => ({ "0046": "Penggugat", "0047": "Tergugat", "1241": "ibu kandung", "1242": "tetangga", "1251": "kakak", "6149": "paman" })[kode] ?? "",
      saksi: [{ pihak: "P", jenis: "melihat" }, { pihak: "P", jenis: "melihat" }, { pihak: "P", jenis: "melihat" }, { pihak: "T", jenis: "melihat" }],
    });
    const kenal = (i: number) => h.saksi[i].baris.find((b: any) => b.butir === "q-kenal").jawab;
    expect(kenal(0)).toContain("ibu kandung");
    expect(kenal(1)).toContain("tetangga");
    expect(kenal(2)).toContain("paman");
    expect(kenal(3)).toContain("kakak");
  });

  it("keluaran aman bagi replace_ket_saksi ABT: tanpa 'ya, ' dan tanpa 'sayang'; tidak ada kata Aleta", () => {
    expect(Mesin.amankanKeAbt("anaknya, dan nafkah")).toBe("anaknya dan nafkah");
    for (const kat of [CG, CT]) {
      const h = susun(kat, 5, ["melihat", "mendengar", "de-auditu", "sebagian", "ragu"], { kehadiran: "kontradiktoir", alasan: ["A", "B", "D", "F"], perilakuA: ["judi", "mabuk"], kumulasi: ["hak-asuh", "mutah", "nafkah-anak", "itsbat-nikah"] },
        "11/Pdt.G/2026/PA.Dgl", { slot: { isi: "pamannya", daftar: "nafkah, anaknya", pekerjaan: "tani", penghasilan: "Rp1.000.000", lama: "2 tahun", sejak: "Maret 2023" } });
      for (const sk of h.saksi) for (const b of sk.baris) {
        expect(b.jawab + b.tanya, b.butir).not.toMatch(/ya, /i);
        expect(b.jawab + b.tanya, b.butir).not.toMatch(/sayang/i);
        expect(b.jawab + b.tanya, b.butir).not.toMatch(/aleta/i);
        expect(b.jawab + b.tanya, b.butir).not.toMatch(/<|\$\{/);
      }
    }
  });
});

describe("pemeriksa skema menolak katalog yang cacat", () => {
  const salin = () => JSON.parse(JSON.stringify(CG));

  it("katalog sah lolos", () => {
    expect(Mesin.periksaKatalog(salin()).ok).toBe(true);
  });

  it("kurang dari 4 varian, kalimat kembar, dan saksi1 = saksi2 ditolak", () => {
    const a = salin();
    a.pertanyaan[0].jawaban.melihat.saksi1.pop();
    expect(Mesin.periksaKatalog(a).galat.join("\n")).toMatch(/saksi1 hanya 3 varian/);
    const b = salin();
    b.pertanyaan[0].jawaban.melihat.saksi2[0] = b.pertanyaan[0].jawaban.melihat.saksi1[0];
    expect(Mesin.periksaKatalog(b).galat.join("\n")).toMatch(/sama dengan saksi2|kembar/);
  });

  it("ragu yang memuat angka atau tanpa kata ragu ditolak", () => {
    const a = salin();
    a.jawabanUmum.ragu.saksi1[0] = "saya ragu soal {hal} sejak 2020";
    expect(Mesin.periksaKatalog(a).galat.join("\n")).toMatch(/angka/);
    const b = salin();
    b.jawabanUmum.ragu.saksi1[0] = "saya jelas soal {hal}";
    expect(Mesin.periksaKatalog(b).galat.join("\n")).toMatch(/tanpa kata ragu/);
  });

  it("'ya, ', 'sayang', kata Aleta, penanda asing, slot asing, dan huruf besar di awal ditolak", () => {
    const uji = (ubah: (k: any) => void, pola: RegExp) => {
      const k = salin();
      ubah(k);
      expect(Mesin.periksaKatalog(k).galat.join("\n")).toMatch(pola);
    };
    uji((k) => (k.jawabanUmum["tidak-tahu"].saksi1[0] = "anaknya, tidak tahu {hal}"), /ya, /);
    uji((k) => (k.jawabanUmum["tidak-tahu"].saksi1[0] = "saya tidak tahu {hal} dan sayang"), /sayang/);
    uji((k) => (k.jawabanUmum["tidak-tahu"].saksi1[0] = "saya tidak tahu {hal} menurut Aleta"), /Aleta/i);
    uji((k) => (k.jawabanUmum["tidak-tahu"].saksi1[0] = "saya tidak tahu {hal} {asing}"), /slot tidak baku/);
    uji((k) => (k.jawabanUmum["tidak-tahu"].saksi1[0] = "Saya tidak tahu {hal}"), /huruf besar/);
    uji((k) => (k.pertanyaan[0].jawaban.melihat.saksi1[0] += " #9999#"), /tidak ada di variabelAbt|penanda/);
  });

  it("jenis tanpa jawaban 'berbeda' dan tanpa tidakBerlaku ditolak; hal wajib bila memakai jawaban umum", () => {
    const a = salin();
    const q = a.pertanyaan.find((x: any) => x.id === "q-komunikasi");
    q.tidakBerlaku = [];
    expect(Mesin.periksaKatalog(a).galat.join("\n")).toMatch(/jawaban\.berbeda wajib/);
    const b = salin();
    delete b.pertanyaan.find((x: any) => x.id === "q-komunikasi").hal;
    expect(Mesin.periksaKatalog(b).galat.join("\n")).toMatch(/hal wajib/);
  });

  it("pokok wajib tanpa pertanyaan dan syarat keadaan yang tidak dideklarasikan ditolak", () => {
    const a = salin();
    a.pertanyaan = a.pertanyaan.filter((x: any) => x.pokok !== "pp-upaya-damai");
    expect(Mesin.periksaKatalog(a).galat.join("\n")).toMatch(/pokok wajib pp-upaya-damai/);
    const b = salin();
    b.pertanyaan[0].keadaan = { tidakAda: "x" };
    expect(Mesin.periksaKatalog(b).galat.join("\n")).toMatch(/tidak dideklarasikan/);
  });

  it("kode variabel asing ditolak kecuali dideklarasikan di variabelBaru", () => {
    const a = salin();
    const ada = new Set(["0046", "0047"]);
    expect(Mesin.periksaKatalog(a, { variabelAda: ada }).galat.join("\n")).toMatch(/tidak ada di abt-variabel/);
    a.variabelBaru = Array.from(new Set(a.pertanyaan.flatMap((q: any) => q.variabelAbt))).filter((x) => !ada.has(String(x)));
    expect(Mesin.periksaKatalog(a, { variabelAda: ada }).galat).toEqual([]);
  });
});
