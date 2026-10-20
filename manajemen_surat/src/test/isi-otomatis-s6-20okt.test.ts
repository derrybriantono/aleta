// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 (agen S6) - ISIAN OTOMATIS BLANGKO DERRY UNTUK JENIS: HARTA BERSAMA, KEWARISAN, WASIAT, HIBAH, WAKAF,
 * IZIN POLIGAMI, PENCEGAHAN/PEMBATALAN PERKAWINAN, HAK ASUH/NAFKAH ANAK, LAIN-LAIN (MAFQUD), EKONOMI SYARIAH
 * ============================================================================
 *
 * Yang dijaga (perilaku, bukan sekadar kata di kode):
 *   A  pembaca posita/petitum (deteksi/isiS6.js): nilai yang diharapkan keluar dari kalimat realistis; keluaran lain tidak
 *      menebak (dua huruf bertentangan = kosong, perkara kewarisan yang menyebut ahli waris hilang bukan mafqud);
 *   B  usulan jenis (isiOtomatisJenisS6.js): data terstruktur SIPP (rekonvensi, perkara cerai terdahulu, akad, kesepakatan
 *      damai), tuntutan nafkah anak, entri "diisi manual" + opsional; jenis di luar S6 dijawab kosong;
 *   C  pembacaan SIPP (bacaKonteks) dengan pembaca tiruan: satu pembacaan yang gagal tidak menggagalkan yang lain;
 *      perkara di luar S6 hanya membaca SATU kali;
 *   D  mesin ekstensi (isi-sipp-bersama.js): pasti/cukup ditulis hanya bila isian KOSONG, ragu menjadi saran, yang manual
 *      mendapat lencana "diisi manual" + alasan, isian petugas TIDAK PERNAH ditimpa;
 *   E  tidak satu pun nilai memuat kata ALETA, dan semua usulan menjaga isian lama.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

type Fakta = { nilai: string; kalimat: string; yakin: string; kodePola: string; asal: string; catatan: string };
type Usulan = {
  kode: string;
  nama: string;
  nilai: string;
  keyakinan: string;
  sumber: Array<{ asal: string; kalimat: string }>;
  catatan: string;
  jagaIsianLama?: boolean;
  manual?: boolean;
  opsional?: boolean;
  labelPengguna?: string;
};
type DeteksiS6 = {
  deteksi: (jenis: number, posita: string, opsi?: Record<string, unknown>) => Record<string, Fakta>;
  deteksiAsuhan: (posita: string) => Record<string, Fakta>;
  deteksiDuplikatAktaNikah: (posita: string) => Record<string, Fakta>;
  hurufTunggal: (teks: string, peta: Array<[string, RegExp]>) => { huruf: string; kalimat: string } | null;
  semuaNama: (teks: string) => Array<{ nama: string }>;
};
type JenisS6 = {
  JENIS_S6: number[];
  MANUAL: Record<string, { alasan: string; jenis?: number[]; opsional?: boolean; labelPengguna?: string }>;
  usulanDariKonteks: (k: Record<string, unknown>) => Usulan[];
  usulanDasarPutus: (t: unknown) => Usulan[];
  usulanDamaiEs: (k: Record<string, unknown>) => Usulan[];
  bacaKonteks: (id: number, q: (sql: string, p?: unknown[]) => Promise<unknown>) => Promise<Record<string, unknown> | null>;
  usulanJenisS6: (id: number, q: (sql: string, p?: unknown[]) => Promise<unknown>) => Promise<Usulan[]>;
};
type Mesin = {
  pilihPerKode: (sumber: Usulan[][], boleh?: Set<string>) => Map<string, Usulan>;
  rencanakan: (
    usulan: Map<string, Usulan>,
    katalog: Array<{ kode: string; nama?: string; jenis: string; opsi?: unknown[]; kosong: boolean; bolehGanti?: boolean }>,
    keIso: (t: string) => string,
    semua?: Usulan[][]
  ) => {
    tulis: Array<{ kode: string; nilai: string; keyakinan: string }>;
    saran: Array<{ kode: string; nilai: string; keyakinan: string }>;
    lewati: Array<{ kode: string; sebab: string }>;
    info: Record<string, { golongan: string; catatan: string; lencana: { yakin: { teks: string } | null; asal: { teks: string } | null }; opsional?: boolean; labelPengguna?: string; sumber: unknown[] }>;
  };
};

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot", "package.json"));
const S6 = require_(path.join(akar, "aleta_bot", "services", "deteksi", "isiS6.js")) as DeteksiS6;
const J6 = require_(path.join(akar, "aleta_bot", "services", "isiOtomatisJenisS6.js")) as JenisS6;

