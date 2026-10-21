import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BLANGKO_RELAAS } from "@/lib/pohon-blangko";

/**
 * 21 Okt 2026 - kode pos di ujung alamat penerima pada AMPLOP RELAAS.
 *
 * Amplop dicetak ABT dari blangko RTF Derry, jadi yang tampil di kertas adalah kueri variabel ABT
 * (paket abt-paket/x5-kodepos-amplop-21okt). Aturan yang sama ditulis terbaca-uji di
 * aleta_bot/services/kodePosWilayahService.js. Uji ini:
 *   - menegakkan aturan "hanya bila pasti, tidak pernah menebak" pada pembaca JS;
 *   - menjaga paket: setiap blangko amplop yang dikenal ALETA tersambung ke variabel kode pos
 *     (8.x.1 -> 9292 alamat Penggugat/Pemohon, 8.x.2 -> 9293 alamat Tergugat/Termohon; amplop surat
 *     tercatat memakai 8172), nomor baru tidak bentrok, tanpa tanda ALETA di ABT, hanya SELECT.
 */

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const K: any = muat(path.join(AKAR, "aleta_bot/services/kodePosWilayahService.js"));
const PAKET = path.join(AKAR, "abt-paket/x5-kodepos-amplop-21okt");
const baca = (...bagian: string[]) => readFileSync(path.join(PAKET, ...bagian), "utf8");

const KP = [
  { province: "Sulawesi Tengah", district: "Donggala", subdistrict: "Banawa", area: "Boneoge", post_code: "94351" },
  { province: "Sulawesi Tengah", district: "Donggala", subdistrict: "Banawa", area: "Ganti", post_code: "94351" },
  { province: "Sulawesi Tengah", district: "Donggala", subdistrict: "Sirenja", area: "Jonooge", post_code: "94357" },
  { province: "Sulawesi Tengah", district: "Donggala", subdistrict: "Sirenja", area: "Lompio", post_code: "94357" },
  { province: "Sulawesi Tengah", district: "Donggala", subdistrict: "Labuan", area: "Labuan Induk", post_code: "94352" },
  { province: "Sulawesi Tengah", district: "Donggala", subdistrict: "Labuan", area: "Lero", post_code: "94352" },
  { province: "Sulawesi Tengah", district: "Sigi", subdistrict: "Sigi Biromaru", area: "Kalukubula", post_code: "94364" },
  { province: "Sulawesi Tengah", district: "Sigi", subdistrict: "Sigi Biromaru", area: "Bora", post_code: "94364" },
  { province: "Sulawesi Tengah", district: "Sigi", subdistrict: "Marawola", area: "Baliase", post_code: "94363" },
  { province: "Sulawesi Tengah", district: "Sigi", subdistrict: "Marawola", area: "Sibalaya", post_code: "94362" },
  { province: "Sulawesi Tengah", district: "Sigi", subdistrict: "Marawola", area: "Sibalaya Utara", post_code: "94362" },
  { province: "Sulawesi Tengah", district: "Sigi", subdistrict: "Dolo", area: "Bulubete", post_code: "94361" },
  { province: "Sulawesi Tengah", district: "Sigi", subdistrict: "Dolo", area: "Kota Pulu", post_code: "94360" },
  { province: "Sulawesi Tengah", district: "Palu", subdistrict: "Palu Barat", area: "Lere", post_code: "94221" },
  { province: "Sulawesi Tengah", district: "Palu", subdistrict: "Palu Barat", area: "Baru", post_code: "94227" },
  { province: "Sulawesi Tengah", district: "Boalemo", subdistrict: "Bualemo (Boalemo)", area: "Malik", post_code: "94751" },
  { province: "Sulawesi Selatan", district: "Makassar", subdistrict: "Tamalate", area: "Mangasa", post_code: "90224" },
  { province: "Sulawesi Barat", district: "Donggala", subdistrict: "Banawa", area: "Boneoge", post_code: "91999" },
];
const w = (provinsi: string, kabupaten: string, kecamatan: string, kelurahan: string) => ({ provinsi, kabupaten, kecamatan, kelurahan });

