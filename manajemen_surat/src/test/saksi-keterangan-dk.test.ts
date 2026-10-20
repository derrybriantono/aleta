// @vitest-environment node
import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * KETERANGAN ANAK, CALON, DAN ORANG TUA - DISPENSASI KAWIN (keputusan 57)
 * ============================================================================
 *
 * Katalog keterangan pihak (ekstensi-sipp/saksi-katalog/dispensasi-kawin-keterangan.json) menempel pada katalog
 * saksi dispensasi kawin tetapi BUKAN butir saksi. Yang dijaga:
 *   - butir saksi dispensasi kawin tetap sebanyak katalog saksinya (45 pada versi 1, 62 pada versi 2 agen U4); katalog keterangan tidak melebur ke saksi;
 *   - butir kehamilan dan hubungan badan TIDAK tercetak sebelum petugas mengonfirmasi (bawaan: mati);
 *   - ayah dan ibu diperiksa terpisah, nomor pemberi keterangan ganjil/genap tidak membuat kalimat kembar;
 *   - jawaban "berbeda" memakai versi B; ragu dan berbeda bertanda kuning, ragu pada hal yang menentukan diperingatkan;
 *   - wali: "anak yang saya asuh"; pendamping dan rekomendasi ahli hanya bila ada;
 *   - tanpa kata "Aleta", tanpa kode #nnnn# yang tampil, tanpa istilah teknis.
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

const DK = Mesin.kenaliPaket(katalog, { jenisPerkaraId: "362", alurPerkaraId: "16" });
const KET = Mesin.kenaliKeterangan(katalog, DK);

const NILAI: Record<string, string> = {
  "0600": "Budi",
  "0606": "Siti",
  "0601": "20 (dua puluh) tahun",
  "0607": "16 (enam belas) tahun",
  "0999": "2 (dua) bulan",
  "1666": "1 (satu) tahun",
  "6331": "buruh bangunan",
  "0609": "SMP",
  "0603": "SMA",
  "2029": "jejaka",
  "2030": "perawan",
  "3333": "Banawa, Kabupaten Donggala",
  "8008": "Pengadilan Agama",
};
const variabelPenuh = (kode: string) => NILAI[kode] ?? "";

const SEMUA_HADIR = [
  { peran: "anak", hadir: true },
  { peran: "calon", hadir: true },
  { peran: "orangTuaAnak", hadir: true, jumlah: 2 },
  { peran: "orangTuaCalon", hadir: true, jumlah: 2 },
];

function susunKet(keadaan: Record<string, unknown> = {}, periksa: any[] = SEMUA_HADIR, ekstra: Record<string, unknown> = {}) {
  return Mesin.susunKeterangan(KET, { keadaan: { jenisKelaminAnak: "perempuan", sebabDK: "lain", calonJuga: "dewasa", ...keadaan }, benih: "5/Pdt.P/2026/PA.Dgl", periksa, variabel: variabelPenuh, ...ekstra });
}

const semuaBaris = (h: any) => h.pemberi.flatMap((p: any) => p.baris) as any[];
const adaButir = (h: any, id: string) => semuaBaris(h).some((b) => b.butir === id);

describe("katalog keterangan tidak mengubah butir saksi", () => {
  it("butir saksi dispensasi kawin tidak berubah oleh katalog keterangan (62 butir pada katalog versi 2) dan tidak ada tanda penggabungan", () => {
    expect(DK, "katalog dispensasi kawin").toBeTruthy();
    expect(DK.pertanyaan.length).toBe(62);
    expect(DK.digabungDari).toBeUndefined();
    expect(DK.pertanyaan.some((q: any) => String(q.id).startsWith("q-kt-"))).toBe(false);
    expect(Object.keys(DK.keadaan)).not.toContain("peran");
    expect(Object.keys(DK.keadaan)).not.toContain("tidakHadir");
  });

  it("gabungKatalog melewati katalog keterangan pihak walau menunjuk katalog utama", () => {
    expect(KET.jenisKatalog).toBe("keterangan-pihak");
    expect(KET.tambahanUntuk).toContain("dispensasi-kawin");
    const gabung = Mesin.gabungKatalog(Mesin.kenaliKatalog(katalog, { jenisPerkaraId: "362" }), katalog);
    expect(gabung.pertanyaan.length).toBe(62);
  });

  it("katalog keterangan tidak dikenali sebagai katalog saksi berdiri sendiri", () => {
    const k = Mesin.kenaliKatalog(katalog, { jenisPerkaraId: "362", alurPerkaraId: "16" });
    expect(k.kunci).toBe("dispensasi-kawin");
  });

  it("jenis perkara lain tidak mendapat tab keterangan", () => {
    for (const id of ["347", "346", "348", "364", "360", "363"]) {
      const utama = Mesin.kenaliPaket(katalog, { jenisPerkaraId: id });
      if (utama) expect(Mesin.kenaliKeterangan(katalog, utama), id).toBeNull();
    }
    expect(Mesin.kenaliKeterangan(katalog, null)).toBeNull();
  });
});

