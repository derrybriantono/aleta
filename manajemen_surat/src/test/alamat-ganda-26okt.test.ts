// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { kunciTempat, miripTempat, rapikanAlamat } from "../lib/alamat-pihak";
import { KABUPATEN_SULTENG, KELURAHAN_SULTENG } from "../lib/kelurahan-sulteng";

/**
 * ALAMAT PIHAK TANPA EKOR WILAYAH GANDA (26 Okt 2026)
 *
 * Putusan 620/Pdt.G/2026/PA.Dgl mencetak identitas Penggugat dengan alamat ganda:
 *   "Kelurahan Ganti, Kecamatan Banawa , Kabupaten Donggala, Provinsi Sulawesi Tengah, Ganti, Banawa, Kabupaten Donggala, Sulawesi Tengah"
 * Bagian kedua bukan ketikan petugas: SIPP/e-Court menempelkan nama desa, kecamatan, kabupaten, provinsi RESMI (tanpa sebutan) di ujung alamat.
 * Tergugat di luar wilayah ("Jalan Anggur 4 ... Kota Palu, Provinsi Sulawesi Tengah") tidak ganda, jadi penggabungannya harus pintar:
 * tingkatan yang SUDAH disebut di depan dibuang dari ekor, yang belum disebut dipertahankan, dan kabupaten/provinsi yang berbeda dari
 * yang diketik dibiarkan (bentrok).
 *
 * Tiga kembaran memakai aturan yang sama dan diuji atas satu korpus (fixtures/alamat-ganda-26okt.json):
 *   - portal  : src/lib/alamat-pihak.ts (rapikanAlamat; juga membuang petunjuk arah dan memberi sebutan pada potongan lain)
 *   - bot     : aleta_bot/services/alamatPihakRapi.js (hanya aturan ekor ganda = "dasar")
 *   - SQL ABT : fungsi isian_rtf_alamat di paket abt-paket/alamat-ganda-26okt (diuji di basis laptop oleh alat/uji_korpus_sql.py atas korpus yang sama)
 */

const require_ = createRequire(import.meta.url);
const { rapikanAlamatPihak, kunciTempat: kunciBot, miripTempat: miripBot } = require_("../../../aleta_bot/services/alamatPihakRapi.js") as {
  rapikanAlamatPihak: (a: string, o?: unknown) => { alamat: string; ekorSistem: boolean };
  kunciTempat: (a: string) => string;
  miripTempat: (a: string, b: string) => boolean;
};

type Kasus = { nama: string; masuk: string; dasar: string; portal?: string };
const korpus = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "alamat-ganda-26okt.json"), "utf8")) as { kasus: Kasus[] };

const AKAR = path.resolve(__dirname, "..", "..", "..");
const PAKET = path.join(AKAR, "abt-paket", "alamat-ganda-26okt");

describe("contoh laporan: putusan 620 (Penggugat ganda, Tergugat tidak)", () => {
  const penggugat =
    "Kelurahan Ganti, Kecamatan Banawa , Kabupaten Donggala, Provinsi Sulawesi Tengah, Ganti, Banawa, Kabupaten Donggala, Sulawesi Tengah";
  const tergugat = "Jalan Anggur 4 Lorong Ps. Harimau D'Concept, Kelurahan Boyaoge, Kecamatan Tatanga, Kota Palu, Provinsi Sulawesi Tengah";

  it("portal: Penggugat bersih, spasi sebelum koma hilang", () => {
    const h = rapikanAlamat(penggugat);
    expect(h.alamat).toBe("Kelurahan Ganti, Kecamatan Banawa, Kabupaten Donggala, Provinsi Sulawesi Tengah");
    expect(h.ekorSistem).toBe(true);
    expect(h.berubah).toBe(true);
    expect(h.perubahan.join(" ")).toMatch(/dobel/);
  });

  it("portal: Tergugat di luar wilayah tidak diubah dan bukan ekor sistem", () => {
    const h = rapikanAlamat(tergugat);
    expect(h.alamat).toBe(tergugat);
    expect(h.berubah).toBe(false);
    expect(h.ekorSistem).toBeUndefined();
  });

  it("bot: hasil sama untuk keduanya", () => {
    expect(rapikanAlamatPihak(penggugat).alamat).toBe("Kelurahan Ganti, Kecamatan Banawa, Kabupaten Donggala, Provinsi Sulawesi Tengah");
    expect(rapikanAlamatPihak(tergugat).alamat).toBe(tergugat);
  });
});