describe("kode pos alamat pihak - aturan pembaca (JS)", () => {
  it("normalisasi nama: huruf besar-kecil, spasi, tanda hubung, titik, teks dalam kurung, awalan Kabupaten/Kota", () => {
    expect(K.normalNama("Sigi  Biromaru")).toBe("sigibiromaru");
    expect(K.normalNama("Pare-Pare")).toBe("parepare");
    expect(K.normalNama("Bualemo (Boalemo)")).toBe("bualemo");
    expect(K.normalKabupaten("Kabupaten Sigi")).toBe("sigi");
    expect(K.normalKabupaten("Kota Palu")).toBe("palu");
    expect(K.normalKabupaten("Palu")).toBe("palu");
  });

  it("desa cocok dan satu kode pos -> dipakai (tingkat desa), ejaan/huruf besar tidak dibedakan", () => {
    expect(K.pilihKodePos(KP, w("Sulawesi Tengah", "Kabupaten Donggala", "Banawa", "Boneoge"))).toEqual({ kodePos: "94351", tingkat: "desa", sebab: "" });
    expect(K.pilihKodePos(KP, w("SULAWESI TENGAH", "KABUPATEN SIGI", "SIGI BIROMARU", "KALUKUBULA")).kodePos).toBe("94364");
    expect(K.pilihKodePos(KP, w("Sulawesi Tengah", "Kota Palu", "Palu Barat", "Lere")).kodePos).toBe("94221");
  });

  it("desa bernama sama di provinsi lain tidak tertukar (provinsi dan kabupaten ikut dicocokkan)", () => {
    expect(K.pilihKodePos(KP, w("Sulawesi Tengah", "Kabupaten Donggala", "Banawa", "Boneoge")).kodePos).toBe("94351");
    expect(K.pilihKodePos(KP, w("Sulawesi Barat", "Kabupaten Donggala", "Banawa", "Boneoge")).kodePos).toBe("91999");
    expect(K.pilihKodePos(KP, w("Sulawesi Selatan", "Kota Makassar", "Tamalate", "Mangasa")).kodePos).toBe("90224");
  });

  it("teks dalam kurung pada nama kecamatan di kode_pos diabaikan (Bualemo (Boalemo))", () => {
    expect(K.pilihKodePos(KP, w("Sulawesi Tengah", "Kabupaten Boalemo", "Bualemo", "Malik")).kodePos).toBe("94751");
  });

  it("desa tidak ada di kode_pos tetapi kecamatan hanya punya SATU kode pos -> tingkat kecamatan", () => {
    const h = K.pilihKodePos(KP, w("Sulawesi Tengah", "Kabupaten Donggala", "Sirenja", "Desa Pemekaran Baru"));
    expect(h).toEqual({ kodePos: "94357", tingkat: "kecamatan", sebab: "" });
  });

  it("desa tidak cocok dan kecamatan punya BEBERAPA kode pos -> kosong, tidak menebak", () => {
    const h = K.pilihKodePos(KP, w("Sulawesi Tengah", "Kabupaten Sigi", "Marawola", "Desa Tak Dikenal"));
    expect(h.kodePos).toBeNull();
    expect(h.sebab).toBe("desa-tidak-cocok-dan-kecamatan-beberapa-kode-pos");
    // kecamatan Dolo juga beberapa kode (94361/94360)
    expect(K.pilihKodePos(KP, w("Sulawesi Tengah", "Kabupaten Sigi", "Dolo", "Lain")).kodePos).toBeNull();
  });

  it("desa cocok tetapi punya lebih dari satu kode pos -> kosong", () => {
    const ganda = [
      ...KP,
      { province: "Sulawesi Tengah", district: "Sigi", subdistrict: "Gumbasa", area: "Tuva", post_code: "94365" },
      { province: "Sulawesi Tengah", district: "Sigi", subdistrict: "Gumbasa", area: "Tuva", post_code: "94366" },
    ];
    const h = K.pilihKodePos(ganda, w("Sulawesi Tengah", "Kabupaten Sigi", "Gumbasa", "Tuva"));
    expect(h.kodePos).toBeNull();
    expect(h.sebab).toBe("desa-punya-beberapa-kode-pos");
  });

  it("kecamatan/kabupaten tidak ada di kode_pos atau wilayah tidak lengkap -> kosong dengan sebab", () => {
    expect(K.pilihKodePos(KP, w("Sulawesi Tengah", "Kabupaten Donggala", "Kecamatan Fiktif", "X")).sebab).toBe("kecamatan-tidak-ada-di-kode-pos");
    expect(K.pilihKodePos(KP, w("", "Kabupaten Donggala", "Banawa", "Boneoge")).sebab).toBe("wilayah-tidak-lengkap");
    expect(K.pilihKodePos([], w("Sulawesi Tengah", "Kabupaten Donggala", "Banawa", "Boneoge")).kodePos).toBeNull();
    expect(K.pilihKodePos(null, null).kodePos).toBeNull();
  });
});

