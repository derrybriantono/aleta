// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { beforeAll, describe, expect, it, vi } from "vitest";

import katalog from "@/lib/bukti-katalog.json";
import {
  bandingBaris,
  berkasUntukBukti,
  buktiDariAlinea,
  jenisBuktiDari,
  kalimatBaris,
  KATALOG_BUKTI,
  KATALOG_ELEKTRONIK,
  kolomBukti,
  samarkanNik,
  sidikNik,
  uraiKalimatBukti,
  type DataSipp,
} from "@/lib/bukti-tertulis";

const AKAR = path.resolve(__dirname, "../../..");
const EKS = path.join(AKAR, "ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKS, b), "utf8");

type ApiEks = {
  jenisBuktiDari: (n: string) => string;
  kolomBukti: (n: string) => unknown;
  sidikNik: (n: string) => string;
  bandingBaris: (r: unknown, s: string, u: number, d: unknown) => unknown;
  berkasUntukBukti: (n: string, d: unknown) => unknown;
  htmlKatalogSurat: (e: (s: string) => string) => string;
  htmlKatalogElektronik: (e: (s: string) => string) => string;
  bukaLengkap: (induk: HTMLElement, o: unknown) => { tutup: () => void };
};
let eks: ApiEks;
beforeAll(() => {
  const w = window as unknown as Record<string, unknown>;
  vm.runInThisContext(`(function(globalThis){${baca("bukti-katalog.js")}\n})`)(w);
  vm.runInThisContext(`(function(globalThis){${baca("bukti-tertulis.js").replace("typeof globalThis !== \"undefined\" ? globalThis : typeof window !== \"undefined\" ? window : null", "globalThis")}\n})`)(w);
  eks = w.AletaBuktiTertulis as ApiEks;
});

const SIPP: DataSipp = {
  P: [{ nama: "Siti Contoh binti Ahmad", nikSamar: samarkanNik("7203010101900001"), nikSidik: sidikNik("7203010101900001") }],
  T: [{ nama: "Budi Contoh", nikSamar: samarkanNik("7203010101850002"), nikSidik: sidikNik("7203010101850002") }],
  nikah: { nomor: "245/012/VI/2019", tglKutipan: "2019-06-18", kua: "KUA Kecamatan Banawa", tglNikah: "2019-06-15" },
};

describe("katalog alat bukti", () => {
  it("bukti surat dan elektronik masing-masing 50 sampai 110 jenis, kunci unik, pola sah", () => {
    expect(KATALOG_BUKTI.length).toBeGreaterThanOrEqual(50);
    expect(KATALOG_BUKTI.length).toBeLessThanOrEqual(110);
    expect(KATALOG_ELEKTRONIK.length).toBeGreaterThanOrEqual(50);
    expect(KATALOG_ELEKTRONIK.length).toBeLessThanOrEqual(100);
    const kunci = [...katalog.surat, ...katalog.elektronik].map((x) => x.k);
    expect(new Set(kunci).size).toBe(kunci.length);
  });

  it("perkara utama yang diminta punya jenis di katalog", () => {
    const utama = KATALOG_BUKTI.map((x) => x.utama).join(" ");
    for (const j of ["Cerai", "Itsbat", "Dispensasi kawin", "Kewarisan", "Harta bersama", "Wakaf", "Ekonomi syariah"]) expect(utama).toContain(j);
  });

  it("berkas ekstensi tersusun dari sumber yang sama", () => {
    const w = window as unknown as { ALETA_BUKTI_KATALOG: unknown };
    expect(w.ALETA_BUKTI_KATALOG).toEqual(katalog);
  });

  it("nama resmi tiap jenis dikenali sebagai jenisnya sendiri, kecuali yang memang umum", () => {
    const salah = KATALOG_BUKTI.filter((x) => jenisBuktiDari(`Fotokopi ${x.nama}`) !== x.kunci).map((x) => `${x.nama} -> ${jenisBuktiDari(`Fotokopi ${x.nama}`)}`);
    expect(salah).toEqual([]);
  });

  it("bentuk bukti elektronik di katalog ada di pilihan form, dan tidak ada nama orang di katalog", () => {
    const isian = baca("blangko-derry-isian.js");
    for (const x of KATALOG_ELEKTRONIK) expect(isian, x.bentuk).toContain(`["${x.bentuk}"`);
    expect(JSON.stringify(katalog)).not.toMatch(/aleta/i);
  });

  it.each([
    ["Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama X", "ktp"],
    ["Fotokopi Duplikat Kutipan Akta Nikah", "duplikat"],
    ["Fotokopi Buku Nikah", "nikah"],
    ["Fotokopi Sertifikat Hak Guna Bangunan", "hgb"],
    ["Fotokopi Sertifikat Hak Tanggungan", "ht"],
    ["Fotokopi Sertifikat Hak Milik", "shm"],
    ["Fotokopi Akta Kematian", "aktamati"],
    ["Fotokopi Surat Keterangan Kematian", "mati"],
    ["Surat Keterangan Domisili", "domisili"],
    ["Fotokopi Surat Keterangan apa saja", "keterangan"],
    ["Fotokopi Daftar Gaji Pemohon", "gaji"],
    ["Foto kebun", ""],
  ])("%s -> %s", (nama, kunci) => {
    expect(jenisBuktiDari(nama)).toBe(kunci);
    expect(eks.jenisBuktiDari(nama)).toBe(kunci);
  });
});

describe("kolom dan pembanding SIPP", () => {
  it("kolom mengikuti jenis, dan kata kerja lama tetap untuk KTP dan KK", () => {
    expect(kolomBukti("Fotokopi Kartu Tanda Penduduk")).toMatchObject({ no: "NIK", contohNo: "16 angka NIK", tgl: "Tanggal KTP dikeluarkan" });
    expect(kolomBukti("Fotokopi Kartu Keluarga")).toMatchObject({ no: "Nomor KK", contohNo: "nomor Kartu Keluarga" });
    expect(kolomBukti("Fotokopi Kutipan Akta Nikah")).toMatchObject({ no: "Nomor kutipan", tgl: "Tanggal kutipan" });
    expect(kolomBukti("Bukti apa saja")).toMatchObject({ an: "Atas nama", no: "Nomor surat", tgl: "Tanggal" });
    for (const n of ["Fotokopi Kartu Tanda Penduduk", "Fotokopi Kutipan Akta Kelahiran", "Fotokopi BPKB"]) expect(eks.kolomBukti(n)).toEqual(kolomBukti(n));
  });

  it("KTP: nama dengan binti dianggap sama, NIK dibandingkan lewat sidik dan tidak dapat ditimpa", () => {
    const r = { nm: "Fotokopi Kartu Tanda Penduduk", an: "Siti Contoh", no: "7203010101900001" };
    const h = bandingBaris(r, "P", 0, SIPP);
    expect(h.an.keadaan).toBe("sama");
    expect(h.no.keadaan).toBe("sama");
    const h2 = bandingBaris({ ...r, no: "7203010101900009", an: "Orang Lain" }, "P", 0, SIPP);
    expect(h2.no).toEqual({ keadaan: "beda", sipp: "7203 •••• •••• 0001", pakai: null });
    expect(h2.an).toMatchObject({ keadaan: "beda", pakai: "Siti Contoh binti Ahmad" });
  });

  it("Akta Nikah: nomor beda ditandai dan boleh memakai data SIPP; Kantor Urusan Agama sama dengan KUA; kolom kosong tidak ditandai", () => {
    const h = bandingBaris({ nm: "Fotokopi Kutipan Akta Nikah", no: "0245/012/VI/2019", tgl: "2019-06-18", oleh: "Kantor Urusan Agama Kecamatan Banawa" }, "P", 0, SIPP);
    expect(h.no).toEqual({ keadaan: "beda", sipp: "245/012/VI/2019", pakai: "245/012/VI/2019" });
    expect(h.tgl.keadaan).toBe("sama");
    expect(h.oleh.keadaan).toBe("sama");
    expect(bandingBaris({ nm: "Fotokopi Kutipan Akta Nikah", no: "" }, "P", 0, SIPP)).toEqual({});
  });

  it("duplikat tidak diadu tanggalnya, jenis lain dan kalimat manual tidak diadu, tanpa data tidak ada tanda", () => {
    expect(bandingBaris({ nm: "Fotokopi Duplikat Kutipan Akta Nikah", tgl: "2024-01-01" }, "P", 0, SIPP).tgl).toBeUndefined();
    expect(bandingBaris({ nm: "Fotokopi Kartu Keluarga", no: "1" }, "P", 0, SIPP)).toEqual({});
    expect(bandingBaris({ nm: "Fotokopi Kartu Tanda Penduduk", an: "X", manual: "bebas" }, "P", 0, SIPP)).toEqual({});
    expect(bandingBaris({ nm: "Fotokopi Kutipan Akta Nikah", no: "1" }, "P", 0, null)).toEqual({});
  });

  it("panel dan portal memberi hasil sama", () => {
    for (const r of [
      { nm: "Fotokopi Kartu Tanda Penduduk", an: "Budi Contoh", no: "7203010101850002" },
      { nm: "Fotokopi Kutipan Akta Nikah", no: "9", tgl: "2019-06-18", oleh: "KUA Lain" },
    ]) {
      expect(eks.bandingBaris(r, "T", 0, SIPP)).toEqual(bandingBaris(r, "T", 0, SIPP));
    }
    expect(eks.sidikNik("7203 0101 0190 0001")).toBe(sidikNik("7203010101900001"));
  });

  it("samaran NIK tidak memuat angka tengah", () => {
    expect(samarkanNik("7203010101900001")).toBe("7203 •••• •••• 0001");
    expect(samarkanNik("")).toBe("");
  });
});

describe("berkas pindaian", () => {
  const dokumen = [
    { judul: "Gugatan", documentKey: "a" },
    { judul: "Dokumen Bukti", documentKey: "b" },
    { judul: "KTP Penggugat", documentKey: "c" },
  ];
  it("judul yang cocok lebih dulu, lalu berkas gabungan bukti, selain itu tidak ada", () => {
    expect(berkasUntukBukti("Fotokopi Kartu Tanda Penduduk", dokumen)?.documentKey).toBe("c");
    expect(berkasUntukBukti("Fotokopi Kutipan Akta Nikah", dokumen)?.documentKey).toBe("b");
    expect(berkasUntukBukti("Fotokopi Kutipan Akta Nikah", [dokumen[0]])).toBeNull();
    expect(eks.berkasUntukBukti("Fotokopi Kartu Tanda Penduduk", dokumen)).toEqual(dokumen[2]);
  });
  it("tampil di halaman hanya atas permintaan: perilaku unduh lama tetap", () => {
    const r = readFileSync(path.join(AKAR, "manajemen_surat/src/app/api/aleta-ecourt/berkas/route.ts"), "utf8");
    expect(r).toContain('searchParams.get("tampil") === "1"');
    expect(r).toContain('respons.headers.get("content-disposition") || "attachment"');
  });
});

describe("kalimat dan pembacaan dari naskah", () => {
  const K = "Fotokopi Kutipan Akta Nikah, Nomor 245/012/VI/2019 tanggal 18 Juni 2019, yang dikeluarkan oleh KUA Kecamatan Banawa, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.2 serta diberi tanggal dan paraf oleh Ketua Majelis;";

  it("kalimat baku terurai lalu tersusun kembali persis", () => {
    const r = uraiKalimatBukti(K);
    expect(r).toMatchObject({ nm: "Fotokopi Kutipan Akta Nikah", no: "245/012/VI/2019", tgl: "2019-06-18", oleh: "KUA Kecamatan Banawa", meterai: 0, cocok: 0 });
    expect(kalimatBaris(r, "P", 1)).toBe(K);
  });

  it("bunyi tidak dapat dicocokkan sama dengan form lama", () => {
    const r = { ...uraiKalimatBukti(K), cocok: 1 };
    expect(kalimatBaris(r, "P", 1)).toContain("di-nazegelen, serta tidak dapat dicocokkan dengan aslinya, lalu diberi tanda P.2");
    expect(uraiKalimatBukti(kalimatBaris(r, "P", 1)).cocok).toBe(1);
  });

  it("bukti dibaca dari alinea naskah; bukti elektronik dan alinea lain dilewati", () => {
    const h = buktiDariAlinea([
      { teks: "Menimbang, bahwa Penggugat mengajukan bukti." },
      { teks: K },
      { teks: "Print Out, bukti elektronik tersebut tidak dapat dicocokkan, lalu diberi tanda P.3 serta diberi tanggal dan paraf oleh Ketua Majelis;" },
      { teks: K },
    ]);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ sisi: "P", nomor: 2 });
  });

  it("kalimat bebas tetap apa adanya", () => {
    const r = uraiKalimatBukti("Foto kebun milik bersama");
    expect(r.manual).toBe("Foto kebun milik bersama");
    expect(kalimatBaris(r, "P", 0)).toBe("Foto kebun milik bersama");
  });
});