describe("kehamilan dan hubungan badan: tidak tercetak sebelum dikonfirmasi", () => {
  for (const sebab of ["hamil", "hubungan-badan"]) {
    it(`sebab ${sebab}: bawaan mati - tidak ada butirnya dan tidak ada fakta kehamilan atau hubungan badan`, () => {
      const h = susunKet({ sebabDK: sebab });
      expect(adaButir(h, "q-kt-hamil-diri")).toBe(false);
      expect(adaButir(h, "q-kt-hamil-ortu")).toBe(false);
      expect(adaButir(h, "q-kt-hubungan-badan-diri")).toBe(false);
      expect(adaButir(h, "q-kt-hubungan-badan-ortu")).toBe(false);
      expect(h.ditahan.length).toBeGreaterThan(0);
      const teks = semuaBaris(h).map((b) => `${b.tanya} ${b.jawab}`).join("\n");
      // nasihat Hakim tentang risiko kehamilan dini bersifat umum dan tetap ada; yang tidak boleh tercetak adalah FAKTA perkara ini
      expect(teks).not.toMatch(/sedang hamil|sudah hamil|telah hamil|usia kandungan|mengandung|hubungan badan|dua bulan|2 \(dua\) bulan/i);
    });

    it(`sebab ${sebab}: dengan konfirmasi petugas butirnya tercetak untuk anak, calon, dan orang tua`, () => {
      const h = susunKet({ sebabDK: sebab }, SEMUA_HADIR, { konfirmasiSebab: true });
      const id = sebab === "hamil" ? "hamil" : "hubungan-badan";
      expect(adaButir(h, `q-kt-${id}-diri`)).toBe(true);
      expect(adaButir(h, `q-kt-${id}-ortu`)).toBe(true);
      expect(h.ditahan).toEqual([]);
    });
  }

  it("tanpa latar belakang itu (lain) tidak ada butir sensitif walau dikonfirmasi", () => {
    const h = susunKet({ sebabDK: "lain" }, SEMUA_HADIR, { konfirmasiSebab: true });
    expect(semuaBaris(h).some((b) => /^q-kt-(hamil|hubungan-badan)/.test(b.butir))).toBe(false);
  });

  it("konfirmasi hanya benar bila nilainya persis true", () => {
    for (const nilai of ["true", 1, "ya", undefined, null]) {
      const h = susunKet({ sebabDK: "hamil" }, SEMUA_HADIR, { konfirmasiSebab: nilai });
      expect(adaButir(h, "q-kt-hamil-diri"), String(nilai)).toBe(false);
    }
  });
});