function muatMesin(): Mesin {
  const sumber = readFileSync(path.join(akar, "ekstensi-sipp", "isi-sipp-bersama.js"), "utf8");
  const ctx: Record<string, unknown> = {};
  vm.createContext(ctx);
  vm.runInContext(sumber, ctx);
  return ctx.AletaIsiSipp as Mesin;
}
const MESIN = muatMesin();
const keIso = (t: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

// ---------------------------------------------------------------------------------------------------------------------
// Bahan realistis (nama diganti; susunan kalimat meniru posita/petitum PA Donggala)
// ---------------------------------------------------------------------------------------------------------------------

const HIBAH_POSITA =
  "1. Bahwa almarhum Hasan bin Ali semasa hidupnya memiliki sebidang tanah; 2. Bahwa pada tanggal 12 Mei 2015 almarhum Hasan bin Ali telah menghibahkan sebidang tanah seluas 400 m2 yang terletak di Desa Lolu, Kecamatan Sigi Biromaru, Kabupaten Sigi kepada Tergugat secara lisan di hadapan 2 (dua) orang saksi; 3. Bahwa Penggugat adalah anak kandung dari penghibah; 4. Bahwa Tergugat adalah penerima hibah yang menguasai objek tersebut";
const HIBAH_PETITUM = "Menyatakan hibah yang dilakukan Hasan bin Ali kepada Tergugat melebihi 1/3 harta warisan; Menghukum Tergugat menyerahkan objek";

const WAKAF_POSITA =
  "Bahwa Wakif bernama H. Abdullah bin Ibrahim telah mewakafkan sebidang tanah seluas 20 x 30 meter yang terletak di Desa Bora untuk pembangunan masjid; Bahwa ikrar wakaf tersebut dituangkan dalam Akta Ikrar Wakaf Nomor 45/AIW/2010 tanggal 5 Agustus 2010 di hadapan PPAIW Kecamatan Sigi Biromaru; Bahwa Nazhir adalah Pengurus Masjid Al-Ikhlas Desa Bora; Bahwa tanah wakaf tersebut dikuasai oleh Tergugat";

const WASIAT_POSITA =
  "Bahwa Pewasiat Maryam binti Usman membuat surat wasiat tertanggal 27 Juli 2011 yang mewasiatkan sebidang kebun cengkeh seluas 1 hektar kepada Tergugat; Bahwa Penggugat adalah ahli waris dari Pewasiat";

const MAFQUD_POSITA =
  "Perihal: Permohonan Penetapan Mafqud. Bahwa Pemohon adalah istri sah dari Rusli bin Taher; Bahwa Rusli bin Taher telah pergi meninggalkan rumah sejak bulan Maret 2015 dan hingga kini tidak diketahui keberadaannya; Bahwa Pemohon telah berusaha mencari ke keluarga dan kenalan namun tidak berhasil ditemukan; Bahwa sudah 9 (sembilan) tahun tidak ada kabar; Bahwa Pemohon memerlukan penetapan untuk pembagian harta bersama";

const KEWARISAN_ADA_AHLI_WARIS_HILANG =
  "Bahwa pewaris meninggalkan beberapa ahli waris; Bahwa 1 orang bernama Famli bin Junus sejak tahun 2018 tidak diketahui lagi keberadaannya di seluruh wilayah Republik Indonesia (Surat Keterangan Ghoib Nomor 474.2/12-17/SB/2022)";

const PENCEGAHAN_POSITA =
  "Perihal: Permohonan Pencegahan Perkawinan. Bahwa Pemohon adalah orang tua/ayah kandung dari Rahmawati binti Aidin (calon istri); Bahwa Pemohon tidak menyetujui hubungan anak Pemohon dengan seorang lelaki yang bernama Jufri bin Batria (calon suami); Bahwa pernikahan akan dilangsungkan di Kantor Urusan Agama Kecamatan Marawola";
const PENCEGAHAN_PETITUM = "Memerintahkan Kepala Kantor Urusan Agama Kecamatan Marawola untuk tidak melaksanakan pernikahan antara Rahmawati binti Aidin dengan Jufri bin Batria (calon suami)";

const ES_POSITA =
  "Bahwa pada Hari Jumat tanggal 24 Februari 2023 PENGGUGAT memberikan fasilitas pembiayaan kepada TERGUGAT sebagaimana tertuang dalam Akad Jual Beli Murabahah Nomor: 006/ULS-MSBV/PP-MRB/II/2023 tanggal 24 Februari 2023 (“Akad Jual Beli Murabahah”); Bahwa TERGUGAT tidak membayar angsuran pinjaman sesuai apa yang diperjanjikan sehingga menjadi kredit macet; Bahwa PENGGUGAT telah memberikan Surat Peringatan kepada TERGUGAT sebanyak 3 (tiga) kali";
const ES_PETITUM =
  "Menerima dan mengabulkan gugatan PENGGUGAT seluruhnya; Menghukum TERGUGAT untuk membayar lunas seketika seluruh sisa pinjaman sebesar Rp. 61.241.800 (Enam Puluh Satu Juta Dua Ratus Empat Puluh Satu Ribu Delapan Ratus Rupiah) kepada PENGGUGAT";

const ASUHAN_POSITA =
  "1. Bahwa setelah perceraian anak Penggugat dan Tergugat yang masih di bawah umur tinggal bersama Penggugat; 2. Bahwa Tergugat tidak pernah memberikan nafkah anak sejak bercerai; 3. Bahwa penghasilan Tergugat sebagai nelayan sekitar Rp 3.500.000 per bulan; 4. Hak Asuh Anak";

const KONTEKS_DASAR = { tanggalDaftar: "2026-06-01", pihak1: ["Penggugat bin Ayah"], pihak2: ["Tergugat binti Ibu"] };

const semuaNilai = (u: Usulan[]) => u.map((x) => `${x.nilai} ${x.catatan} ${x.sumber.map((s) => s.kalimat).join(" ")}`).join(" ");

// ---------------------------------------------------------------------------------------------------------------------
describe("A. pembaca posita/petitum jenis S6", () => {
  it("hibah: penghibah (almarhum dipertahankan), objek, bentuk+tanggal, pokok tuntutan huruf, kedudukan", () => {
    const h = S6.deteksi(366, HIBAH_POSITA, { petitum: HIBAH_PETITUM });
    expect(h["9793"].nilai).toBe("almarhum Hasan bin Ali");
    expect(h["9795"].nilai).toBe("sebidang tanah seluas 400 m2 yang terletak di Desa Lolu, Kecamatan Sigi Biromaru, Kabupaten Sigi");
    expect(h["9794"].nilai).toBe("secara lisan pada tanggal 12 Mei 2015 di hadapan 2 (dua) orang saksi");
    expect(h["9790"].nilai).toBe("B");
    expect(h["9802"].nilai).toBe("anak kandung dari penghibah");
    expect(h["9803"].nilai).toBe("penerima hibah");
    for (const f of Object.values(h)) expect(f.asal).toBe("posita-gugatan");
  });

  it("hibah dengan akta bernomor dan tanggal: bentuk 'cukup'; penghibah = Pemohon dari data pihak", () => {
    const h = S6.deteksi(366, "Bahwa Pemohon telah menghibahkan sebidang rumah kepada anak Pemohon dengan Akta Hibah Nomor 12/2019 tanggal 3 Maret 2019 di hadapan PPAT Rahmat, S.H.", { namaPihak: ["Burhan bin Daud"] });
    expect(h["9794"].nilai).toBe("dengan akta hibah Nomor 12/2019 tanggal 3 Maret 2019 di hadapan PPAT Rahmat");
    expect(h["9794"].yakin).toBe("cukup");
    expect(h["9793"].nilai).toBe("Burhan bin Daud");
    expect(h["9793"].yakin).toBe("ragu");
  });

  it("wakaf: wakif, nazhir, akta ikrar (cukup), harta benda, peruntukan, pokok tuntutan, pihak yang menguasai", () => {
    const h = S6.deteksi(367, WAKAF_POSITA, { petitum: "Menyatakan sah wakaf tanah tersebut dan menyerahkan kepada Nazhir" });
    expect(h["9823"].nilai).toBe("H. Abdullah bin Ibrahim");
    expect(h["9824"].nilai).toBe("Pengurus Masjid Al-Ikhlas Desa Bora");
    expect(h["9825"].nilai).toBe("dengan Akta Ikrar Wakaf Nomor 45/AIW/2010 tanggal 5 Agustus 2010 di hadapan PPAIW Kecamatan Sigi Biromaru");
    expect(h["9825"].yakin).toBe("cukup");
    expect(h["9826"].nilai).toBe("sebidang tanah seluas 20 x 30 meter yang terletak di Desa Bora");
    expect(h["9827"].nilai).toBe("sarana ibadah (masjid)");
    expect(h["9820"].nilai).toBe("A");
    expect(h["9841"].nilai).toBe("Tergugat");
  });

  it("wasiat: bentuk+tanggal surat wasiat, objek, kedudukan Penggugat, pokok tuntutan huruf", () => {
    const h = S6.deteksi(365, WASIAT_POSITA, { petitum: "Menyatakan Surat Wasiat tertanggal 27 Juli 2011 melebihi sepertiga harta peninggalan" });
    expect(h["9478"].nilai).toBe("secara tertulis tertanggal 27 Juli 2011");
    expect(h["9479"].nilai).toBe("sebidang kebun cengkeh seluas 1 hektar");
    expect(h["9486"].nilai).toBe("ahli waris dari Pewasiat");
    expect(h["9475"].nilai).toBe("A");
  });

  it("wasiat dibatalkan tanpa dasar: huruf C hanya saran dengan catatan memilih huruf lain", () => {
    const h = S6.deteksi(365, WASIAT_POSITA, { petitum: "Menyatakan Surat Wasiat tertanggal 27 Juli 2011 tidak sah, batal demi hukum" });
    expect(h["9475"].nilai).toBe("C");
    expect(h["9475"].yakin).toBe("ragu");
    expect(h["9475"].catatan).toMatch(/Pasal 197 KHI/);
  });

  it("mafqud (Lain-Lain 369): nama, kedudukan, kepergian, pencarian, lama, kepentingan", () => {
    const h = S6.deteksi(369, MAFQUD_POSITA, { tanggalDaftar: "2024-05-01" });
    expect(h["9860"].nilai).toBe("Rusli bin Taher");
    expect(h["9861"].nilai).toBe("istri");
    expect(h["9862"].nilai).toMatch(/pergi meninggalkan rumah sejak bulan Maret 2015/);
    expect(h["9863"].nilai).toMatch(/mencari ke keluarga dan kenalan/);
    expect(h["9864"].nilai).toBe("9 (sembilan) tahun");
    expect(h["9865"].nilai).toBe("A");
  });

  it("perkara kewarisan yang menyebut seorang ahli waris hilang BUKAN mafqud (tidak ada nama orang hilang)", () => {
    const h = S6.deteksi(369, KEWARISAN_ADA_AHLI_WARIS_HILANG, { petitum: "Menetapkan ahli waris pewaris adalah" });
    expect(h["9860"]).toBeUndefined();
    expect(h["9864"]).toBeUndefined();
  });

  it("pencegahan perkawinan: calon suami/istri, KUA, kedudukan Pemohon, alasan (satu huruf)", () => {
    const h = S6.deteksi(342, PENCEGAHAN_POSITA, { petitum: PENCEGAHAN_PETITUM });
    expect(h["1029"].nilai).toBe("Jufri bin Batria");
    expect(h["9460"].nilai).toBe("Rahmawati binti Aidin");
    expect(h["9461"].nilai).toBe("Kecamatan Marawola");
    expect(h["9462"].nilai).toBe("orang tua/ayah kandung");
    expect(h["9463"].nilai).toBe("G");
  });

  it("dua huruf bertentangan = kosong (hakim yang memilih)", () => {
    const h = S6.deteksi(342, "Bahwa calon istri masih terikat perkawinan dan juga masih di bawah umur; Permohonan Pencegahan Perkawinan", {});
    expect(h["9463"]).toBeUndefined();
    expect(S6.hurufTunggal("mahram dan masa iddah", [["C", /mahram/], ["D", /iddah/]])).toBeNull();
    expect(S6.hurufTunggal("hanya mahram", [["C", /mahram/], ["D", /iddah/]])?.huruf).toBe("C");
  });

  it("pembatalan perkawinan: huruf alasan dari ciri posita (hamil dari laki-laki lain = F)", () => {
    const h = S6.deteksi(344, "Permohonan Pembatalan Perkawinan. Bahwa Pemohon memastikan Termohon mengandung biologis orang lain", { petitum: "Membatalkan perkawinan antara Pemohon dengan Termohon" });
    expect(h["9320"].nilai).toBe("F");
  });

  it("ekonomi syariah: akad+nomor+tanggal (cukup), jumlah yang digugat angka saja, fakta wanprestasi + surat peringatan", () => {
    const h = S6.deteksi(370, ES_POSITA, { petitum: ES_PETITUM });
    expect(h["9340"].nilai).toBe("Akad Jual Beli Murabahah Nomor 006/ULS-MSBV/PP-MRB/II/2023 tanggal 24 Februari 2023");
    expect(h["9340"].yakin).toBe("cukup");
    expect(h["9341"].nilai).toBe("61241800");
    expect(h["9341"].yakin).toBe("ragu");
    expect(h["9341"].catatan).toMatch(/DIGUGAT/);
    expect(h["9345"].nilai).toMatch(/tidak membayar angsuran pinjaman/);
    expect(h["9345"].nilai).toMatch(/surat peringatan sebanyak 3 \(tiga\) kali/);
  });

  it("ekonomi syariah dengan dua akad: ragu, keduanya disebut", () => {
    const h = S6.deteksi(
      370,
      "Bahwa Akad Jual Beli Murabahah Nomor: 025/ULS/XII/2019 tanggal 18 Desember 2019; Bahwa tambahan pembiayaan Akad Jual Beli Murabahah Nomor: 007/ULS/III/2021 tanggal 02 Maret 2021",
      {}
    );
    expect(h["9340"].yakin).toBe("ragu");
    expect(h["9340"].nilai).toMatch(/025\/ULS\/XII\/2019 tanggal 18 Desember 2019; dan .*007\/ULS\/III\/2021 tanggal 2 Maret 2021/);
  });

  it("hak asuh/nafkah anak: penghasilan per bulan (rupiah + terbilang), fakta asuhan dan kelalaian", () => {
    const h = S6.deteksiAsuhan(ASUHAN_POSITA);
    expect(h["5271"].nilai).toBe("Rp3.500.000,00 (tiga juta lima ratus ribu rupiah)");
    expect(h["5171"]).toBeUndefined();
    expect(h["9748"].nilai).toMatch(/tinggal bersama Penggugat/);
    expect(h["9748"].nilai).toMatch(/tidak pernah memberikan nafkah anak/);
  });

  it("duplikat kutipan akta nikah: nomor dan tanggal", () => {
    const h = S6.deteksiDuplikatAktaNikah("Bahwa Penggugat dan Tergugat menikah pada 27 Agustus 2014 sebagaimana tercatat dalam Duplikat Kutipan Akta Nikah Nomor: 365/Kua.22.10.04/PW.01/07/2025 tanggal 4 Februari 2020.");
    expect(h["1108"].nilai).toBe("365/Kua.22.10.04/PW.01/07/2025");
    expect(h["0889"].nilai).toBe("4 Februari 2020");
  });

  it("nama orang: kata pembuka kalimat dibuang dan 'Alm.' menjadi almarhum/almarhumah", () => {
    expect(S6.semuaNama("Bahwa Rusli bin Taher pergi")[0].nama).toBe("Rusli bin Taher");
    expect(S6.semuaNama("dari Alm. Hasan bin Ali dan Almh. Siti binti Umar")).toEqual([{ nama: "almarhum Hasan bin Ali", awal: expect.any(Number), akhir: expect.any(Number), almarhum: true }, { nama: "almarhumah Siti binti Umar", awal: expect.any(Number), akhir: expect.any(Number), almarhum: true }]);
  });

  it("kata ALETA tidak pernah masuk nilai", () => {
    const h = S6.deteksi(370, "Bahwa Akad Pembiayaan Murabahah Nomor: ALETA/001/2023 tanggal 1 Januari 2023", {});
    for (const f of Object.values(h)) expect(f.nilai).not.toMatch(/aleta/i);
  });

  it("posita kosong atau jenis lain: tidak ada keluaran dan tidak galat", () => {
    expect(S6.deteksi(366, "", {})).toEqual({});
    expect(S6.deteksi(347, HIBAH_POSITA, { petitum: HIBAH_PETITUM })).toEqual({});
    expect(S6.deteksi(366, undefined as unknown as string, {})).toEqual({});
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("B. usulan jenis S6 dari konteks", () => {
  it("jenis di luar S6 (cerai, itsbat, dispensasi, perwalian) dijawab kosong", () => {
    for (const jenis of [346, 347, 354, 358, 360, 362, 363, 371]) expect(J6.usulanDariKonteks({ jenisPerkaraId: jenis, posita: HIBAH_POSITA, petitum: HIBAH_PETITUM })).toEqual([]);
  });

  it("hibah: usulan dari posita + isian manual untuk penilaian hakim; kode yang terbaca tidak muncul lagi sebagai manual", () => {
    const u = J6.usulanDariKonteks({ jenisPerkaraId: 366, posita: HIBAH_POSITA, petitum: HIBAH_PETITUM, ...KONTEKS_DASAR });
    const oleh = new Map(u.map((x) => [x.kode, x]));
    expect(oleh.get("9793")?.keyakinan).toBe("ragu");
    expect(oleh.get("9793")?.sumber[0].asal).toBe("posita-gugatan");
    expect(oleh.get("9798")?.keyakinan).toBe("tidak_ada_sumber");
    expect(oleh.get("9798")?.manual).toBe(true);
    expect(oleh.get("9798")?.catatan).toMatch(/majelis/);
    expect(u.filter((x) => x.kode === "9793")).toHaveLength(1);
    // manual hanya untuk kode yang tidak terbaca
    expect(u.filter((x) => x.manual).every((x) => !["9793", "9794", "9795", "9790"].includes(x.kode))).toBe(true);
  });

  it("isian opsional membawa opsional + labelPengguna dan tetap bukan saran bernilai", () => {
    const u = J6.usulanDariKonteks({ jenisPerkaraId: 348, posita: "", petitum: "", ...KONTEKS_DASAR });
    const korsa = u.find((x) => x.kode === "8712");
    expect(korsa?.opsional).toBe(true);
    expect(korsa?.labelPengguna).toMatch(/panjar/);
    expect(korsa?.nilai).toBe("");
    const bas = u.find((x) => x.kode === "9282");
    expect(bas?.opsional).toBe(true);
    // tidak opsional: penilaian hakim
    expect(u.find((x) => x.kode === "7178")?.opsional).toBeUndefined();
    // jenis lain tidak mendapat entri jenis tertentu
    expect(J6.usulanDariKonteks({ jenisPerkaraId: 341, posita: "", petitum: "" }).some((x) => x.kode === "9165")).toBe(false);
    expect(J6.usulanDariKonteks({ jenisPerkaraId: 341, posita: "", petitum: "" }).some((x) => x.kode === "9171")).toBe(true);
  });

  it("gugatan rekonvensi di SIPP -> 7084 = 1 (pasti); objek harta bersama rekonvensi -> 9283 (ragu)", () => {
    const petitum = "<p><strong>DALAM REKONVENSI</strong></p><ul><li>Menetapkan harta bersama berupa:</li></ul><ol><li>Sebidang tanah di Desa Kalukubula seluas 300 m2;</li><li>Satu unit sepeda motor Honda Beat;</li></ol><p>Menghukum Tergugat Rekonvensi</p>";
    const u = J6.usulanDariKonteks({ jenisPerkaraId: 348, posita: "", petitum: "", ...KONTEKS_DASAR, rekonvensi: { tgl: "2025-11-03", petitum } });
    const k7084 = u.find((x) => x.kode === "7084");
    expect(k7084?.nilai).toBe("1");
    expect(k7084?.keyakinan).toBe("pasti");
    expect(k7084?.sumber[0].asal).toBe("sipp");
    const k9283 = u.find((x) => x.kode === "9283");
    expect(k9283?.keyakinan).toBe("ragu");
    expect(k9283?.nilai).toContain("Sebidang tanah di Desa Kalukubula");
    expect(k9283?.nilai).toContain("sepeda motor Honda Beat");
    // tanpa rekonvensi tidak ada 7084
    expect(J6.usulanDariKonteks({ jenisPerkaraId: 348, posita: "", petitum: "", ...KONTEKS_DASAR }).some((x) => x.kode === "7084")).toBe(false);
  });

  it("dasar putusnya perkawinan: perkara cerai terdahulu + akta cerai = cukup; tanpa akta atau lebih dari satu = ragu", () => {
    const satu = J6.usulanDasarPutus([{ nomor: "478/Pdt.G/2021/PA.Dgl", tglPutusan: "2021-11-25", nomorAkta: "0123/AC/2022/PA.Dgl" }]);
    expect(satu).toHaveLength(1);
    expect(satu[0].nilai).toBe("Pengadilan Agama Donggala berdasarkan Putusan Nomor 478/Pdt.G/2021/PA.Dgl");
    expect(satu[0].keyakinan).toBe("cukup");
    const tanpaAkta = J6.usulanDasarPutus([{ nomor: "240/Pdt.G/2016/PA.Dgl", tglPutusan: "2016-09-28", nomorAkta: "" }]);
    expect(tanpaAkta[0].keyakinan).toBe("ragu");
    const dua = J6.usulanDasarPutus([
      { nomor: "10/Pdt.G/2019/PA.Dgl", tglPutusan: "2019-01-01", nomorAkta: "1/AC/2019/PA.Dgl" },
      { nomor: "20/Pdt.G/2020/PA.Dgl", tglPutusan: "2020-01-01", nomorAkta: "2/AC/2020/PA.Dgl" },
    ]);
    expect(dua[0].keyakinan).toBe("ragu");
    // pengadilan yang tidak dikenal tidak ditebak
    expect(J6.usulanDasarPutus([{ nomor: "5/Pdt.G/2020/PA.Xyz", tglPutusan: "2020-01-01", nomorAkta: "" }])).toEqual([]);
    // hanya jenis pasangan (mantan suami istri): harta bersama dan hak asuh; kewarisan tidak
    const hb = J6.usulanDariKonteks({ jenisPerkaraId: 348, posita: "", petitum: "", ...KONTEKS_DASAR, terdahulu: [{ nomor: "478/Pdt.G/2021/PA.Dgl", tglPutusan: "2021-11-25", nomorAkta: "1/AC/2022/PA.Dgl" }] });
    expect(hb.find((x) => x.kode === "8706")?.keyakinan).toBe("cukup");
    const waris = J6.usulanDariKonteks({ jenisPerkaraId: 364, posita: "", petitum: "", ...KONTEKS_DASAR, terdahulu: [{ nomor: "478/Pdt.G/2021/PA.Dgl", tglPutusan: "2021-11-25", nomorAkta: "1/AC/2022/PA.Dgl" }] });
    expect(waris.some((x) => x.kode === "8706")).toBe(false);
  });

  it("ekonomi syariah: akad dari posita (cukup) menang atas referensi; tanpa nomor akad memakai jenis akad dari pendaftaran (ragu)", () => {
    const ada = J6.usulanDariKonteks({ jenisPerkaraId: 370, posita: ES_POSITA, petitum: ES_PETITUM, ...KONTEKS_DASAR, akad: ["Murabahah"] });
    expect(ada.find((x) => x.kode === "9340")?.keyakinan).toBe("cukup");
    const hanyaRef = J6.usulanDariKonteks({ jenisPerkaraId: 370, posita: "Bahwa Tergugat wanprestasi", petitum: "", ...KONTEKS_DASAR, akad: ["Murabahah"] });
    const k = hanyaRef.find((x) => x.kode === "9340");
    expect(k?.nilai).toBe("Akad Murabahah");
    expect(k?.keyakinan).toBe("ragu");
  });

  it("ekonomi syariah: kesepakatan damai dari mediasi Y1 (tanggal + isi cukup), biaya perkara dari butir kesepakatan (ragu)", () => {
    const isi = "<p>Pasal 1</p><p>Tergugat mengakui utang dan membayar Rp10.000.000,00 dalam 3 kali angsuran.</p><p>Pasal 2</p><p>Biaya perkara dibebankan kepada Tergugat.</p>";
    const u = J6.usulanDamaiEs({ mediasi: { hasil: "Y1", tgl: "2025-07-02", isi }, tglDamai: "" });
    const oleh = new Map(u.map((x) => [x.kode, x]));
    expect(oleh.get("9353")?.nilai).toBe("02/07/2025");
    expect(oleh.get("9353")?.keyakinan).toBe("cukup");
    expect(oleh.get("9352")?.nilai).toMatch(/^Pasal 1<br>Tergugat mengakui utang/);
    expect(oleh.get("9354")?.nilai).toBe("Tergugat");
    expect(oleh.get("9354")?.keyakinan).toBe("ragu");
    // tanpa mediasi, hanya tanggal pengesahan perdamaian di data perkara -> ragu
    const hanyaTgl = J6.usulanDamaiEs({ mediasi: null, tglDamai: "2025-07-05" });
    expect(hanyaTgl.map((x) => x.kode)).toEqual(["9353"]);
    expect(hanyaTgl[0].keyakinan).toBe("ragu");
    expect(J6.usulanDamaiEs({ mediasi: null, tglDamai: "" })).toEqual([]);
  });

  it("nafkah anak dari petitum SIPP: nominal ragu dengan catatan 'DITUNTUT' (6071)", () => {
    const u = J6.usulanDariKonteks({
      jenisPerkaraId: 369,
      posita: ASUHAN_POSITA,
      petitum: "Menetapkan hak asuh anak kepada Penggugat; Menghukum Tergugat untuk membayar nafkah anak sebesar Rp. 2.500.000 setiap bulan sampai anak dewasa",
      ...KONTEKS_DASAR,
    });
    const k = u.find((x) => x.kode === "6071");
    expect(k?.nilai).toBe("sebesar Rp2.500.000,00 (dua juta lima ratus ribu rupiah) setiap bulan");
    expect(k?.keyakinan).toBe("ragu");
    expect(k?.catatan).toMatch(/DITUNTUT/);
    expect(k?.sumber[0].kalimat).toMatch(/^Petitum di SIPP/);
  });

  it("semua usulan: menjaga isian lama, tanpa kata ALETA, kode tanpa duplikat", () => {
    const kasus: Array<[number, string, string]> = [
      [366, HIBAH_POSITA, HIBAH_PETITUM],
      [367, WAKAF_POSITA, ""],
      [365, WASIAT_POSITA, ""],
      [369, MAFQUD_POSITA, ""],
      [342, PENCEGAHAN_POSITA, PENCEGAHAN_PETITUM],
      [370, ES_POSITA, ES_PETITUM],
    ];
    for (const [jenis, posita, petitum] of kasus) {
      const u = J6.usulanDariKonteks({ jenisPerkaraId: jenis, posita, petitum, ...KONTEKS_DASAR });
      expect(u.length).toBeGreaterThan(5);
      expect(u.every((x) => x.jagaIsianLama === true)).toBe(true);
      expect(semuaNilai(u)).not.toMatch(/aleta/i);
      expect(new Set(u.map((x) => x.kode)).size).toBe(u.length);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("C. pembacaan SIPP (pembaca tiruan)", () => {
  const BARIS_HB = {
    jenis: "348", alur: "15", nomor: "344/Pdt.G/2026/PA.Dgl", posita: "Bahwa Penggugat dan Tergugat menikah; Bahwa sebagaimana tercatat dalam Duplikat Kutipan Akta Nikah Nomor: 365/Kua/2025.", petitum: "",
    tanggalDaftar: "2026-06-01", tglDamai: "",
  };
  function pembaca(cadangan: Record<string, unknown>, catat: string[] = []) {
    return async (sql: string) => {
      catat.push(sql.replace(/\s+/g, " ").slice(0, 60));
      for (const [kunci, nilai] of Object.entries(cadangan)) if (sql.includes(kunci)) {
        if (nilai instanceof Error) throw nilai;
        return nilai;
      }
      return [];
    };
  }

  it("perkara di luar S6: HANYA satu pembacaan, hasil kosong", async () => {
    const catat: string[] = [];
    const q = pembaca({ "FROM perkara p WHERE": [{ ...BARIS_HB, jenis: "347" }] }, catat);
    expect(await J6.usulanJenisS6(10, q)).toEqual([]);
    expect(catat).toHaveLength(1);
  });

  it("harta bersama: konteks lengkap -> usulan dari semua sumber, termasuk perkara cerai terdahulu", async () => {
    const q = pembaca({
      "FROM perkara p WHERE": [BARIS_HB],
      "FROM perkara_pihak1 WHERE": [{ nama: "Nisma Binti Saleh" }],
      "FROM perkara_pihak2 WHERE": [{ nama: "Kasim Bin Imbali" }],
      "FROM perkara_rekonvensi": [{ tgl: "2026-07-01", petitum: "<p>Menetapkan harta bersama berupa:</p><ol><li>Sebidang tanah di Desa Lolu;</li></ol>" }],
      "JOIN perkara_pihak1 a": [{ nomor: "478/Pdt.G/2021/PA.Dgl", tglPutusan: "2021-11-25", nomorAkta: "0123/AC/2022/PA.Dgl" }],
    });
    const u = await J6.usulanJenisS6(10, q);
    const oleh = new Map(u.map((x) => [x.kode, x]));
    expect(oleh.get("7084")?.nilai).toBe("1");
    expect(oleh.get("8706")?.nilai).toBe("Pengadilan Agama Donggala berdasarkan Putusan Nomor 478/Pdt.G/2021/PA.Dgl");
    expect(oleh.get("1108")?.nilai).toBe("365/Kua/2025");
    expect(oleh.get("9283")?.nilai).toContain("Sebidang tanah di Desa Lolu");
  });

  it("satu pembacaan gagal (tabel tidak ada) tidak menggagalkan yang lain", async () => {
    const q = pembaca({
      "FROM perkara p WHERE": [BARIS_HB],
      "FROM perkara_rekonvensi": new Error("Table 'perkara_rekonvensi' doesn't exist"),
      "JOIN perkara_pihak1 a": new Error("timeout"),
      "FROM perkara_pihak1 WHERE": [{ nama: "A" }],
      "FROM perkara_pihak2 WHERE": [{ nama: "B" }],
    });
    const u = await J6.usulanJenisS6(10, q);
    expect(u.some((x) => x.kode === "7084")).toBe(false);
    expect(u.some((x) => x.kode === "1108")).toBe(true);
    expect(u.some((x) => x.kode === "7178" && x.manual)).toBe(true);
  });

  it("pembacaan perkara itu sendiri gagal atau perkara tidak ada: kosong tanpa galat", async () => {
    expect(await J6.usulanJenisS6(10, async () => { throw new Error("putus"); })).toEqual([]);
    expect(await J6.usulanJenisS6(10, async () => [])).toEqual([]);
    expect(await J6.usulanJenisS6(0, async () => [])).toEqual([]);
    expect(await J6.usulanJenisS6(10, undefined as never)).toEqual([]);
  });

  it("ekonomi syariah membaca akad referensi dan mediasi; jenis lain tidak membacanya", async () => {
    const catat: string[] = [];
    const q = pembaca(
      {
        "FROM perkara p WHERE": [{ ...BARIS_HB, jenis: "370", posita: "Bahwa tergugat wanprestasi", tglDamai: "2025-07-05" }],
        "perkara_ref_akad_syariah": [{ nama: "Murabahah" }],
        "FROM perkara_mediasi": [],
      },
      catat
    );
    const u = await J6.usulanJenisS6(10, q);
    expect(u.find((x) => x.kode === "9340")?.nilai).toBe("Akad Murabahah");
    expect(u.find((x) => x.kode === "9353")?.keyakinan).toBe("ragu");
    const catatHb: string[] = [];
    await J6.usulanJenisS6(10, pembaca({ "FROM perkara p WHERE": [BARIS_HB] }, catatHb));
    expect(catatHb.some((s) => /akad_syariah|perkara_mediasi/.test(s))).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("D. mesin ekstensi: tulis hanya yang pasti/cukup dan kosong, ragu = saran, manual = lencana + alasan", () => {
  const katalog = (kode: string, kosong = true, jenis = "teks") => ({ kode, nama: `isian ${kode}`, jenis, kosong });

  it("cukup+kosong ditulis; ragu menjadi saran; manual mendapat lencana 'diisi manual' dan alasan di keterangan", () => {
    const usulan = J6.usulanDariKonteks({ jenisPerkaraId: 370, posita: ES_POSITA, petitum: ES_PETITUM, ...KONTEKS_DASAR });
    const peta = MESIN.pilihPerKode([usulan]);
    const r = MESIN.rencanakan(peta, ["9340", "9341", "9345", "9346", "8712"].map((k) => katalog(k)), keIso, [usulan]);
    expect(r.tulis.map((x) => x.kode)).toEqual(["9340"]);
    expect(r.saran.map((x) => x.kode).sort()).toEqual(["9341", "9345"]);
    expect(r.info["9346"].golongan).toBe("manual");
    expect(r.info["9346"].lencana.yakin?.teks).toBe("diisi manual");
    expect(r.info["9346"].catatan).toMatch(/bukan data perkara/);
    expect(r.info["9346"].sumber).toEqual([]);
    expect(r.info["8712"].opsional).toBe(true);
    expect(r.info["8712"].lencana.asal?.teks).toMatch(/opsional/);
    expect(r.info["8712"].catatan).toMatch(/^Opsional: Surat teguran panjar/);
    expect(r.info["9340"].lencana.yakin?.teks).toBe("yakin: cukup");
    expect(r.info["9341"].lencana.yakin?.teks).toBe("yakin: ragu — periksa");
    expect(r.info["9341"].lencana.asal?.teks).toBe("dari posita gugatan");
  });

  it("isian yang sudah diketik petugas TIDAK ditimpa (cukup maupun ragu), manual tidak mengubah apa pun", () => {
    const usulan = J6.usulanDariKonteks({ jenisPerkaraId: 370, posita: ES_POSITA, petitum: ES_PETITUM, ...KONTEKS_DASAR });
    const peta = MESIN.pilihPerKode([usulan]);
    const r = MESIN.rencanakan(peta, ["9340", "9341", "9346"].map((k) => katalog(k, false)), keIso, [usulan]);
    expect(r.tulis).toEqual([]);
    expect(r.saran).toEqual([]);
    expect(r.lewati.find((x) => x.kode === "9340")?.sebab).toBe("sudah ada isinya");
    expect(r.lewati.find((x) => x.kode === "9346")?.sebab).toBe("diisi manual");
  });

  it("usulan e-Court yang bernilai menggantikan entri manual untuk kode yang sama", () => {
    const manual = J6.usulanDariKonteks({ jenisPerkaraId: 348, posita: "", petitum: "", ...KONTEKS_DASAR });
    const ecourt: Usulan[] = [{ kode: "8436", nama: "Kesimpulan", nilai: "tetap pada gugatan", keyakinan: "ragu", sumber: [{ asal: "gugatan-ecourt", kalimat: "e-Court" }], catatan: "" }];
    const peta = MESIN.pilihPerKode([manual, ecourt]);
    expect(peta.get("8436")?.nilai).toBe("tetap pada gugatan");
    const r = MESIN.rencanakan(peta, [katalog("8436")], keIso, [manual, ecourt]);
    expect(r.saran.map((x) => x.kode)).toEqual(["8436"]);
    expect(r.info["8436"].golongan).toBe("saran");
  });

  it("entri manual tanpa catatan tidak membuat lencana kosong, dan tidak ada nilai yang ditulis", () => {
    const peta = MESIN.pilihPerKode([[{ kode: "9999", nama: "x", nilai: "", keyakinan: "tidak_ada_sumber", sumber: [], catatan: "" }]]);
    const r = MESIN.rencanakan(peta, [katalog("9999")], keIso, []);
    expect(r.info["9999"]).toBeUndefined();
    expect(r.tulis).toEqual([]);
  });

  it("tanggal damai ES (dd/mm/yyyy) terbaca sebagai tanggal sah; tulis hanya bila cukup", () => {
    const u = J6.usulanDamaiEs({ mediasi: { hasil: "Y1", tgl: "2025-07-02", isi: "<p>Pasal 1</p><p>isi</p>" }, tglDamai: "" });
    const peta = MESIN.pilihPerKode([u]);
    const r = MESIN.rencanakan(peta, [katalog("9353", true, "tanggal")], keIso, [u]);
    expect(r.tulis).toEqual([{ kode: "9353", nilai: "2025-07-02", keyakinan: "cukup", asal: "SIPP", ganti: false }]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("E. cakupan: tiap jenis S6 mempunyai entri manual dan daftar jenisnya konsisten", () => {
  it("JENIS_S6 tidak memuat jenis S3/S5 dan semua entri MANUAL beralasan", () => {
    for (const jenis of [346, 347, 360, 362, 363, 354, 358, 371]) expect(J6.JENIS_S6).not.toContain(jenis);
    for (const jenis of [341, 342, 344, 348, 364, 365, 366, 367, 369, 370]) expect(J6.JENIS_S6).toContain(jenis);
    for (const [kode, m] of Object.entries(J6.MANUAL)) {
      expect(m.alasan.length, kode).toBeGreaterThan(20);
      expect(m.alasan, kode).not.toMatch(/aleta/i);
      if (m.opsional) expect(m.labelPengguna || m.alasan, kode).toBeTruthy();
    }
  });
});