describe("alamat dengan kode pos di ujung", () => {
  it("menambahkan ', Kode Pos NNNNN' di ujung alamat", () => {
    expect(K.alamatDenganKodePos("Jalan Guru Tua, Desa Kalukubula, Kecamatan Sigi Biromaru, Kabupaten Sigi, Provinsi Sulawesi Tengah", "94364")).toBe(
      "Jalan Guru Tua, Desa Kalukubula, Kecamatan Sigi Biromaru, Kabupaten Sigi, Provinsi Sulawesi Tengah, Kode Pos 94364"
    );
  });
  it("membuang koma/titik/spasi di ujung alamat SIPP sebelum menambahkan", () => {
    expect(K.alamatDenganKodePos("Kel. Pengawu, Kota Palu, , , , ", "94221")).toBe("Kel. Pengawu, Kota Palu, Kode Pos 94221");
    expect(K.alamatDenganKodePos("Desa Wani, Kabupaten Donggala, Provinsi Sulawesi Tengah.", "94353")).toBe(
      "Desa Wani, Kabupaten Donggala, Provinsi Sulawesi Tengah, Kode Pos 94353"
    );
  });
  it("kode pos disisipkan SEBELUM bagian surel/domisili elektronik, bukan sesudah surel", () => {
    expect(K.alamatDenganKodePos("Desa X, Kabupaten Donggala, Provinsi Sulawesi Tengah. Domisili elektronik : a@gmail.com", "94356")).toBe(
      "Desa X, Kabupaten Donggala, Provinsi Sulawesi Tengah, Kode Pos 94356. Domisili elektronik : a@gmail.com"
    );
    expect(K.alamatDenganKodePos("Desa X, Provinsi Sulawesi Tengah, earlya@gmail.com", "94352")).toBe(
      "Desa X, Provinsi Sulawesi Tengah, Kode Pos 94352. earlya@gmail.com"
    );
    expect(K.alamatDenganKodePos("Desa X, Provinsi Sulawesi Tengah. Elektronik: b@gmail.com", "94352")).toBe(
      "Desa X, Provinsi Sulawesi Tengah, Kode Pos 94352. Elektronik: b@gmail.com"
    );
  });
  it("tanpa kode pos pasti alamat tidak diubah sama sekali", () => {
    const a = "Jalan Mawar, Kabupaten Donggala, ";
    expect(K.alamatDenganKodePos(a, null)).toBe(a.trim());
    expect(K.alamatDenganKodePos(a, "")).toBe(a.trim());
    expect(K.alamatDenganKodePos(a, "943")).toBe(a.trim());
    expect(K.alamatDenganKodePos(a, "ABCDE")).toBe(a.trim());
  });
  it("alamat yang sudah memuat kode itu atau tulisan 'kode pos' tidak digandakan", () => {
    expect(K.alamatDenganKodePos("Jalan A, Palu 94221", "94221")).toBe("Jalan A, Palu 94221");
    expect(K.alamatDenganKodePos("Jalan A, Palu, Kode Pos 94222", "94221")).toBe("Jalan A, Palu, Kode Pos 94222");
  });
});