describe("pemberi keterangan: peran, ayah dan ibu terpisah, nomor urut", () => {
  it("urutan periksa anak, calon, orang tua anak, orang tua calon; ayah dan ibu masing-masing satu blok", () => {
    const h = susunKet();
    expect(h.pemberi.map((p: any) => `${p.ke}:${p.peran}`)).toEqual(["1:anak", "2:calon", "3:orangTuaAnak", "4:orangTuaAnak", "5:orangTuaCalon", "6:orangTuaCalon"]);
    expect(h.pemberi[2].label).toContain("ayah");
    expect(h.pemberi[3].label).toContain("ibu");
    for (const p of h.pemberi) expect(p.baris.length, p.label).toBeGreaterThan(15);
  });

  it("satu orang tua: nomor pemberi tetap (orang tua calon tetap bernomor 5)", () => {
    const h = susunKet({}, [
      { peran: "anak", hadir: true },
      { peran: "calon", hadir: true },
      { peran: "orangTuaAnak", hadir: true, jumlah: 1 },
      { peran: "orangTuaCalon", hadir: true, jumlah: 1 },
    ]);
    expect(h.pemberi.map((p: any) => p.ke)).toEqual([1, 2, 3, 5]);
  });

  it("pada satu butir tidak ada dua pemberi keterangan dengan kalimat yang sama (semua jenis, dua orang tua)", () => {
    const jenisDiri = ["melihat", "ragu"];
    const jenisOrtu = ["melihat", "mendengar", "de-auditu", "sebagian", "ragu"];
    for (const jd of jenisDiri) {
      for (const jo of jenisOrtu) {
        const periksa = [
          { peran: "anak", hadir: true, jenis: jd },
          { peran: "calon", hadir: true, jenis: jd },
          { peran: "orangTuaAnak", hadir: true, jumlah: 2, jenis: jo },
          { peran: "orangTuaCalon", hadir: true, jumlah: 2, jenis: jo },
        ];
        const h = susunKet({ sebabDK: "hamil" }, periksa, { konfirmasiSebab: true });
        const perButir = new Map<string, string[]>();
        for (const p of h.pemberi) for (const b of p.baris) perButir.set(`${b.butir}|${b.jenis}`, [...(perButir.get(`${b.butir}|${b.jenis}`) ?? []), Mesin.rapikan(b.jawab)]);
        for (const [kunci, jawab] of perButir) {
          const jenisButir = kunci.split("|")[1];
          // butir identitas, hubungan, dan penutup pada kelas yang sama memang boleh sama bila inti jawabannya tunggal
          if (["melihat"].includes(jenisButir) && /penutup/.test(kunci)) continue;
          const nilaiBerbeda = new Set(jawab);
          expect(nilaiBerbeda.size, `${kunci}: ${jawab.join(" || ")}`).toBe(jawab.length);
        }
      }
    }
  });

  it("deterministik: masukan sama menghasilkan keterangan sama; nomor perkara lain boleh memilih kalimat lain", () => {
    const a = susunKet();
    const b = susunKet();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = Mesin.susunKeterangan(KET, { keadaan: { jenisKelaminAnak: "perempuan", sebabDK: "lain", calonJuga: "dewasa" }, benih: "99/Pdt.P/2030/PA.Dgl", periksa: SEMUA_HADIR, variabel: variabelPenuh });
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
  });

  it("peran yang tidak ada dalam masukan atau tidak hadir tidak diperiksa", () => {
    const h = susunKet({}, [{ peran: "anak", hadir: true }, { peran: "calon", hadir: false }, { peran: "orangTuaAnak", hadir: false }]);
    expect(h.pemberi.map((p: any) => p.peran)).toEqual(["anak"]);
  });
});

describe("anak atau calon tidak hadir", () => {
  it("calon tidak hadir: tidak diperiksa, butir ketidakhadiran aktif untuk orang tua calon, sebab ikut menentukan kalimat", () => {
    const h = susunKet({ tidakHadir: ["calon"], sebabTidakHadir: "sakit" });
    expect(h.pemberi.some((p: any) => p.peran === "calon")).toBe(false);
    const ortuCalon = h.pemberi.filter((p: any) => p.peran === "orangTuaCalon");
    expect(ortuCalon.length).toBe(2);
    for (const p of ortuCalon) {
      const absen = p.baris.filter((b: any) => /^q-kt-absen-.*calon-ortu$/.test(b.butir));
      expect(absen.length, p.label).toBe(3);
    }
    const teks = ortuCalon[0].baris.filter((b: any) => /absen/.test(b.butir)).map((b: any) => b.jawab).join(" ");
    expect(teks).toMatch(/sakit/);
    // butir ketidakhadiran anak tidak ikut karena anak hadir
    expect(adaButir(h, "q-kt-absen-anak-ortu")).toBe(false);
  });

  it("kartu yang ditandai tidak hadir cukup dengan hadir=false (keadaan tidakHadir disusul otomatis)", () => {
    const h = susunKet({ sebabTidakHadir: "luar-daerah" }, [{ peran: "anak", hadir: false }, { peran: "calon", hadir: true }, { peran: "orangTuaAnak", hadir: true, jumlah: 1 }]);
    expect(adaButir(h, "q-kt-absen-anak-ortu")).toBe(true);
    expect(h.pemberi.some((p: any) => p.peran === "anak")).toBe(false);
  });
});