describe("tampilan lengkap pop-up di Blangko Derry", () => {
  const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
  function buka(rows: Array<Record<string, unknown>>) {
    const induk = document.createElement("div");
    document.body.appendChild(induk);
    const ubah = vi.fn((i: number, k: string, v: unknown) => {
      rows[i][k] = v;
    });
    const saatTutup = vi.fn();
    eks.bukaLengkap(induk, {
      judul: "Alat bukti Penggugat",
      nomor: "123/Pdt.G/2026/PA.Dgl",
      sisi: "P",
      baris: () => rows,
      banding: (i: number) => bandingBaris(rows[i] as never, "P", 0, SIPP),
      berkas: () => null,
      kalimat: (i: number) => kalimatBaris(rows[i] as never, "P", i),
      ubah,
      esc,
      saatTutup,
    });
    return { induk, ubah, saatTutup };
  }

  it("menyunting baris yang sama, kalimat ikut berubah, Pakai data SIPP mengisi, tombol keluar menutup", () => {
    const rows = [
      { nm: "Fotokopi Kartu Tanda Penduduk", an: "Siti Contoh", no: "7203010101900001", tgl: "", oleh: "", meterai: 0, cocok: 0 },
      { nm: "Fotokopi Kutipan Akta Nikah", an: "", no: "0245/012/VI/2019", tgl: "2019-06-18", oleh: "KUA Kecamatan Banawa", meterai: 0, cocok: 0 },
    ];
    const { induk, ubah, saatTutup } = buka(rows);
    expect(induk.querySelectorAll(".bd-blk-pilih")).toHaveLength(2);
    expect(induk.textContent).toContain("Akta otentik");
    (induk.querySelectorAll(".bd-blk-pilih")[1] as HTMLElement).click();
    expect(induk.textContent).toContain("Di SIPP tertulis 245/012/VI/2019");
    (induk.querySelector("[data-bl=pakai]") as HTMLElement).click();
    expect(rows[1].no).toBe("245/012/VI/2019");
    expect(induk.textContent).toContain("Sama dengan SIPP");

    const cocok = induk.querySelector("select[data-kolom=cocok]") as HTMLSelectElement;
    expect(cocok.options[1].textContent).toBe("tidak dapat dicocokkan dengan aslinya");
    cocok.value = "1";
    cocok.dispatchEvent(new Event("change", { bubbles: true }));
    expect(ubah).toHaveBeenCalledWith(1, "cocok", 1);
    expect(induk.querySelector("[data-bl-bunyi]")?.textContent).toContain("serta tidak dapat dicocokkan dengan aslinya");

    const no = induk.querySelector("input[data-kolom=no]") as HTMLInputElement;
    no.value = "1/2/3";
    no.dispatchEvent(new Event("input", { bubbles: true }));
    expect(rows[1].no).toBe("1/2/3");
    expect(document.activeElement === no || induk.contains(no)).toBe(true);

    (induk.querySelector("[data-bl=tutup]") as HTMLElement).click();
    expect(induk.querySelector(".bd-blk-tirai")).toBeNull();
    expect(saatTutup).toHaveBeenCalledTimes(1);
  });

  it("tanda selesai tersimpan pada baris dan nama berbahaya tidak menjadi markup", () => {
    const rows = [{ nm: '<img src=x onerror="1">', an: "", no: "", tgl: "", oleh: "", meterai: 0, cocok: 0 }];
    const { induk } = buka(rows);
    expect(induk.querySelector("img")).toBeNull();
    (induk.querySelector("[data-bl=periksa]") as HTMLElement).click();
    expect((rows[0] as Record<string, unknown>).diperiksa).toBe(true);
    expect(induk.textContent).toContain("Sudah diperiksa");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(induk.querySelector(".bd-blk-tirai")).toBeNull();
  });

  it("pop-up memakai warna tema panel, gelap dan terang, tanpa warna tetap", () => {
    const css = baca("blangko-derry.css");
    const blok = css.slice(css.indexOf("6 Nov 2026: alat bukti tertulis"));
    expect(blok).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(baca("bukti-tertulis.js")).toContain('"aleta-sisip bd-modal bd-blk-tirai"');
  });

  it("kelas pop-up tidak bentrok dengan kelas lama panel", () => {
    const css = baca("blangko-derry.css");
    const i = css.indexOf("6 Nov 2026: alat bukti tertulis");
    expect(i).toBeGreaterThan(0);
    for (const k of ["bd-blk", "bd-bsipp", "bd-bkatalog", "bd-bpindaiwadah"]) expect(css.slice(0, i)).not.toContain(k);
    expect(baca("bukti-tertulis.js")).not.toMatch(/bd-bl(?!k)[-"\s]/);
  });

  it("pilihan katalog tersusun per kelompok", () => {
    const html = eks.htmlKatalogSurat(esc);
    expect(html).toContain('<optgroup label="Perkawinan">');
    expect(html).toContain('value="nikah"');
    expect(eks.htmlKatalogElektronik(esc)).toContain('<optgroup label="Keuangan">');
  });
});

describe("kait di form Blangko Derry", () => {
  const isian = baca("blangko-derry-isian.js");
  it("menulis tetap lewat jalur lama dan penyimpanan NIK utuh tidak bertambah", () => {
    expect(isian).toContain("simpanBukti(w, true);");
    expect(isian).toContain('data-bklengkap="${w}"');
    expect(isian).toContain('data-bkkatalog="${w}"');
    expect(isian).toContain('data-belkatalog="${w}"');
    const rute = readFileSync(path.join(AKAR, "manajemen_surat/src/app/api/aleta-ecourt/blangko-derry/bukti-sipp/route.ts"), "utf8");
    expect(rute).toContain("samarkanNik");
    expect(rute).not.toMatch(/nik:\s*p\.nik/);
  });
  it("layanan bot hanya membaca, dan terdaftar di jembatan", () => {
    const s = readFileSync(path.join(AKAR, "aleta_bot/services/buktiSippService.js"), "utf8");
    expect(s).not.toMatch(/\b(?:UPDATE|INSERT|DELETE|REPLACE)\b/);
    expect(readFileSync(path.join(AKAR, "aleta_bot/services/sippReadOnlyBridgeService.js"), "latin1")).toContain('"case.buktiSipp"');
  });
  it("berkas baru ikut termuat sebelum form dan ikut ditanam", () => {
    const m = baca("manifest.json");
    expect(m.indexOf("bukti-katalog.js")).toBeLessThan(m.indexOf("bukti-tertulis.js"));
    expect(m.indexOf("bukti-tertulis.js")).toBeLessThan(m.indexOf("blangko-derry-isian.js"));
    expect(readFileSync(path.join(AKAR, "manajemen_surat/scripts/susun-ekstensi.mjs"), "utf8")).toContain('"bukti-tertulis.js"');
  });
});