describe("korpus bersama: portal, bot, dan (di laptop) SQL ABT", () => {
  it("korpus tidak kosong dan tiap kasus bernama", () => {
    expect(korpus.kasus.length).toBeGreaterThanOrEqual(25);
    for (const k of korpus.kasus) expect(k.nama.length).toBeGreaterThan(5);
  });

  for (const k of korpus.kasus) {
    it(`bot (dasar): ${k.nama}`, () => {
      expect(rapikanAlamatPihak(k.masuk).alamat).toBe(k.dasar);
    });
    it(`portal: ${k.nama}`, () => {
      expect(rapikanAlamat(k.masuk).alamat).toBe(k.portal ?? k.dasar);
    });
    it(`idempoten (hasil dirapikan lagi tidak berubah): ${k.nama}`, () => {
      expect(rapikanAlamatPihak(k.dasar).alamat).toBe(k.dasar);
      const p = k.portal ?? k.dasar;
      expect(rapikanAlamat(p).alamat).toBe(p);
    });
  }

  it("hasil dasar yang dirapikan portal sama dengan hasil portal (portal = dasar + tambahan)", () => {
    for (const k of korpus.kasus) {
      expect(rapikanAlamat(k.dasar).alamat).toBe(k.portal ?? k.dasar);
    }
  });
});

describe("unsur wilayah: yang belum disebut ditambah, yang sudah disebut tidak diulang", () => {
  it("alamat hanya jalan dan RT dengan ekor sistem: kabupaten, kecamatan, desa, provinsi diberi sebutan", () => {
    expect(rapikanAlamat("Jalan Poros, Tosale, Banawa Selatan, Kabupaten Donggala, Sulawesi Tengah").alamat).toBe(
      "Jalan Poros, Desa Tosale, Kecamatan Banawa Selatan, Kabupaten Donggala, Provinsi Sulawesi Tengah",
    );
  });

  it("Desa atau Kelurahan: kelurahan menurut daftar resmi, selain itu Desa; Kota = Kelurahan", () => {
    expect(rapikanAlamat("RT003, Kabonga Kecil, Banawa, Kabupaten Donggala, Sulawesi Tengah").alamat).toContain("Kelurahan Kabonga Kecil");
    expect(rapikanAlamat("RT003, Tosale, Banawa Selatan, Kabupaten Donggala, Sulawesi Tengah").alamat).toContain("Desa Tosale");
    expect(rapikanAlamat("RT003, Lere, Palu Barat, Kota Palu, Sulawesi Tengah").alamat).toContain("Kelurahan Lere");
  });

  it("pemanggil yang punya kode wilayah boleh memutuskan sendiri jenis desanya", () => {
    const h = rapikanAlamat("RT003, Tosale, Banawa Selatan, Kabupaten Donggala, Sulawesi Tengah", { jenisDesa: () => "Kelurahan" });
    expect(h.alamat).toContain("Kelurahan Tosale");
  });

  it("nama jalan yang sama dengan nama kecamatan bukan sebutan kecamatan", () => {
    const h = rapikanAlamat("Jalan Banawa, Ganti, Banawa, Kabupaten Donggala, Sulawesi Tengah").alamat;
    expect(h).toBe("Jalan Banawa, Kelurahan Ganti, Kecamatan Banawa, Kabupaten Donggala, Provinsi Sulawesi Tengah");
  });

  it("desa dan kecamatan senama tidak dibuang sebagai kembar", () => {
    const h = rapikanAlamat("Jalan Lantigau, Labuan, Kecamatan Labuan, Kabupaten Donggala, Labuan, Labuan, Kabupaten Donggala, Sulawesi Tengah").alamat;
    expect(h).toContain("Kecamatan Labuan");
    expect(h.match(/Labuan/g)?.length).toBeGreaterThanOrEqual(2);
    expect(h).not.toMatch(/Kabupaten Donggala.*Kabupaten Donggala/);
  });

  it("kabupaten yang berbeda dari yang diketik: dibiarkan, kedua nama tetap terlihat", () => {
    const masuk = "Desa Binangga, RT005, Kecamatan Marawola, Kabupaten Donggala, Binangga, Marawola, Kabupaten Sigi, Sulawesi Tengah";
    const h = rapikanAlamat(masuk);
    expect(h.alamat).toContain("Kabupaten Donggala");
    expect(h.alamat).toContain("Kabupaten Sigi");
    expect(h.ekorSistem).toBeUndefined();
  });

  it("surel jangan diberi sebutan wilayah (perbaikan: dulu menjadi 'Provinsi x@y.com')", () => {
    const h = rapikanAlamat("Desa Aa, Kecamatan Bb, Kabupaten Sigi, x.y@mail.com").alamat;
    expect(h).not.toMatch(/Provinsi x\.y@/);
  });

  it("potongan yang bukan nama wilayah tidak diberi sebutan (dulu 'Provinsi Dusun I Desa X')", () => {
    expect(rapikanAlamat("Dusun I Desa Salumpaku").alamat).toBe("Dusun I Desa Salumpaku");
    expect(rapikanAlamat("Dusun I, RT 02, Kecamatan Sigi Biromaru, Kabupaten").alamat).not.toMatch(/Provinsi Kabupaten/);
  });
});