describe("jenis keterangan: berbeda, ragu, dan peringatan", () => {
  const butir = (h: any, kode: string, id: string, orang = 0) => h.pemberi.filter((p: any) => p.peran === kode)[orang].baris.find((b: any) => b.butir === id);

  it("anak 'berbeda' pada kemauan: kalimatnya dari versi B (saksi2), bertanda kuning, dan menimbulkan peringatan hal yang menentukan", () => {
    const h = susunKet({}, [{ peran: "anak", hadir: true, berbeda: ["q-kt-kemauan-diri"] }]);
    const b = butir(h, "anak", "q-kt-kemauan-diri");
    expect(b.jenis).toBe("berbeda");
    expect(b.tandaKuning).toBe(true);
    const q = KET.pertanyaan.find((x: any) => x.id === "q-kt-kemauan-diri");
    const objek = Mesin.pilihObjekJawaban(KET, q, "berbeda", { peran: "anak", jenisKelaminAnak: "perempuan", sebabDK: "lain", calonJuga: "dewasa" });
    expect(objek.saksi2.length).toBeGreaterThanOrEqual(4);
    const sama = objek.saksi2.some((t: string) => Mesin.rapikan(Mesin.isiPenanda(t, { variabel: variabelPenuh, slot: {} }).teks) === Mesin.rapikan(b.jawab));
    expect(sama, b.jawab).toBe(true);
    expect(h.peringatan.join("\n")).toMatch(/ragu atau berselisih pada hal yang menentukan/);
  });

  it("pemberi lain yang tidak ditandai tetap memakai versi A walau urutannya pertama pada butir itu", () => {
    const h = susunKet({}, [{ peran: "anak", hadir: true }, { peran: "calon", hadir: true, berbeda: ["q-kt-kemauan-diri"] }]);
    const q = KET.pertanyaan.find((x: any) => x.id === "q-kt-kemauan-diri");
    const objekAnak = Mesin.pilihObjekJawaban(KET, q, "melihat", { peran: "anak", jenisKelaminAnak: "perempuan", sebabDK: "lain", calonJuga: "dewasa" });
    const kalimatAnak = [...objekAnak.saksi1, ...objekAnak.saksi2].map((t: string) => Mesin.rapikan(Mesin.isiPenanda(t, { variabel: variabelPenuh, slot: {} }).teks));
    expect(kalimatAnak).toContain(Mesin.rapikan(butir(h, "anak", "q-kt-kemauan-diri").jawab));
    expect(butir(h, "calon", "q-kt-kemauan-diri").jenis).toBe("berbeda");
  });

  it("ragu: kalimat otomatis bertanda kuning, tanpa angka; sebagian juga kuning; menyatakan sendiri tidak", () => {
    const h = susunKet({}, [{ peran: "orangTuaAnak", hadir: true, jumlah: 1, jenis: "ragu" }]);
    const ragu = h.pemberi[0].baris.filter((b: any) => b.jenis === "ragu");
    expect(ragu.length).toBeGreaterThan(10);
    for (const b of ragu) {
      expect(b.tandaKuning).toBe(true);
      expect(b.jawab, b.butir).not.toMatch(/\d/);
    }
    const sendiri = susunKet({}, [{ peran: "orangTuaAnak", hadir: true, jumlah: 1 }]).pemberi[0].baris;
    expect(sendiri.every((b: any) => !b.tandaKuning || b.jenis !== "melihat")).toBe(true);
  });

  it("ragu pada orang tua tidak menimbulkan peringatan hal yang menentukan (itu hanya untuk anak dan calon)", () => {
    const h = susunKet({}, [{ peran: "orangTuaAnak", hadir: true, jumlah: 1, jenis: "ragu" }]);
    expect(h.peringatan.join("\n")).not.toMatch(/menentukan/);
  });

  it("de auditu memakai sumber cerita yang dipilih; bawaannya 'anak saya'", () => {
    const bawaan = susunKet({}, [{ peran: "orangTuaAnak", hadir: true, jumlah: 1, jenis: "de-auditu" }]);
    const teksBawaan = bawaan.pemberi[0].baris.filter((b: any) => b.jenis === "de-auditu").map((b: any) => b.jawab).join(" ");
    expect(teksBawaan).toMatch(/anak saya/);
    const guru = susunKet({}, [{ peran: "orangTuaAnak", hadir: true, jumlah: 1, jenis: "de-auditu", sumber: "guru" }]);
    const teksGuru = guru.pemberi[0].baris.filter((b: any) => b.jenis === "de-auditu").map((b: any) => b.jawab).join(" ");
    expect(teksGuru).toMatch(/guru/);
    expect(Mesin.SUMBER_CERITA).toEqual(["anak saya", "keluarga", "tetangga", "guru"]);
  });

  it("jenis yang tidak masuk akal bagi butir jatuh ke 'menyatakan sendiri'", () => {
    const h = susunKet({}, [{ peran: "anak", hadir: true, jenis: "de-auditu" }]);
    const umur = butir(h, "anak", "q-kt-umur-diri");
    expect(umur.jenis).toBe("melihat");
  });
});