describe("kodePosUntukWilayah - baca SIPP dengan tembolok, tidak pernah melempar", () => {
  const wilayahBanawa = [{ provinsi: "Sulawesi Tengah", kabupaten: "Kabupaten Donggala", kecamatan: "Banawa", kelurahan: "Boneoge" }];
  it("memakai kueri wilayah lalu kode_pos, dan menembolok hasilnya", async () => {
    K.kosongkanTembolok();
    let panggilan = 0;
    const kueri = async (sql: string) => {
      panggilan += 1;
      return /FROM ref_kelurahan_new/.test(sql) ? wilayahBanawa : KP.filter((b) => b.subdistrict.startsWith("Ba"));
    };
    const a = await K.kodePosUntukWilayah({ kodeKelurahan: "72.03.08.1020" }, { kueri });
    expect(a).toEqual({ kodePos: "94351", tingkat: "desa", sebab: "" });
    expect(panggilan).toBe(2);
    const b = await K.kodePosUntukWilayah({ kodeKelurahan: "72.03.08.1020" }, { kueri });
    expect(b.kodePos).toBe("94351");
    expect(panggilan).toBe(2);
  });
  it("kode wilayah tidak dikenal / kosong / DB galat -> kosong dengan sebab, tidak ditembolok bila galat", async () => {
    K.kosongkanTembolok();
    expect((await K.kodePosUntukWilayah({}, { kueri: async () => [] })).sebab).toBe("wilayah-kosong");
    expect((await K.kodePosUntukWilayah({ kodeKelurahan: "99.99.99.9999" }, { kueri: async () => [] })).sebab).toBe("kode-wilayah-tidak-dikenal");
    let n = 0;
    const galat = async () => {
      n += 1;
      throw new Error("ECONNREFUSED");
    };
    expect((await K.kodePosUntukWilayah({ kodeKelurahan: "72.03.08.1020" }, { kueri: galat })).sebab).toMatch(/^baca-gagal/);
    await K.kodePosUntukWilayah({ kodeKelurahan: "72.03.08.1020" }, { kueri: galat });
    expect(n).toBe(2);
  });
});