describe("domisili elektronik", () => {
  it("ekor wilayah sistem SESUDAH surel dibuang dan surel dipindah ke ujung", () => {
    const h = rapikanAlamat(
      "Desa Baliase RT 007 RW 003, Kecamatan Marawola, Kabupaten Sigi, Provinsi Sulawesi Tengah. Domisili Elektronik: sel964413@gmail.com, Baliase, Marawola, Kabupaten Sigi, Sulawesi Tengah",
    );
    expect(h.alamat).toBe("Desa Baliase RT 007 RW 003, Kecamatan Marawola, Kabupaten Sigi, Provinsi Sulawesi Tengah. Domisili elektronik : sel964413@gmail.com");
  });

  it("'dengan domisili elektronik' tanpa koma: kata dengan tidak tertinggal di ujung wilayah", () => {
    const h = rapikanAlamat("Desa Kalora, Kecamatan Kinovaro, Kabupaten Sigi, Provinsi Sulawesi Tengah dengan domisili elektronik : a@b.co.id").alamat;
    expect(h).toBe("Desa Kalora, Kecamatan Kinovaro, Kabupaten Sigi, Provinsi Sulawesi Tengah, Domisili elektronik : a@b.co.id");
  });
});

describe("data kelurahan dan kunci nama: portal, bot, dan SQL membaca hal yang sama", () => {
  it("daftar kelurahan Sulawesi Tengah di bot (JSON) = di portal (TS)", () => {
    const j = JSON.parse(readFileSync(path.join(AKAR, "aleta_bot", "kamus-deteksi", "kelurahan-sulteng.json"), "utf8")) as { kelurahan: string[]; kabupaten: string[] };
    expect(new Set(j.kelurahan)).toEqual(new Set(KELURAHAN_SULTENG));
    expect(new Set(j.kabupaten)).toEqual(new Set(KABUPATEN_SULTENG));
    expect(KELURAHAN_SULTENG.size).toBeGreaterThan(150);
    expect(KABUPATEN_SULTENG.size).toBe(13);
  });

  it("kunci dan kemiripan nama tempat sama di portal dan bot", () => {
    const contoh = ["Kotapulu", "Kecamatan Sigi Biromaru", "Kab. Donggala", "Kabupaten/Kota Palu", "Desa  Tulo ", "Kel. Lere", "Provinsi Sulawesi Tengah", "Dongala", "Donggala", "Jalan Banawa"];
    for (const a of contoh) expect(kunciBot(a)).toBe(kunciTempat(a));
    for (const a of contoh) for (const b of contoh) expect(miripBot(kunciTempat(a), kunciTempat(b))).toBe(miripTempat(kunciTempat(a), kunciTempat(b)));
    expect(kunciTempat("Kelurahan Ganti")).toBe(kunciTempat("Desa Ganti"));
    expect(kunciTempat("Kota Palu")).toBe("palu");
    expect(miripTempat("donggala", "dongala")).toBe(true);
    expect(miripTempat("sigi", "donggala")).toBe(false);
  });
});

