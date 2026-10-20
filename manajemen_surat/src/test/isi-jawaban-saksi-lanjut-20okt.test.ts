// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 - PENGISI JAWABAN SAKSI LANJUTAN (agen S7)
 * ============================================================================
 * Jawaban susunan katalog (penanda variabel), hubungan saksi dari SIPP, pola posita jenis lain, titik-titik literal,
 * dan perbaikan bug isiTemplatSaksi pada dispensasi kawin ("Calon suami ... bernama 3 orang anak").
 */
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

const require_ = createRequire(path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js"));
const isi = require_("../services/isiJawabanSaksi.js");
const servis = require_("../services/isiJawabanSaksiService.js");
const V = require_("../services/isiJawabanSaksiVariabel.js");
const posita_ = require_("../services/isiJawabanSaksiPosita.js");
const lain = require_("../services/isiJawabanSaksiPositaLain.js");
const djp = require_("../services/deteksiJenisPerkaraService.js");

const BUKA = "⟦";
const TUTUP = "⟧";
const tanda = (k: string) => `${BUKA}${k}${TUTUP}`;

const POSITA_PERWALIAN = `1. Bahwa Alm. Ferdyk F. Kindangen bin Fence Kindangen (mantan Suami Pemohon) telah meninggal dunia pada tanggal 06 April 2026 dikarenakan sakit sesuai Akta Kematian;
2. Bahwa dalam hal ini Pemohon ingin mengurus harta peninggalan Alm. Ferdyk F. Kindangen yaitu Dana JKM BPJS Ketenaga Kerjaan maka Pemohon memerlukan untuk di tetapkan sebagai wali atas anak Pemohon (Fritdzilya Vensima binti Ferdyk F. Kindangen), Umur 12 Tahun;`;

const POSITA_DK = `1. Bahwa para Pemohon I dan Pemohon II telah menikah pada tanggal 17 November 2008 dan pernikahan tersebut telah dikaruniai 3 (tiga) anak yang masing-masing bernama :
a. Maura Anastasya binti Robin, umur 15 tahun;
b. Maudy Ramadhani binti Robin
2. Bahwa para Pemohon berencana akan menikahkan anak para Pemohon yang bernama Maura Anastasya binti Robin (calon mempelai wanita) dengan seorang laki-laki yang bernama Ibrahim bin Yusuf (calon mempelai laki-laki);
3. Bahwa anak para Pemohon yang bernama Maura Anastasya binti Robin masih berusia 15 tahun;`;

describe("penanda variabel katalog diisi dari fakta", () => {
  it("variabel ABT diisi satu per satu menurut isinya; yang datanya tidak ada kembali menjadi titik-titik", () => {
    const fakta = isi.bangunFakta({ tambahan: lain.positaLain(posita_.butirPosita(POSITA_PERWALIAN), "perwalian") });
    const kode = `saya mengetahui sendiri bahwa ${tanda("#5110#")} sekarang berumur ... tahun dan ${tanda("#1025#")} wafat disebabkan ${tanda("#1247#")}`;
    const r = isi.isiJawaban({ tanya: "Berapa umur anak?", jawab: "saya mengetahui sendiri bahwa ... sekarang berumur ... tahun dan ... wafat disebabkan ...", kode }, fakta, { jenis: "perwalian", P: "Pemohon", T: "Termohon", ke: 1, modus: "melihat" });
    expect(r.teks).toBe("saya mengetahui sendiri bahwa Fritdzilya Vensima binti Ferdyk F. Kindangen sekarang berumur 12 tahun dan Ferdyk F. Kindangen bin Fence Kindangen wafat disebabkan sakit");
    expect(r.yakin).toBe("cukup");
    expect(r.teks).not.toMatch(/⟦/);
  });

  it("7036 = Pemohon / para Pemohon menurut jumlah pihak pertama di SIPP; tanpa data tetap titik-titik", () => {
    const fakta = isi.bangunFakta({});
    const hit = (jumlahP: number) => isi.isiJawaban({ tanya: "Siapa?", jawab: "saya kenal ...", kode: `saya kenal ${tanda("#7036#")}` }, fakta, { jenis: "perwalian", P: "Pemohon", T: "Termohon", ke: 1, jumlahP });
    expect(hit(2).teks).toBe("saya kenal para Pemohon");
    expect(hit(1).teks).toBe("saya kenal Pemohon");
    expect(hit(0)).toBeNull();
  });

  it("hubungan saksi {hubungan} datang dari kolom Keterangan saksi SIPP, ditulis huruf kecil", () => {
    const h = servis.hubunganDariSipp({ saksi: [{ pihak: "P", urutPihak: 1, keterangan: "Tetangga Pemohon" }, { pihak: "P", urutPihak: 2, keterangan: "Adik Kandung Pemohon" }] }, "saksi 2 p", "Pemohon", "Termohon");
    expect(h).toMatchObject({ sumber: "data SIPP", yakin: "yakin" });
    const fakta = isi.bangunFakta({});
    const r = isi.isiJawaban({ tanya: "Apakah Saudara kenal?", jawab: "saya kenal ... karena saya adalah ...", kode: `saya kenal ${tanda("#7036#")} karena saya adalah ${tanda("{hubungan}")}` }, fakta, { jenis: "perwalian", P: "Pemohon", T: "Termohon", ke: 2, jumlahP: 1, hubungan: h });
    expect(r.teks).toMatch(/^saya kenal Pemohon karena saya adalah adik kandung Pemohon$/);
    expect(servis.hubunganDariSipp({ saksi: [] }, "saksi 1 p", "Pemohon", "Termohon")).toBeNull();
    // set pertanyaan portal non-cerai: "karena saya adalah ..." tanpa sebutan di ujung
    const set = isi.isiJawaban({ tanya: "Apakah Saudara kenal dengan Pemohon?", jawab: "Ya, saya kenal dengan Pemohon karena saya adalah ...;" }, fakta, { jenis: "perwalian", P: "Pemohon", T: "Termohon", ke: 1, hubungan: h });
    expect(set.teks).toBe("Ya, saya kenal dengan Pemohon karena saya adalah adik kandung Pemohon;");
  });

  it("titik-titik literal diisi menurut kata di kirinya; jenis lain tidak ikut terisi", () => {
    const fakta = isi.bangunFakta({ tambahan: lain.positaLain(posita_.butirPosita(POSITA_PERWALIAN), "perwalian") });
    const h = { nilai: (k: string, f?: (v: string) => string) => { const x = fakta.ambil(k); return x ? (f ? f(x.nilai) : x.nilai) : null; } };
    expect(V.isiTitikKiri("anak itu sekarang berumur ... tahun dan belum menikah", h, { jenis: "perwalian" })).toBe("anak itu sekarang berumur 12 tahun dan belum menikah");
    expect(V.isiTitikKiri("anak itu sekarang berumur ... tahun", h, { jenis: "hb" })).toBe("anak itu sekarang berumur ... tahun");
    expect(V.isiTitikKiri("hubungan Pemohon dengan anak itu adalah sebagai ...", h, { jenis: "perwalian" })).toBe("hubungan Pemohon dengan anak itu adalah sebagai ibu kandung");
  });
});

describe("pola posita jenis lain (hanya yang tertulis)", () => {
  const kunci = (hasil: Array<{ kunci: string; nilai: string }>, k: string) => (hasil.find((x) => x.kunci === k) || { nilai: "" }).nilai;

  it("perwalian: anak, umur, ayah dari nasab, yang meninggal, tanggal, sebab, hubungan, keperluan", () => {
    const h = posita_.positaTambahan(POSITA_PERWALIAN, "perwalian");
    expect(kunci(h, "anakNama")).toBe("Fritdzilya Vensima binti Ferdyk F. Kindangen");
    expect(kunci(h, "anakUmur")).toBe("12");
    expect(kunci(h, "ayahAnak")).toBe("Ferdyk F. Kindangen");
    expect(kunci(h, "pewarisNama")).toBe("Ferdyk F. Kindangen bin Fence Kindangen");
    expect(kunci(h, "wafatTgl")).toBe("6 April 2026");
    expect(kunci(h, "wafatSebab")).toBe("sakit");
    expect(kunci(h, "hubunganPemohonAnak")).toBe("ibu kandung");
    expect(h.find((x: { kunci: string }) => x.kunci === "hubunganPemohonAnak").yakin).toBe("ragu");
    expect(kunci(h, "tujuan")).toMatch(/^mengurus harta peninggalan Alm\. Ferdyk F\. Kindangen yaitu Dana JKM BPJS/);
  });

  it("ahli waris: jumlah anak dan daftar nama dari baris di bawahnya", () => {
    const p = `1. Bahwa Almarhum Muh Tang meninggal Dunia pada Tanggal 28 November 2006 karena sakit;\n2. Bahwa Almarhum dan Almarhumah telah dikaruniakan 3 (tiga) orang anak masih hidup yaitu:\n- SADUDIN, Bin M.Tang.\n- SALEHA Binti, M. Tang.\n- SIRAN T Bin, M. Tang.\n3. Bahwa berdasarkan hukum Islam, para pemohon adalah ahli waris sah;`;
    const h = posita_.positaTambahan(p, "paw");
    expect(kunci(h, "jumlahAnakPewaris")).toBe("3");
    expect(kunci(h, "anakPewaris")).toBe("Sadudin bin M.Tang, Saleha binti M. Tang dan Siran T bin M. Tang");
  });

  it("hibah, wakaf, ekonomi syariah, poligami, mafqud, pengangkatan anak: fakta pokok terbaca; tanpa kalimatnya, kosong", () => {
    expect(kunci(lain.positaLain(posita_.butirPosita("Bahwa Haji Ahmad bin Salim telah menghibahkan sebidang tanah seluas 500 m2 di Desa Watusampu kepada Tergugat;"), "hibah"), "penghibah")).toBe("Haji Ahmad bin Salim");
    const w = lain.positaLain(posita_.butirPosita("Bahwa Haji Umar bin Ali telah mewakafkan sebidang tanah di Desa Loli kepada nazhir Masjid Al Ikhlas untuk pembangunan masjid;"), "wakaf");
    expect(kunci(w, "wakif")).toBe("Haji Umar bin Ali");
    expect(kunci(w, "peruntukanWakaf")).toMatch(/pembangunan masjid/);
    expect(kunci(lain.positaLain(posita_.butirPosita("Bahwa Pemohon dan Penggugat membuat akad murabahah pembiayaan rumah;"), "eksyar"), "akad")).toMatch(/murabahah/);
    expect(kunci(lain.positaLain(posita_.butirPosita("Bahwa Pemohon bermaksud menikah lagi dengan calon isteri kedua yang bernama Siti Aminah binti Yusuf;"), "ip"), "calonIstri")).toBe("Siti Aminah binti Yusuf");
    expect(kunci(lain.positaLain(posita_.butirPosita("Bahwa suami Pemohon bernama Rahmat bin Karim telah pergi meninggalkan rumah dan tidak ada kabar;"), "mafqud"), "orangHilang")).toBe("Rahmat bin Karim");
    expect(lain.positaLain(posita_.butirPosita("Bahwa Pemohon mengajukan permohonan ini."), "hibah")).toEqual([]);
  });
});

describe("isiBaris: variabel ABT dihitung dari data untuk pertanyaan, dan tanpa kata Aleta", () => {
  it("jawaban katalog terisi, variabel pertanyaan dikembalikan sebagai __variabel, saksi 2 punya kunci berekor", () => {
    const r = servis.isiBaris({
      posita: POSITA_PERWALIAN,
      jenisPerkara: "354",
      alur: "16",
      kunciKatalog: "perwalian",
      pelaku: "Termohon",
      lawan: "Pemohon",
      sipp: { pihak1: [{ nama: "x" }], saksi: [{ pihak: "P", urutPihak: 1, keterangan: "Ipar Pemohon" }] },
      kodeVariabel: ["5110", "1025", "9999"],
      saksiIsi: [{ kunci: "saksi 1 p", ke: 1, modus: "melihat", baris: [{ kunci: "k/b1/melihat", tanya: "Apakah Saudara kenal?", jawab: "saya kenal ... karena saya adalah ...", kode: `saya kenal ${tanda("#7036#")} karena saya adalah ${tanda("{hubungan}")}` }] }],
    });
    expect(r["k/b1/melihat"].teks).toBe("saya kenal Pemohon karena saya adalah ipar Pemohon");
    expect(r["k/b1/melihat@saksi 1 p"].teks).toBe(r["k/b1/melihat"].teks);
    expect(r.__variabel["5110"].teks).toBe("Fritdzilya Vensima binti Ferdyk F. Kindangen");
    expect(r.__variabel["1025"].teks).toMatch(/^Ferdyk F\. Kindangen bin/);
    expect(r.__variabel["9999"]).toBeUndefined();
    expect(JSON.stringify(r)).not.toMatch(/aleta/i);
  });

  it("kodeJenis mengenali jenis katalog lain dari nomor jenis dan kunci katalog", () => {
    expect(servis.kodeJenis("366", "15")).toBe("hibah");
    expect(servis.kodeJenis("367", "16")).toBe("wakaf");
    expect(servis.kodeJenis("370", "15")).toBe("eksyar");
    expect(servis.kodeJenis("369", "16", "pengangkatan-anak")).toBe("angkat");
    expect(servis.kodeJenis("369", "16", "mafqud")).toBe("mafqud");
    expect(servis.kodeJenis("349", "15")).toBe("asuh");
  });
});

describe("bug isiTemplatSaksi dispensasi kawin: isian tidak boleh salah makna", () => {
  const templat = [
    { no: "1", tanya: "Siapa nama calon suami anak Pemohon?", jawab: "Calon suami anak Pemohon bernama ...;", jawabMentah: "Calon suami anak Pemohon bernama #0600#;" },
    { no: "2", tanya: "Apakah anak Pemohon sudah punya anak?", jawab: "Anak Pemohon sudah dikaruniai ...;", jawabMentah: "Anak Pemohon sudah dikaruniai #0007#;" },
    { no: "3", tanya: "Berapa umur anak Pemohon?", jawab: "Anak Pemohon berumur ... tahun;", jawabMentah: "Anak Pemohon berumur #0607# tahun;" },
  ];

  it("jumlah anak dari perkawinan Pemohon tidak mengisi 'anak Pemohon dikaruniai ...'; nama calon dan umur anak tetap terisi benar", () => {
    const r = djp.isiTemplatSaksi(templat.map((x) => ({ ...x })), { posita: POSITA_DK, jenisPerkara: "362", alur: "16", tanpaGerbang: true });
    const jawab = (no: string) => r.templat.find((x: { no: string }) => x.no === no).jawab as string;
    expect(jawab("1")).toBe("Calon suami anak Pemohon bernama Ibrahim bin Yusuf;");
    expect(jawab("1")).not.toMatch(/orang anak/);
    expect(jawab("2")).toBe("Anak Pemohon sudah dikaruniai ...;");
    expect(jawab("3")).toBe("Anak Pemohon berumur 15 tahun;");
  });

  it("isian nama yang memuat angka/'orang anak' ditolak bila faktanya salah tangkap", () => {
    const r = djp.isiTemplatSaksi([{ no: "1", tanya: "Siapa nama calon suami?", jawab: "Calon suami bernama ...;", jawabMentah: "Calon suami bernama #0600#;" }], {
      posita: "Bahwa para Pemohon berencana menikahkan anak dengan laki-laki yang bernama 3 orang anak (calon mempelai laki-laki);",
      jenisPerkara: "362",
      alur: "16",
      tanpaGerbang: true,
    });
    expect(r.templat[0].jawab).not.toMatch(/3 orang anak/);
  });
});