describe("paket ABT x5-kodepos-amplop-21okt", () => {
  const ada = existsSync(path.join(PAKET, "paket-satker"));
  const pasang = ada ? baca("paket-satker/abt-x5-kodepos-amplop-21okt-PASANG.sql") : "";
  const ringkas = ada ? JSON.parse(baca("hasil/isi-paket.json")) : null;
  const sunting = ada
    ? baca("paket-satker/daftar-sunting.tsv")
        .split("\n")
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => l.split("\t"))
    : [];

  it("paket ada", () => {
    expect(ada).toBe(true);
  });

  it("variabel baru 9290-9293 (di luar x1-x4) dan satu baris diubah: 8172", () => {
    expect(baca("paket-satker/nomor-baru.txt").trim()).toBe("9290,9291,9292,9293");
    expect(baca("paket-satker/nomor-ubah.txt").trim()).toBe("8172");
    expect(ringkas.harap).toBe("0|0|1|0|0|0");
    expect(ringkas.ulang).toBe("0|4|0|1|0|0");
  });

  it("hanya abt_variabel yang disentuh; satu transaksi; modifier admin; ASCII; tanpa tanda ALETA", () => {
    expect(pasang).toMatch(/START TRANSACTION;[\s\S]*COMMIT;/);
    const tabel = new Set(Array.from(pasang.matchAll(/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+(\w+)/g)).map((m) => m[1]));
    expect(Array.from(tabel)).toEqual(["abt_variabel"]);
    // eslint-disable-next-line no-control-regex
    expect(/[^\x00-\x7f]/.test(pasang)).toBe(false);
    for (const b of ringkas.baru) {
      expect(b.sql).not.toMatch(/aleta/i);
      expect(b.nama).not.toMatch(/aleta/i);
      expect(b.sql).not.toMatch(/\b(insert|update|delete|drop|alter|truncate|create|replace into)\b/i);
      expect(b.sql).toMatch(/^SELECT /);
    }
    expect(pasang).toMatch(/'admin'/);
    expect(pasang).not.toMatch(/aleta/i);
  });

  it("9290/9291 memakai kode wilayah pihak urutan 1 -> ref_*_new -> kode_pos; 9291 melewati pihak ghaib dan alamat 'tidak diketahui'", () => {
    const [k1, k2, a1, a2] = ringkas.baru;
    expect(k1.no).toBe(9290);
    expect(k2.no).toBe(9291);
    for (const k of [k1, k2]) {
      expect(k.sql).toMatch(/FROM kode_pos k/);
      expect(k.sql).toMatch(/ref_kelurahan_new/);
      expect(k.sql).toMatch(/COLLATE utf8mb4_general_ci/); // kode_pos utf8mb4_unicode_ci, ref_* general_ci: tanpa ini error 1267
      expect(k.sql).toMatch(/GROUP_CONCAT\(DISTINCT k\.post_code/);
      expect(k.sql).toMatch(/LOCATE\(',', v\.ga\) = 0/); // beberapa kode -> bukan jawaban
      expect(k.sql).toMatch(/tidak diketahui/);
    }
    expect(k1.sql).toMatch(/FROM perkara_pihak1 p/);
    expect(k2.sql).toMatch(/FROM perkara_pihak2 p/);
    expect(k2.sql).toMatch(/p\.ghaib = 0/);
    expect(a1.no).toBe(9292);
    expect(a2.no).toBe(9293);
    expect(a1.sql).toMatch(/#9290#/);
    expect(a2.sql).toMatch(/#9291#/);
    expect(a1.sql).toMatch(/FROM perkara_pihak1 p/);
    expect(a2.sql).toMatch(/FROM perkara_pihak2 p/);
    expect(a1.sql).toMatch(/REGEXP '\^\[0-9\]\{5\}\$'/); // hanya lima angka yang dipasang
    expect(a1.sql).toMatch(/Kode Pos /);
  });

  it("setiap amplop 8.x yang dikenal pohon-blangko tersambung: sisi P -> #9292#, sisi T -> #9293# (6 berkas, satu penanda tiap berkas)", () => {
    const amplop8 = BLANGKO_RELAAS.filter((b) => /^amplop-(panggilan|putusan|ikrar)$/.test(b.keadaan));
    expect(amplop8.length).toBe(6);
    expect(sunting.length).toBe(6);
    for (const b of amplop8) {
      const baris = sunting.find((s) => s[1] === b.berkas);
      expect(baris, b.berkas).toBeTruthy();
      expect(baris![0]).toBe("derry_briantono/98 Relaas");
      expect(baris![6]).toBe("1");
      if (b.pihak === "pertama") expect([baris![4], baris![5]]).toEqual(["#0101#", "#9292#"]);
      else expect([baris![4], baris![5]]).toEqual(["#0105#", "#9293#"]);
      expect(baris![2]).toMatch(/^[0-9a-f]{32}$/);
      expect(baris![3]).toMatch(/^[0-9a-f]{32}$/);
      expect(baris![2]).not.toBe(baris![3]);
    }
  });

  it("amplop surat tercatat (#0105#, #8172#) tidak disunting - variabel 8172 yang diperbaiki; blangko SIPP tidak disentuh", () => {
    expect(sunting.some((s) => /SURAT TERCATAT/i.test(s[1]))).toBe(false);
    const ubah = ringkas.ubah.find((u: { no: number }) => u.no === 8172);
    expect(ubah).toBeTruthy();
    expect(pasang).toMatch(/UPDATE abt_variabel SET sql_query=/);
    expect(pasang.match(/UPDATE abt_variabel/g)?.length).toBe(1);
  });

  it("skrip pasang: md5 -> prasyarat -> cadangan -> SQL -> uji -> sunting berkas; gagal = pulih; pulih mengembalikan berkas dulu", () => {
    const sh = baca("paket-satker/pasang-satker.sh");
    const urutan = ["md5sum -c MD5SUMS.txt", "-PRASYARAT.sql", "mysqldump", "-PASANG.sql", "-PERIKSA.sql", "uji-kueri.tsv", "berkas_rtf.py pasang", "berkas_rtf.py periksa"].map((k) => sh.indexOf(k));
    expect(urutan.every((i) => i >= 0)).toBe(true);
    expect([...urutan]).toEqual([...urutan].sort((a, b) => a - b));
    expect(sh).toMatch(/pulih-satker\.sh/);
    const pulih = baca("paket-satker/pulih-satker.sh");
    expect(pulih.indexOf("berkas_rtf.py pulih")).toBeLessThan(pulih.indexOf("-PULIH.sql"));
    expect(sh).not.toMatch(/\r/);
    expect(pulih).not.toMatch(/\r/);
  });

  it("penyunting berkas: md5 lama dijaga, jumlah penanda dijaga, cadangan asal, pulih bersyarat", () => {
    const py = baca("paket-satker/berkas_rtf.py");
    expect(py).toMatch(/isi\.count\(dari_b\) != jumlah/);
    expect(py).toMatch(/md5b\(baru\) != mb/);
    expect(py).toMatch(/sunting-asal/);
    expect(py).toMatch(/os\.chown/); // pemilik/izin berkas asli (apache:apache 750) dipertahankan
    expect(py).toMatch(/disunting orang sesudah dipasang/);
  });
});