describe("wali: anak yang saya asuh", () => {
  it("orang tua yang ditandai wali tidak menulis 'anak saya' atau 'kandung'", () => {
    const h = susunKet({ sebabDK: "hamil" }, [{ peran: "orangTuaAnak", hadir: true, jumlah: 1, wali: true }, { peran: "orangTuaCalon", hadir: true, jumlah: 1 }], { konfirmasiSebab: true });
    const wali = h.pemberi.find((p: any) => p.peran === "orangTuaAnak");
    const teks = wali.baris.map((b: any) => `${b.tanya} ${b.jawab}`).join("\n");
    expect(teks).toMatch(/anak yang saya asuh/);
    expect(teks).not.toMatch(/\banak saya\b/i);
    expect(teks).not.toMatch(/kandung/i);
    expect(wali.label).toMatch(/wali/);
    // orang tua kandung lain tetap "anak saya"
    const ortuLain = h.pemberi.find((p: any) => p.peran === "orangTuaCalon").baris.map((b: any) => b.jawab).join("\n");
    expect(ortuLain).toMatch(/anak saya/);
  });

  it("rumusWali menangani huruf besar di awal kalimat dan 'orang tuanya'", () => {
    expect(Mesin.rumusWali("Anak saya mau menikah")).toBe("Anak yang saya asuh mau menikah");
    expect(Mesin.rumusWali("itu saya ketahui sebagai orang tuanya")).toBe("itu saya ketahui sebagai walinya");
    expect(Mesin.rumusWali("Apakah Saudara orang tua kandung dari anak itu?")).toBe("Apakah Saudara wali dari anak itu?");
    expect(Mesin.rumusWali("orang tua atau wali")).toBe("orang tua atau wali");
  });
});