describe("paket ABT abt-alamat-ganda-26okt: kerangka dan aturan pasang", () => {
  const sql = (nama: string) => readFileSync(path.join(PAKET, "paket-satker", `abt-alamat-ganda-26okt-${nama}.sql`), "latin1");
  const ring = existsSync(path.join(PAKET, "hasil", "isi-paket.json"))
    ? (JSON.parse(readFileSync(path.join(PAKET, "hasil", "isi-paket.json"), "utf8")) as {
        baru: Array<{ no: number }>;
        ubah: Array<{ no: number }>;
        rtf_berkas: number;
        fungsi: string[];
      })
    : null;

  it("paket ada dan MD5SUMS cocok dengan isi berkas (paket tidak basi)", () => {
    expect(ring).not.toBeNull();
    const daftar = readFileSync(path.join(PAKET, "paket-satker", "MD5SUMS.txt"), "utf8").trim().split("\n");
    expect(daftar.length).toBeGreaterThanOrEqual(15);
    for (const baris of daftar) {
      const [md5, nama] = baris.split(/\s{2}/);
      const isi = readFileSync(path.join(PAKET, "paket-satker", nama));
      expect(createHash("md5").update(isi).digest("hex"), nama).toBe(md5);
    }
  });

  it("variabel baru 3517-3519; variabel yang diubah hanya yang memang mencetak alamat pihak; jatah nomor tidak bentrok dengan paket lain", () => {
    expect(ring!.baru.map((x) => x.no)).toEqual([3517, 3518, 3519]);
    expect(ring!.ubah.map((x) => x.no)).toEqual([3943, 3944, 7047, 7048, 7108, 7109, 8700, 8890, 9230, 9231, 9292, 9293, 9349, 9350, 10126]);
    const lain = readdirSync(path.join(AKAR, "abt-paket"))
      .filter((d) => d !== "alamat-ganda-26okt")
      .flatMap((d) => {
        const f = path.join(AKAR, "abt-paket", d, "paket-satker", "nomor-baru.txt");
        return existsSync(f) ? readFileSync(f, "utf8").trim().split(/[,\s]+/).filter(Boolean).map(Number) : [];
      });
    for (const no of [3517, 3518, 3519]) expect(lain).not.toContain(no);
  });

  it("SQL paket: tanpa kata merek ke SIPP/ABT, tanpa fungsi MariaDB 10.x, hanya SELECT/INSERT/UPDATE/DELETE ke abt_variabel", () => {
    for (const nama of ["PRASYARAT", "PASANG", "PERIKSA", "PULIH", "FUNGSI", "FUNGSI-X9-LAMA"]) {
      const isi = sql(nama);
      expect(isi, nama).not.toMatch(/aleta/i);
      expect(isi, nama).not.toMatch(/REGEXP_REPLACE|REGEXP_SUBSTR|JSON_|SEQUENCE|WINDOW\s|OVER\s*\(|CREATE OR REPLACE/i);
    }
    const pasang = sql("PASANG");
    // isi variabel dikirim sebagai literal heksadesimal: terjemahkan dulu, kata merek juga tidak boleh ada di dalamnya
    for (const m of pasang.matchAll(/0x([0-9a-f]{8,})/g)) expect(Buffer.from(m[1], "hex").toString("latin1")).not.toMatch(/aleta/i);
    const tabel = new Set([...pasang.matchAll(/(?:INSERT INTO|UPDATE|DELETE FROM)\s+(\w+)/gi)].map((m) => m[1].toLowerCase()));
    expect([...tabel]).toEqual(["abt_variabel"]);
  });

  it("fungsi paket memakai komentar AG: (dikenali PRASYARAT/PULIH) dan tidak menulis ke tabel SIPP", () => {
    const f = sql("FUNGSI");
    expect(f).toMatch(/COMMENT 'AG:/);
    expect(f).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM)\b/i);
    for (const nama of ring!.fungsi) expect(f).toContain(`CREATE FUNCTION ${nama}(`);
  });

  it("RTF ditambal hanya di folder derry_briantono dan hanya mengganti #0101#, #0105#, #1036# dengan #3517#, #3518#, #3519#", () => {
    const daftar = readFileSync(path.join(PAKET, "paket-satker", "rtf-daftar-tambal.tsv"), "utf8").trim().split("\n");
    expect(daftar.length).toBe(ring!.rtf_berkas);
    const tambal = readFileSync(path.join(PAKET, "paket-satker", "rtf-tambal.tsv"), "utf8").trim().split("\n");
    const pasangan = new Set(
      tambal.map((b) => {
        const k = b.split("\t");
        return `${Buffer.from(k[3], "base64").toString()}>${Buffer.from(k[4], "base64").toString()}`;
      }),
    );
    expect([...pasangan].sort()).toEqual(["#0101#>#3517#", "#0105#>#3518#", "#1036#>#3519#"]);
    const pasang = readFileSync(path.join(PAKET, "paket-satker", "pasang-satker.sh"), "utf8");
    expect(pasang).toContain("derry_briantono");
    expect(pasang).toContain("PRASYARAT");
  });

  it("kueri variabel yang diubah memanggil fungsi alamat pada tiap penanda alamat pihak", () => {
    const p = sql("PASANG");
    expect(p.match(/UPDATE abt_variabel/g)?.length).toBe(15);
    expect(p.match(/INSERT INTO abt_variabel/g)?.length).toBe(3);
  });
});