describe("pendamping anak dan rekomendasi psikolog atau tenaga kesehatan: hanya bila ada", () => {
  const PEND = /^q-kt-(pendamping|rekomendasi)-/;
  it("bawaan: tidak ada butirnya; dengan keadaan yang sesuai butir yang bersangkutan muncul", () => {
    expect(semuaBaris(susunKet()).some((b) => PEND.test(b.butir))).toBe(false);
    const hP = susunKet({ pendampingan: ["pendamping-anak"] });
    const idP = new Set(semuaBaris(hP).filter((b) => PEND.test(b.butir)).map((b) => b.butir));
    expect(Array.from(idP).sort()).toEqual(["q-kt-pendamping-diri", "q-kt-pendamping-ortu"]);
    const hR = susunKet({ pendampingan: ["rekomendasi-ahli"] });
    const idR = new Set(semuaBaris(hR).filter((b) => PEND.test(b.butir)).map((b) => b.butir));
    expect(Array.from(idR).sort()).toEqual(["q-kt-rekomendasi-diri", "q-kt-rekomendasi-ortu"]);
    const hDua = susunKet({ pendampingan: ["pendamping-anak", "rekomendasi-ahli"] });
    expect(new Set(semuaBaris(hDua).filter((b) => PEND.test(b.butir)).map((b) => b.butir)).size).toBe(4);
  });

  it("tiap butir baru punya 4 + 4 kalimat pada jawaban menyatakan sendiri, ragu, dan berbeda", () => {
    const baru = KET.pertanyaan.filter((q: any) => PEND.test(q.id));
    expect(baru.map((q: any) => q.id).sort()).toEqual(["q-kt-pendamping-diri", "q-kt-pendamping-ortu", "q-kt-rekomendasi-diri", "q-kt-rekomendasi-ortu"]);
    for (const q of baru) {
      for (const j of ["melihat", "ragu", "berbeda"]) {
        const o = [].concat(q.jawaban[j])[0] as any;
        expect(o.saksi1.length, `${q.id}.${j}`).toBeGreaterThanOrEqual(4);
        expect(o.saksi2.length, `${q.id}.${j}`).toBeGreaterThanOrEqual(4);
      }
    }
    expect(Mesin.periksaKatalog(KET).galat).toEqual([]);
  });
});

describe("isi keluaran: variabel, istilah, dan cakupan", () => {
  it("KUA ditulis #3333# (bukan #5178#) dan penanda yang dipakai hanya yang ada di kamus", () => {
    const isi = JSON.stringify(KET);
    expect(isi).not.toContain("#5178#");
    expect(isi).toContain("#3333#");
    expect(KET.variabelBaru ?? []).toEqual([]);
  });

  it("variabel terisi tidak meninggalkan kode #nnnn#, kurung kurawal, 'Aleta', atau istilah teknis di teks tampil", () => {
    const h = susunKet({ sebabDK: "hamil", tidakHadir: ["calon"], pendampingan: ["pendamping-anak", "rekomendasi-ahli"] }, SEMUA_HADIR.map((e) => ({ ...e, jenis: e.peran.startsWith("orang") ? "de-auditu" : "ragu" })), { konfirmasiSebab: true });
    const teks = semuaBaris(h).map((b) => `${b.tanya}\n${b.jawab}`).join("\n");
    expect(teks).not.toMatch(/#\d{4}#/);
    expect(teks).not.toMatch(/[{}]/);
    expect(teks).not.toMatch(/aleta/i);
    expect(teks).not.toMatch(/borang|peladen|galat|template|varian/i);
    expect(teks).not.toMatch(/ya, |sayang/i);
    expect(h.peringatan.join(" ")).not.toMatch(/tidak punya jawaban/);
  });

  it("variabel kosong menjadi titik-titik dan dicatat; tidak ada kode yang tampil", () => {
    const h = Mesin.susunKeterangan(KET, { keadaan: { jenisKelaminAnak: "perempuan", sebabDK: "lain", calonJuga: "dewasa" }, benih: "x", periksa: SEMUA_HADIR, variabel: () => "" });
    const baris = semuaBaris(h);
    const merah = baris.filter((b) => b.kosong.length > 0);
    expect(merah.length).toBeGreaterThan(5);
    for (const b of baris) {
      expect(`${b.tanya} ${b.jawab}`).not.toMatch(/#\d{4}#/);
      if (b.kosong.length) expect(b.jawab + b.tanya).toContain("...");
    }
  });

  it("cakupan: semua kombinasi keadaan, peran, dan jenis menghasilkan jawaban (tanpa butir kosong)", () => {
    const jenisKelamin = ["perempuan", "laki-laki"];
    const sebab = ["hamil", "hubungan-badan", "lain"];
    const calon = ["dewasa", "di-bawah-umur"];
    const sekolah = ["masih-bersekolah", "tidak-bersekolah"];
    const hadir: Array<string[]> = [[], ["anak"], ["calon"], ["anak", "calon"]];
    const jenisDiri = ["melihat", "ragu"];
    const jenisOrtu = ["melihat", "mendengar", "de-auditu", "sebagian", "ragu"];
    let diperiksa = 0;
    for (const jk of jenisKelamin) for (const sb of sebab) for (const cj of calon) for (const sk of sekolah) for (const th of hadir) for (let i = 0; i < jenisOrtu.length; i += 1) {
      const jd = jenisDiri[i % jenisDiri.length];
      const jo = jenisOrtu[i];
      const periksa = [
        { peran: "anak", hadir: !th.includes("anak"), jenis: jd, berbeda: ["q-kt-kemauan-diri"] },
        { peran: "calon", hadir: !th.includes("calon"), jenis: jd },
        { peran: "orangTuaAnak", hadir: true, jumlah: 2, jenis: jo, berbeda: ["q-kt-restu-ortu"] },
        { peran: "orangTuaCalon", hadir: true, jumlah: 2, jenis: jo, wali: i % 2 === 0 },
      ];
      const h = Mesin.susunKeterangan(KET, {
        keadaan: { jenisKelaminAnak: jk, sebabDK: sb, calonJuga: cj, sekolah: sk, tidakHadir: th, sebabTidakHadir: "luar-daerah", pendampingan: ["pendamping-anak", "rekomendasi-ahli"] },
        benih: "uji",
        periksa,
        konfirmasiSebab: true,
        variabel: variabelPenuh,
      });
      diperiksa += 1;
      expect(h.peringatan.filter((p: string) => /tidak punya jawaban/.test(p)), `${jk}/${sb}/${cj}/${sk}/${th}/${jo}`).toEqual([]);
      for (const b of semuaBaris(h)) {
        expect(b.jawab.trim().length, b.butir).toBeGreaterThan(5);
        expect(b.jawab, b.butir).not.toMatch(/#\d{4}#|\{|\}/);
      }
    }
    expect(diperiksa).toBe(2 * 3 * 2 * 2 * 4 * 5);
  });

  it("teksTanyaJawab: 'Pertanyaan ?Jawaban;' satu baris per butir", () => {
    const t = Mesin.teksTanyaJawab([{ tanya: "Berapa umur Saudara saat ini?", jawab: "saya berumur 16 tahun" }, { tanya: "Apakah masih ada yang ingin disampaikan ?", jawab: "sudah cukup" }]);
    expect(t).toBe("Berapa umur Saudara saat ini ?saya berumur 16 tahun;\nApakah masih ada yang ingin disampaikan ?sudah cukup;");
  });
});

describe("kehamilan dan hubungan badan mengikuti posita (keputusan pengguna no. 65)", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require(path.join(AKAR, "saksi-susun.js"));
  const sebab = (teks: string): string => (globalThis as any).AletaSaksiSusun.sebabDariPosita(teks);

  it("posita hamil -> 'hamil' (konfirmasi tercentang sendiri di panel); hubungan badan -> 'hubungan-badan'; hamil didahulukan", () => {
    expect(sebab("Bahwa anak Pemohon sekarang sedang hamil 2 (dua) bulan")).toBe("hamil");
    expect(sebab("Bahwa calon istri anak Pemohon sedang mengandung")).toBe("hamil");
    expect(sebab("Bahwa keduanya sudah berhubungan badan layaknya suami istri")).toBe("hubungan-badan");
    expect(sebab("Bahwa keduanya sudah berhubungan badan dan sekarang hamil")).toBe("hamil");
  });

  it("posita tanpa kehamilan atau hubungan badan, atau yang menyangkalnya -> tetap mati", () => {
    expect(sebab("Bahwa anak Pemohon berumur 16 tahun dan ingin menikah")).toBe("");
    expect(sebab("Bahwa anak Pemohon tidak hamil dan belum pernah berhubungan badan")).toBe("");
    expect(sebab("")).toBe("");
    expect(sebab(undefined as unknown as string)).toBe("");
  });

  it("centang manual menang: mesin hanya mencetak butir bila konfirmasi persis true, apa pun isi posita", () => {
    for (const nilai of [false, null, undefined]) {
      const h = susunKet({ sebabDK: "hamil" }, SEMUA_HADIR, { konfirmasiSebab: nilai });
      expect(adaButir(h, "q-kt-hamil-diri"), String(nilai)).toBe(false);
    }
    expect(adaButir(susunKet({ sebabDK: "hamil" }, SEMUA_HADIR, { konfirmasiSebab: true }), "q-kt-hamil-diri")).toBe(true);
  });
});
