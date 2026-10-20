// @vitest-environment node
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * W2a-K2 - KATALOG SAKSI VERSI 2: WASIAT, HIBAH, WAKAF, EKONOMI SYARIAH (21 Okt 2026)
 * ============================================================================
 * Uji PERILAKU (bukan toContain atas kode sendiri):
 *   A. katalog v2: semua butir/pokok/keadaan/dasar hukum v1 tetap ada dan jawaban v1 tidak berubah, skema lolos, jumlah butir naik;
 *   B. butir baru hanya tampil pada keadaannya (pertanyaanAktif);
 *   C. susunan 2-5 saksi x semua jenis keterangan x profil tanpa jawaban kembar dan tanpa kurawal lepas;
 *   D. katalog tambahan Tergugat: menggantikan butir arah pengaju hanya bila bantahan ditandai, saksi pengaju tidak berubah;
 *   E. pendeteksi posita (isiJawabanSaksiKebendaan) atas bunyi gugatan - FIXTURE yang disusun dari pola gugatan nyata PA Donggala/PA Bungku
 *      (wasiat 1, ekonomi syariah gugatan sederhana 2, wakaf 2); hibah tidak punya contoh nyata sama sekali; semuanya saran "ragu";
 *   F. berkas untuk sesi utama (variabel baru, peta fakta tambahan) dan data ekstensi.
 */

const REPO = path.resolve(__dirname, "../../..");
const PAKET = path.join(REPO, "abt-paket", "w2a-kebendaan");
const FOLDER = path.join(REPO, "ekstensi-sipp", "saksi-katalog");
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Mesin = require(path.join(REPO, "ekstensi-sipp", "saksi-katalog.js")) as any;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const KB = require(path.join(REPO, "aleta_bot", "services", "isiJawabanSaksiKebendaan.js")) as any;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Posita = require(path.join(REPO, "aleta_bot", "services", "isiJawabanSaksiPosita.js")) as any;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PositaLain = require(path.join(REPO, "aleta_bot", "services", "isiJawabanSaksiPositaLain.js")) as any;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Jawab = require(path.join(REPO, "aleta_bot", "services", "isiJawabanSaksi.js")) as any;

const baca = (...p: string[]) => readFileSync(path.join(...p), "utf8");
const json = (...p: string[]) => JSON.parse(baca(...p));
const KAMUS = process.env.ALETA_ABT_VARIABEL || "D:/Aplikasi/aleta/tmp/abt-variabel.json";
const variabelAda: Set<string> | null = existsSync(KAMUS) ? new Set(Object.keys(JSON.parse(readFileSync(KAMUS, "utf8")))) : null;

const JENIS = [
  { kunci: "wasiat", id: "365", target: 45, baru: 25 },
  { kunci: "hibah", id: "366", target: 45, baru: 25 },
  { kunci: "wakaf", id: "367", target: 45, baru: 25 },
  { kunci: "ekonomi-syariah", id: "370", target: 55, baru: 33 },
] as const;

const v1 = (k: string) => json(PAKET, "katalog-v1-k2", `${k}.json`);
const v2 = (k: string) => json(FOLDER, `${k}.json`);
const semuaKatalog = () =>
  Mesin.kenaliPaket
    ? (require("node:fs").readdirSync(FOLDER) as string[]).filter((n) => n.endsWith(".json")).sort().map((n) => json(FOLDER, n)).filter((k: any) => !k.contoh)
    : [];
const ids = (l: any[]) => l.map((x) => x.id) as string[];

// ---------------------------------------------------------------------------------------------------------------------
describe("A. katalog versi 2 memuat versi 1 utuh dan lebih lengkap", () => {
  for (const { kunci, target, baru } of JENIS) {
    const a = v1(kunci);
    const b = v2(kunci);

    it(`${kunci}: versi naik ke 2; pertanyaan, pokok, keadaan dan dasar hukum v1 tetap ada; butir v1 tidak berubah satu huruf pun`, () => {
      expect(a.versi).toBe(1);
      expect(b.versi).toBe(2);
      for (const x of ids(a.pertanyaan)) expect(ids(b.pertanyaan), x).toContain(x);
      for (const x of ids(a.pokokPembuktian)) expect(ids(b.pokokPembuktian), x).toContain(x);
      for (const x of ids(a.dasarHukum)) expect(ids(b.dasarHukum), x).toContain(x);
      for (const x of Object.keys(a.keadaan)) expect(Object.keys(b.keadaan), x).toContain(x);
      for (const q of a.pertanyaan) expect(JSON.stringify(b.pertanyaan.find((y: any) => y.id === q.id)), q.id).toBe(JSON.stringify(q));
      for (const p of a.pokokPembuktian) expect(JSON.stringify(b.pokokPembuktian.find((y: any) => y.id === p.id)), p.id).toBe(JSON.stringify(p));
      for (const d of a.dasarHukum) expect(JSON.stringify(b.dasarHukum.find((y: any) => y.id === d.id)), d.id).toBe(JSON.stringify(d));
      expect(JSON.stringify(b.jawabanUmum)).toBe(JSON.stringify(a.jawabanUmum));
      expect(b.syarat).toEqual(a.syarat);
    });

    it(`${kunci}: butir naik dari ${a.pertanyaan.length} ke sedikitnya ${target} (tambahan >= ${baru}) dan pokok serta keadaan bertambah`, () => {
      expect(b.pertanyaan.length).toBeGreaterThanOrEqual(target);
      expect(b.pertanyaan.length - a.pertanyaan.length).toBeGreaterThanOrEqual(baru);
      expect(b.pokokPembuktian.length).toBeGreaterThan(a.pokokPembuktian.length);
      expect(Object.keys(b.keadaan).length).toBeGreaterThan(Object.keys(a.keadaan).length);
      expect(b.profilSaksi && Object.keys(b.profilSaksi).length).toBeGreaterThanOrEqual(5);
    });

    it(`${kunci}: lolos periksaKatalog (tanpa galat; peringatan tidak bertambah dari v1) dan tanpa kata Aleta`, () => {
      const r1 = Mesin.periksaKatalog(a, { namaBerkas: `${kunci}.json`, variabelAda });
      const r2 = Mesin.periksaKatalog(b, { namaBerkas: `${kunci}.json`, variabelAda });
      expect(r2.galat).toEqual([]);
      expect(r2.peringatan.length).toBeLessThanOrEqual(r1.peringatan.length);
      expect(JSON.stringify(b)).not.toMatch(/aleta/i);
    });

    it(`${kunci}: tiap jawaban butir baru punya >= 4 kalimat saksi 1 dan saksi 2 yang berbeda, tanpa "ya, " dan "sayang"`, () => {
      const lama = new Set(ids(a.pertanyaan));
      const baruButir = b.pertanyaan.filter((q: any) => !lama.has(q.id));
      expect(baruButir.length).toBeGreaterThanOrEqual(baru);
      for (const q of baruButir) {
        const jenis = Object.keys(q.jawaban);
        expect(jenis, q.id).toContain("melihat");
        expect(jenis, q.id).toContain("de-auditu");
        if (!["identitas", "hubungan", "penutup"].includes(q.kelompok)) expect(jenis, q.id).toContain("berbeda");
        for (const [j, o] of Object.entries(q.jawaban) as [string, any][]) {
          for (const x of Array.isArray(o) ? o : [o]) {
            expect(x.saksi1.length, `${q.id}.${j}`).toBeGreaterThanOrEqual(4);
            expect(x.saksi2.length, `${q.id}.${j}`).toBeGreaterThanOrEqual(4);
            for (const k of [...x.saksi1, ...x.saksi2]) expect(/ya, |sayang/i.test(k), k).toBe(false);
            for (const k of x.saksi1) expect(x.saksi2, `${q.id}.${j}`).not.toContain(k);
          }
        }
        // penanda: hanya kode yang ada di kamus ABT atau dideklarasikan sebagai variabelBaru
        for (const kode of q.variabelAbt) expect(variabelAda === null || variabelAda.has(kode) || (b.variabelBaru || []).includes(kode), `${q.id} ${kode}`).toBe(true);
      }
    });

    it(`${kunci}: pokok wajib tetap punya pertanyaan dan semua pertanyaan menunjuk pokok yang ada`, () => {
      const pokok = new Set(ids(b.pokokPembuktian));
      for (const q of b.pertanyaan) expect(pokok.has(q.pokok), `${q.id} -> ${q.pokok}`).toBe(true);
      for (const p of b.pokokPembuktian.filter((x: any) => x.wajib)) expect(b.pertanyaan.some((q: any) => q.pokok === p.id), p.id).toBe(true);
    });

    it(`${kunci}: profil pengetahuan saksi mengacu pada butir, pokok atau kelompok yang ada dan jenisnya sah`, () => {
      const sah = new Set(["melihat", "mendengar", "de-auditu", "sebagian", "tidak-tahu", "ragu"]);
      const acuan = new Set([...ids(b.pertanyaan), ...ids(b.pokokPembuktian), "identitas", "hubungan", "pokok", "akibat", "upaya", "penutup", "*"]);
      for (const [nama, prof] of Object.entries<any>(b.profilSaksi)) {
        expect(prof.label.length, nama).toBeGreaterThan(5);
        expect(prof.peta["*"], nama).toBeTruthy();
        for (const [k, j] of Object.entries<string>(prof.peta)) {
          expect(acuan.has(k), `${nama}.${k}`).toBe(true);
          expect(sah.has(j), `${nama}.${k}=${j}`).toBe(true);
        }
      }
      // profil yang bertanda sumber memang menghasilkan de-auditu
      const dariCerita = Object.values<any>(b.profilSaksi).filter((p) => p.peta["*"] === "de-auditu");
      for (const p of dariCerita) expect(p.sumber).toBe(true);
    });
  }

  it("ekonomi syariah: variabel saksi BAS disamakan dengan berkas Derry di server dan berkas BAS saksi yang kurang ditambahkan", () => {
    const b = v2("ekonomi-syariah");
    const per = (nama: string) => b.blangkoBas.find((x: any) => x.berkas.startsWith(nama));
    expect(per("BAS ALUR 40 ES GS - [2] ").variabelSaksi).toEqual(["5058", "5059"]);
    expect(per("BAS ALUR 04 [6] ").variabelSaksi).toEqual(["5058", "5059"]);
    expect(per("BAS ALUR 04 [7] ").variabelSaksi).toEqual(["6120", "6121"]);
    for (const n of ["[6a]", "[6b]", "[6c]", "[7a]", "[7b]"]) expect(per(`BAS ALUR 04 ${n}`), n).toBeTruthy();
    expect(b.blangkoBas.length).toBeGreaterThan(v1("ekonomi-syariah").blangkoBas.length);
    // wasiat, hibah dan wakaf: daftar BAS saksi tidak berubah (sudah lengkap menurut server)
    for (const k of ["wasiat", "hibah", "wakaf"]) expect(v2(k).blangkoBas.length).toBe(v1(k).blangkoBas.length);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("B. butir baru hanya tampil pada keadaannya", () => {
  const aktif = (kunci: string, keadaan: Record<string, unknown>, pihak = "P", tingkat = ["inti", "pilihan", "tambahan", "jarang"]) => {
    const kat = v2(kunci);
    return Mesin.pertanyaanAktif(kat, Mesin.keadaanBawaan(kat, keadaan), pihak, { tingkat }).map((q: any) => q.id) as string[];
  };

  it("wasiat: bentuk wasiat, kondisi pewasiat, persetujuan, pencabutan, jenis benda, dalil cacat dan tuntutan tambahan memilih butir", () => {
    const dasar = aktif("wasiat", {});
    expect(dasar).toContain("q-ws-umur");
    expect(dasar).toContain("q-ws-tertulis-penulis"); // bawaan: tertulis
    expect(dasar).not.toContain("q-ws-lisan-ucapan");
    expect(dasar).not.toContain("q-ws-notaris-akta");
    expect(dasar).not.toContain("q-ws-wafat-sebelum");
    expect(dasar).toContain("q-ws-cabut-tidak");
    expect(dasar).not.toContain("q-ws-cabut-ada");
    expect(aktif("wasiat", { bentukWasiat: "lisan" })).toContain("q-ws-lisan-ucapan");
    expect(aktif("wasiat", { bentukWasiat: "lisan" })).not.toContain("q-ws-tertulis-ttd");
    expect(aktif("wasiat", { bentukWasiat: "akta-notaris" })).toContain("q-ws-notaris-nomor");
    expect(aktif("wasiat", { kondisiPewasiat: "sakit-menjelang-wafat" })).toContain("q-ws-sakit-wafat");
    expect(aktif("wasiat", { kondisiPewasiat: "akal-dipersoalkan" })).toContain("q-ws-akal-dipersoalkan");
    expect(aktif("wasiat", { persetujuan: "ada-yang-menolak" })).toContain("q-ws-setuju-tolak");
    expect(aktif("wasiat", { persetujuan: "ada-yang-menolak" })).not.toContain("q-ws-setuju-belum");
    expect(aktif("wasiat", { persetujuan: "belum-dimintai" })).toContain("q-ws-setuju-belum");
    expect(aktif("wasiat", { pencabutan: "dicabut" })).toContain("q-ws-cabut-ada");
    expect(aktif("wasiat", { pencabutan: "dicabut" })).not.toContain("q-ws-cabut-tidak");
    expect(aktif("wasiat", { jenisObjek: ["manfaat-hasil"] })).toContain("q-ws-manfaat-jangka");
    expect(aktif("wasiat", { penerima: "lembaga" })).toContain("q-ws-penerima-lembaga");
    expect(aktif("wasiat", { penerima: "ahli-waris" })).toContain("q-ws-penerima-ahliwaris");
    expect(aktif("wasiat", { dalilCacat: ["pewasiat-sudah-wafat", "tanda-tangan-dipalsukan"] })).toEqual(expect.arrayContaining(["q-ws-wafat-sebelum", "q-ws-ttd-asli"]));
    expect(aktif("wasiat", { dalilCacat: ["penerima-perawat"] })).toContain("q-ws-penerima-perawat");
    expect(aktif("wasiat", { tuntutanTambahan: ["ganti-rugi", "sita-jaminan"] })).toEqual(expect.arrayContaining(["q-ws-hasil-dikuasai", "q-ws-dialihkan"]));
    expect(aktif("wasiat", { pokokTuntutan: "G" })).toContain("q-ws-wajibah-pelihara");
    expect(dasar).not.toContain("q-ws-wajibah-pelihara");
  });

  it("hibah: bentuk hibah, penghibah wafat, sebab penarikan, persetujuan, dalil cacat dan permohonan memilih butir", () => {
    const dasar = aktif("hibah", {});
    expect(dasar).toContain("q-hb-umur");
    expect(dasar).toContain("q-hb-tertulis-ttd"); // bawaan: tertulis
    expect(dasar).not.toContain("q-hb-akta-ppat");
    expect(dasar).not.toContain("q-hb-pm-kedudukan"); // bawaan gugatan
    expect(dasar).not.toContain("q-hb-penghibah-wafat");
    expect(aktif("hibah", { bentukHibah: "akta-ppat" })).toContain("q-hb-akta-ppat");
    expect(aktif("hibah", { bentukHibah: "lisan" })).toContain("q-hb-ijab");
    expect(aktif("hibah", { statusPenghibah: "sudah-meninggal" })).toContain("q-hb-penghibah-wafat");
    expect(aktif("hibah", { kondisiPenghibah: "sakit-menjelang-wafat" })).toContain("q-hb-sakit");
    expect(aktif("hibah", { sebabTarik: ["menelantarkan-penghibah", "menjual-atau-menjaminkan-objek"] })).toEqual(expect.arrayContaining(["q-hb-tarik-menelantarkan", "q-hb-tarik-jual"]));
    expect(aktif("hibah", { persetujuan: "ada-yang-menolak" })).toContain("q-hb-setuju-tolak");
    expect(aktif("hibah", { jenisObjek: ["kendaraan", "uang-tabungan"] })).toEqual(expect.arrayContaining(["q-hb-objek-kendaraan", "q-hb-objek-uang"]));
    expect(aktif("hibah", { dalilCacat: ["objek-bukan-hak", "hibah-pura-pura"] })).toEqual(expect.arrayContaining(["q-hb-objek-bukan-hak", "q-hb-pura-pura"]));
    expect(aktif("hibah", { tuntutanTambahan: ["pengosongan"] })).toContain("q-hb-pengosongan");
    const pm = aktif("hibah", { perkara: "permohonan" });
    expect(pm).toEqual(expect.arrayContaining(["q-hb-pm-kedudukan", "q-hb-pm-tujuan", "q-hb-pm-dokumen"]));
  });

  it("wakaf: bentuk ikrar, nazhir, pendaftaran, dalil batal, pengalihan dan permohonan memilih butir", () => {
    const dasar = aktif("wakaf", {});
    expect(dasar).toContain("q-wk-umur");
    expect(dasar).toContain("q-wk-ikrar-ppaiw"); // bawaan: akta ikrar wakaf
    expect(dasar).not.toContain("q-wk-ikrar-ucapan");
    expect(dasar).toContain("q-wk-daftar-sudah");
    expect(dasar).not.toContain("q-wk-daftar-belum");
    expect(dasar).toContain("q-wk-wakif-wafat"); // bawaan: wakif sudah meninggal
    expect(aktif("wakaf", { bentukIkrar: "lisan" })).toContain("q-wk-ikrar-ucapan");
    expect(aktif("wakaf", { pendaftaranWakaf: "belum-terdaftar" })).toContain("q-wk-daftar-belum");
    expect(aktif("wakaf", { statusWakif: "masih-hidup" })).not.toContain("q-wk-wakif-wafat");
    expect(aktif("wakaf", { keadaanNazhir: ["belum-terdaftar", "tidak-amanah"] })).toEqual(expect.arrayContaining(["q-wk-nazhir-terdaftar", "q-wk-nazhir-lalai"]));
    expect(aktif("wakaf", { dalilBatal: ["ikrar-tanpa-akta", "tanpa-saksi", "bukan-milik-wakif"] })).toEqual(expect.arrayContaining(["q-wk-tanpa-akta", "q-wk-tanpa-saksi", "q-wk-bukan-milik"]));
    expect(aktif("wakaf", { bentukPengalihan: ["ganti-rugi-pemerintah"] })).toContain("q-wk-ganti-rugi");
    expect(aktif("wakaf", { pokokTuntutan: "D" })).toEqual(expect.arrayContaining(["q-wk-peruntukan-berubah", "q-wk-peruntukan-ahliwaris"]));
    expect(aktif("wakaf", { perkara: "permohonan" })).toEqual(expect.arrayContaining(["q-wk-pm-kedudukan", "q-wk-pm-dikenal-warga"]));
    expect(aktif("wakaf", { jenisHarta: ["uang"] })).toContain("q-wk-objek-uang");
  });

  it("ekonomi syariah: jenis akad, agunan, upaya penagihan, arbitrase, tuntutan tambahan dan gugatan sederhana memilih butir", () => {
    const dasar = aktif("ekonomi-syariah", {});
    expect(dasar).toContain("q-es-murabahah-harga"); // bawaan murabahah
    expect(dasar).not.toContain("q-es-ijarah-objek");
    expect(dasar).toContain("q-es-somasi-ada"); // bawaan: surat peringatan
    expect(dasar).not.toContain("q-es-kunjungan");
    expect(dasar).toContain("q-es-arbitrase-tidak");
    expect(dasar).not.toContain("q-es-arbitrase-ada");
    expect(dasar).not.toContain("q-es-gs-domisili");
    expect(aktif("ekonomi-syariah", { jenisAkad: "ijarah" })).toEqual(expect.arrayContaining(["q-es-ijarah-objek", "q-es-ijarah-pemakaian"]));
    expect(aktif("ekonomi-syariah", { jenisAkad: "ijarah" })).not.toContain("q-es-murabahah-harga");
    expect(aktif("ekonomi-syariah", { jenisAkad: "mudharabah" })).toContain("q-es-bagi-hasil-modal");
    expect(aktif("ekonomi-syariah", { jenisAkad: "musyarakah" })).toContain("q-es-bagi-hasil-laporan");
    expect(aktif("ekonomi-syariah", { jenisAkad: "rahn" })).toEqual(expect.arrayContaining(["q-es-rahn-barang", "q-es-rahn-jatuh-tempo"]));
    expect(aktif("ekonomi-syariah", { jenisAkad: "qardh" })).toContain("q-es-qardh-pokok");
    expect(aktif("ekonomi-syariah", { jenisAkad: "akad-lain" })).toContain("q-es-akad-lain");
    expect(aktif("ekonomi-syariah", { jaminan: "ada", jenisJaminan: ["tanah-bangunan", "penjamin-pribadi"] })).toEqual(expect.arrayContaining(["q-es-jaminan-tanah", "q-es-jaminan-pribadi", "q-es-pemilik-jaminan-setuju"]));
    expect(aktif("ekonomi-syariah", { jaminan: "ada", jenisJaminan: ["kendaraan-fidusia"] })).toContain("q-es-jaminan-fidusia");
    expect(aktif("ekonomi-syariah", { teguran: ["kunjungan-penagihan", "restrukturisasi"] })).toEqual(expect.arrayContaining(["q-es-kunjungan", "q-es-restrukturisasi"]));
    expect(aktif("ekonomi-syariah", { klausulaArbitrase: "ada" })).toContain("q-es-arbitrase-ada");
    expect(aktif("ekonomi-syariah", { klausulaArbitrase: "ada" })).not.toContain("q-es-arbitrase-tidak");
    expect(aktif("ekonomi-syariah", { acara: "gugatan-sederhana" })).toEqual(expect.arrayContaining(["q-es-gs-domisili", "q-es-gs-nilai"]));
    expect(aktif("ekonomi-syariah", { tuntutanTambahan: ["sita-jaminan", "lelang-agunan", "pengosongan", "uang-paksa", "serta-merta", "denda-ganti-rugi"] })).toEqual(
      expect.arrayContaining(["q-es-sita", "q-es-lelang", "q-es-pengosongan", "q-es-kemampuan-uang-paksa", "q-es-serta-merta", "q-es-denda"]),
    );
  });

  it("pokok wajib punya pertanyaan pada keadaan bawaan, verstek maupun kontradiktoir, untuk keempat jenis", () => {
    for (const { kunci } of JENIS) {
      const kat = v2(kunci);
      for (const kehadiran of ["verstek", "kontradiktoir", "t-tidak-hadir-setelah-mediasi"]) {
        const a = Mesin.pertanyaanAktif(kat, Mesin.keadaanBawaan(kat, { kehadiran }), "P", { tingkat: ["inti", "pilihan", "tambahan", "jarang"] });
        for (const p of kat.pokokPembuktian.filter((x: any) => x.wajib)) expect(a.some((q: any) => q.pokok === p.id), `${kunci} ${kehadiran} ${p.id}`).toBe(true);
      }
    }
  });
});

describe("B2. keadaan yang diturunkan sendiri oleh ekstensi (huruf pokok tuntutan dan alur perkara)", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require(path.join(REPO, "ekstensi-sipp", "saksi-susun.js"));
  const turun = (kunci: string, peta: [string, string][], alur: string) => (globalThis as any).AletaSaksiSusun.turunkanKeadaan(v2(kunci), { teks: "", peta: new Map(peta.map(([k, n]) => [k, { nilai: n }])), alur });

  it("huruf pokok tuntutan yang diisi petugas pada variabel ABT menjadi pilihan borang; huruf tidak sah atau ganda diabaikan", () => {
    expect(turun("wasiat", [["9475", "C"]], "15").pokokTuntutan).toBe("C");
    expect(turun("hibah", [["9790", "a"]], "15").pokokTuntutan).toBe("A");
    expect(turun("wakaf", [["9820", "D"]], "15").pokokTuntutan).toBe("D");
    expect(turun("wasiat", [["9475", "H"]], "15").pokokTuntutan).toBeUndefined();
    expect(turun("wasiat", [["9475", "AB"]], "15").pokokTuntutan).toBeUndefined();
    expect(turun("wasiat", [], "15").pokokTuntutan).toBeUndefined();
    // wakaf tidak membaca variabel hibah
    expect(turun("wakaf", [["9790", "B"]], "15").pokokTuntutan).toBeUndefined();
  });

  it("alur perkara SIPP menentukan gugatan atau permohonan (hibah, wakaf) dan gugatan sederhana atau acara biasa (ekonomi syariah)", () => {
    expect(turun("hibah", [], "16").perkara).toBe("permohonan");
    expect(turun("hibah", [], "15").perkara).toBe("gugatan");
    expect(turun("wakaf", [], "16").perkara).toBe("permohonan");
    expect(turun("ekonomi-syariah", [], "17").acara).toBe("gugatan-sederhana");
    expect(turun("ekonomi-syariah", [], "15").acara).toBe("acara-biasa");
    // tanpa alur tidak ada tebakan; wasiat tidak punya kunci perkara/acara
    expect(turun("hibah", [], "").perkara).toBeUndefined();
    expect(turun("ekonomi-syariah", [], "").acara).toBeUndefined();
    expect(turun("wasiat", [], "16").perkara).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("C. susunan 2-5 saksi tanpa jawaban kembar", () => {
  const KEADAAN: Record<string, Record<string, unknown>[]> = {
    wasiat: [{}, { bentukWasiat: "lisan", kondisiPewasiat: "sakit-menjelang-wafat" }, { bentukWasiat: "akta-notaris", persetujuan: "ada-yang-menolak", pencabutan: "dicabut" }, { jenisObjek: ["manfaat-hasil", "tanah-bangunan"], dalilCacat: ["pewasiat-sudah-wafat", "tanda-tangan-dipalsukan", "ada-tekanan", "penerima-berbuat-jahat", "penerima-perawat", "objek-musnah"], tuntutanTambahan: ["ganti-rugi", "sita-jaminan"], penerima: "lembaga" }, { pokokTuntutan: "G", penerima: "ahli-waris", persetujuan: "belum-dimintai" }],
    hibah: [{}, { bentukHibah: "lisan", statusPenghibah: "sudah-meninggal" }, { bentukHibah: "akta-ppat", sebabTarik: ["menelantarkan-penghibah", "menjual-atau-menjaminkan-objek", "tidak-sesuai-tujuan"], penerima: "anak-penghibah", pokokTuntutan: "G" }, { jenisObjek: ["tanah-bangunan", "kendaraan", "uang-tabungan"], dalilCacat: ["ada-paksaan", "tanda-tangan-dipalsukan", "objek-bukan-hak", "tanpa-saksi", "belum-diserahkan", "hibah-pura-pura"], tuntutanTambahan: ["ganti-rugi", "sita-jaminan", "pengosongan"], persetujuan: "ada-yang-menolak", kondisiPenghibah: "akal-dipersoalkan" }, { perkara: "permohonan" }],
    wakaf: [{}, { bentukIkrar: "lisan", statusWakif: "masih-hidup", kondisiWakif: "akal-dipersoalkan" }, { bentukIkrar: "tertulis", pendaftaranWakaf: "belum-terdaftar", keadaanNazhir: ["belum-terdaftar", "tidak-amanah", "sudah-meninggal"] }, { dalilBatal: ["ikrar-tanpa-akta", "tanpa-saksi", "bukan-milik-wakif", "tanda-tangan-dipalsukan"], bentukPengalihan: ["dijual-dihibahkan", "dijaminkan", "ganti-rugi-pemerintah"], jenisHarta: ["tanah-bangunan", "benda-bergerak", "uang"], tuntutanTambahan: ["ganti-rugi", "sita-jaminan", "pengosongan"], pokokTuntutan: "D" }, { perkara: "permohonan" }],
    "ekonomi-syariah": [{}, { jenisAkad: "ijarah", acara: "gugatan-sederhana" }, { jenisAkad: "mudharabah", jaminan: "ada", jenisJaminan: ["tanah-bangunan", "kendaraan-fidusia", "penjamin-pribadi"], teguran: ["surat-peringatan", "kunjungan-penagihan", "restrukturisasi"] }, { jenisAkad: "rahn", klausulaArbitrase: "ada", tuntutanTambahan: ["denda-ganti-rugi", "sita-jaminan", "lelang-agunan", "pengosongan", "uang-paksa", "serta-merta"] }, { jenisAkad: "qardh" }, { jenisAkad: "akad-lain" }],
  };

  for (const { kunci } of JENIS) {
    it(`${kunci}: semua keadaan x 2-5 saksi x jenis keterangan x profil menghasilkan kalimat utuh, tanpa kurawal, tanpa "ya, " dan tanpa jawaban kembar`, () => {
      const kat = v2(kunci);
      const profil = Object.keys(kat.profilSaksi).map((p) => `profil:${p}`);
      let baris = 0;
      for (const keadaan of KEADAAN[kunci]) {
        for (const jumlah of [2, 3, 4, 5]) {
          for (const jenis of ["melihat", "mendengar", "de-auditu", "sebagian", "tidak-tahu", "ragu", "berbeda", ...profil]) {
            const saksi = Array.from({ length: jumlah }, (_, i) => ({
              pihak: "P",
              jenis: i === 0 || jenis !== "berbeda" ? jenis : "melihat",
              berbeda: jenis === "berbeda" ? kat.pertanyaan.map((q: any) => q.id) : [],
            }));
            const r = Mesin.susunSaksi(kat, { keadaan, benih: "123/Pdt.G/2026/PA.Dgl", saksi, variabel: (k: string) => `{{${k}}}`, slot: { hubungan: "tetangga" } });
            const per = new Map<string, Set<string>>();
            for (const s of r.saksi) {
              for (const b of s.baris) {
                baris += 1;
                expect(b.jawab, `${kunci} ${b.butir}`).toBeTruthy();
                expect(/ya, |sayang/i.test(b.jawab), b.jawab).toBe(false);
                expect(/\{[a-z]+\}/.test(b.jawab.replace(/\{\{\d{4}\}\}/g, "")), b.jawab).toBe(false);
                if (b.butir.includes("penutup")) continue;
                const norm = b.jawab.toLowerCase().replace(/[^a-z0-9#{} ]/g, " ").replace(/\s+/g, " ").trim();
                const sudah = per.get(b.butir) ?? new Set<string>();
                if (b.jenis !== "melihat") expect(sudah.has(norm), `kembar ${b.butir}: ${b.jawab}`).toBe(false);
                sudah.add(norm);
                per.set(b.butir, sudah);
              }
            }
          }
        }
      }
      expect(baris).toBeGreaterThan(2500);
    });
  }

  it("profil pengetahuan saksi mengubah jenis keterangan butir sesuai petanya", () => {
    const kat = v2("wasiat");
    const susun = (jenis: string) => Mesin.susunSaksi(kat, { keadaan: {}, benih: "9/Pdt.G/2026/PA.Dgl", saksi: [{ pihak: "P", jenis }, { pihak: "P", jenis }], variabel: (k: string) => `{{${k}}}`, slot: { hubungan: "tetangga" } });
    const ragu = susun("profil:ragu").saksi[0].baris;
    const butirRagu = ragu.filter((b: any) => b.jenis === "ragu").length;
    expect(butirRagu).toBeGreaterThan(10);
    expect(ragu.find((b: any) => b.butir === "q-kenal").jenis).toBe("melihat");
    const sebagian = susun("profil:tahu-sebagian-wasiat").saksi[0].baris;
    expect(sebagian.filter((b: any) => b.jenis === "sebagian").length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("D. katalog tambahan saksi Tergugat", () => {
  const katalog = semuaKatalog();
  const PAKET_T = [
    { utama: "wasiat", id: "365", tambahan: "wasiat-tergugat", jumlah: 7 },
    { utama: "hibah", id: "366", tambahan: "hibah-tergugat", jumlah: 8 },
    { utama: "wakaf", id: "367", tambahan: "wakaf-tergugat", jumlah: 7 },
    { utama: "ekonomi-syariah", id: "370", tambahan: "ekonomi-syariah-tergugat", jumlah: 8 },
  ];

  for (const { utama, id, tambahan, jumlah } of PAKET_T) {
    it(`${tambahan}: menempel pada ${utama}, lolos skema, tidak berdiri sendiri, ${jumlah} butir untuk saksi T yang menggantikan butir utama yang ada`, () => {
      const t = katalog.find((k: any) => k.kunci === tambahan);
      expect(t.tambahanUntuk).toEqual([utama]);
      expect(t.pertanyaan.length).toBe(jumlah);
      expect(Mesin.periksaKatalog(t, { namaBerkas: `${tambahan}.json`, variabelAda }).galat).toEqual([]);
      expect(JSON.stringify(t)).not.toMatch(/aleta/i);
      for (const d of t.dasarHukum) expect(d.status).toBe("terverifikasi");
      const utamaIds = new Set(ids(v2(utama).pertanyaan));
      for (const q of t.pertanyaan) {
        expect(q.pihakSaksi).toEqual(["T"]);
        expect(q.menggantikan.length).toBeGreaterThan(0);
        for (const g of q.menggantikan) expect(utamaIds.has(g), `${q.id} menggantikan ${g}`).toBe(true);
        expect(Object.keys(q.jawaban)).toEqual(expect.arrayContaining(["melihat", "de-auditu", "berbeda"]));
      }
      // tidak berdiri sendiri: katalog utama tetap yang dikenali, paketnya memuat butir T
      expect(Mesin.kenaliKatalog(katalog, { jenisPerkaraId: id, alurPerkaraId: "15" }).kunci).toBe(utama);
      const paket = Mesin.kenaliPaket(katalog, { jenisPerkaraId: id, alurPerkaraId: "15" });
      expect(paket.pertanyaan.filter((q: any) => String(q.id).startsWith("q-tg-")).length).toBe(jumlah);
      expect(Mesin.periksaKatalog(paket, { variabelAda }).galat).toEqual([]);
    });
  }

  it("saksi pengaju tidak berubah oleh katalog tambahan; saksi Tergugat dengan bantahan mendapat butir pengganti dan kehilangan butir yang digantikan", () => {
    const hasil: string[] = [];
    for (const { utama, id, tambahan } of PAKET_T) {
      const paket = Mesin.kenaliPaket(katalog, { jenisPerkaraId: id, alurPerkaraId: "15" });
      const polos = v2(utama);
      const t = katalog.find((k: any) => k.kunci === tambahan);
      const semuaBantahan = Object.values<any>(t.keadaan.bantahan.nilai) as string[];
      const keadaan = utama === "ekonomi-syariah" ? { jenisAkad: "murabahah", jaminan: "ada", jenisJaminan: ["tanah-bangunan"], teguran: ["surat-peringatan", "kunjungan-penagihan"], tuntutanTambahan: ["denda-ganti-rugi"] } : {};
      const susun = (kat: any, pihak: string, bantahan: string[]) => Mesin.susunSaksi(kat, { keadaan: { kehadiran: "kontradiktoir", ...keadaan, bantahan }, benih: "5/Pdt.G/2026/PA.Dgl", saksi: [{ pihak, jenis: "melihat" }, { pihak, jenis: "melihat" }], variabel: (k: string) => `{{${k}}}` });
      const pengajuDenganTambahan = susun(paket, "P", semuaBantahan).saksi[0].baris.map((b: any) => b.butir);
      const pengajuTanpa = susun(polos, "P", []).saksi[0].baris.map((b: any) => b.butir);
      expect(pengajuDenganTambahan.filter((x: string) => x.startsWith("q-tg-"))).toEqual([]);
      expect(pengajuDenganTambahan).toEqual(pengajuTanpa);
      const tanpaBantahan = susun(paket, "T", []).saksi[0].baris.map((b: any) => b.butir);
      expect(tanpaBantahan.filter((x: string) => x.startsWith("q-tg-"))).toEqual([]);
      const dengan = susun(paket, "T", semuaBantahan).saksi[0].baris.map((b: any) => b.butir) as string[];
      const tg = dengan.filter((x) => x.startsWith("q-tg-"));
      expect(tg.length).toBeGreaterThanOrEqual(4);
      for (const q of t.pertanyaan) if (tg.includes(q.id)) for (const g of q.menggantikan) expect(dengan, `${q.id} -> ${g}`).not.toContain(g);
      hasil.push(`${tambahan}:${tg.length}`);
    }
    expect(hasil.length).toBe(4);
  });

  it("tiap butir Tergugat menghasilkan kalimat utuh dan berbeda untuk 2-5 saksi pada semua jenis keterangan", () => {
    for (const { utama, id, tambahan } of PAKET_T) {
      const paket = Mesin.kenaliPaket(katalog, { jenisPerkaraId: id, alurPerkaraId: "15" });
      const t = katalog.find((k: any) => k.kunci === tambahan);
      const semuaBantahan = Object.values<any>(t.keadaan.bantahan.nilai) as string[];
      for (const jumlah of [2, 3, 4, 5]) {
        for (const jenis of ["melihat", "mendengar", "de-auditu", "sebagian", "tidak-tahu", "ragu"]) {
          const r = Mesin.susunSaksi(paket, { keadaan: { kehadiran: "kontradiktoir", bantahan: semuaBantahan }, benih: "8/Pdt.G/2026/PA.Dgl", saksi: Array.from({ length: jumlah }, () => ({ pihak: "T", jenis })), variabel: (k: string) => `{{${k}}}` });
          const per = new Map<string, string[]>();
          r.saksi.forEach((s: any) => s.baris.forEach((b: any) => {
            if (!String(b.butir).startsWith("q-tg-")) return;
            expect(b.jawab.trim().length, `${utama} ${b.butir}`).toBeGreaterThan(5);
            per.set(b.butir, [...(per.get(b.butir) ?? []), Mesin.rapikan(b.jawab)]);
          }));
          expect(per.size, `${utama} ${jumlah} ${jenis}`).toBeGreaterThanOrEqual(4);
          for (const [butir, j] of per) expect(new Set(j).size, `${utama} ${jumlah} saksi ${jenis} ${butir}`).toBe(j.length);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("E. pendeteksi posita wasiat, hibah, wakaf dan ekonomi syariah (fixture dari pola gugatan nyata)", () => {
  // Wasiat: pola gugatan nyata 687/Pdt.G/2025/PA.Dgl (surat wasiat 2011 yang dipersoalkan), nama diganti.
  const WASIAT =
    "1. Bahwa Almarhum Pasisi dan Almarhumah Kawi telah melangsungkan perkawinan secara sah. " +
    "3. Bahwa yang menjadi objek perkara dalam gugatan a quo adalah Surat wasiat tertanggal 27 Juli 2011 dan harta peninggalan milik dari Almarhumah Nasia yang meninggal pada tahun 2016 (Pemberi Wasiat), yang isi surat wasiat tersebut memberikan hak penuh pengelolaan harta kepada keturunan dari Almarhum Kamaruzaman (Tergugat I – VII) ;\n" +
    "5. Bahwa Surat Wasiat tersebut mengandung ketidakwajaran sebab Almarhumah Sulusia meninggal dunia pada tahun 1984, yakni 27 tahun sebelum tanggal pembuatan surat wasiat ;\n" +
    "7. bahwa surat wasiat tersebut juga cacat materiil, karena melebihi 1/3 harta, diberikan kepada ahli waris tanpa persetujuan seluruh ahli waris, serta tidak dibuat di depan Notaris ;\n" +
    "11. Bahwa harta warisan yang dikuasai oleh Para Tergugat dalam surat wasiat antara lain:\n" +
    "a. Tanah sawah yang terletak di Dusun III, Desa Kaleke, Kabupaten Sigi.\n" +
    "b. Tanah sawah yang terletak di Desa Sibonu, Kabupaten Sigi.\n" +
    "c. 1 (satu) buah rumah yang terletak di Desa Pewunu, Kabupaten Sigi.\n" +
    "d. 2 (dua) buah kalung emas dan 1 (satu) buah gelang emas.\n" +
    "14. Bahwa Penggugat memohon sita jaminan (conservatoir beslag) atas harta peninggalan tersebut.";
  const WASIAT_PETITUM = "Menyatakan bahwa Surat Wasiat tertanggal 27 Juli 2011 tidak sah ; Menyatakan sah dan berharga sita jaminan ; Menghukum Para Tergugat membayar ganti kerugian ; Menghukum Para Tergugat membayar uang paksa (dwangsom) ;";

  // Ekonomi syariah gugatan sederhana: pola 1/Pdt.G.S/2025/PA.Dgl (murabahah, agunan sertifikat, tiga surat peringatan), nama dan nomor diganti.
  const ES =
    "Bahwa pada hari Rabu tanggal 18 Desember 2019 PENGGUGAT memberikan fasilitas pembiayaan kepada TERGUGAT dengan Harga Beli sebesar Rp 45.000.000,00 ditambah dengan margin keuntungan sebesar Rp 30.456.000,00 sehingga Harga Jual seluruhnya menjadi Rp 75.456.000,00 dengan jangka waktu pembiayaan selama 36 (Tiga Puluh Enam) bulan sebagaimana tertuang dalam Akad Jual Beli Murabahah Nomor: 025/ULS-XYZ/PP-MRB/XII/2019 tanggal 18 Desember 2019 ;\n" +
    "Bahwa untuk menjamin pembayaran TERGUGAT menyerahkan Agunan berupa sebidang tanah dan bangunan berdasarkan Sertifikat Hak Milik Nomor 00623/Desa Contoh 02 Juli 2018 seluas 197 m2 terdaftar atas nama PEMILIK yang dalam hal ini pihak lain telah setuju ;\n" +
    "Bahwa TERGUGAT tidak membayar angsuran sesuai apa yang diperjanjikan yaitu membayar angsuran setiap tanggal 02 (Dua) bulan berjalan sehingga menjadi kredit macet ;\n" +
    "Bahwa PENGGUGAT telah memberikan Surat Peringatan sebanyak 3 (tiga) kali dengan nomor surat sebagai berikut :\n" +
    "Surat Nomor : 248/ULS-XYZ/SP-1/I/2023 tanggal 04 Oktober 2023 perihal Surat Peringatan I;\n" +
    "Surat Nomor : 263/ULM-XYZ/SP2/XII/2023 tanggal 21 Desember 2023 Perihal Surat Peringatan II;\n" +
    "Bahwa PENGGUGAT menderita kerugian sebesar Rp. 75.166.250 (Tujuh Puluh Lima Juta) dengan rincian Outstanding dan Denda ;";
  const ES_PETITUM = "Menghukum TERGUGAT membayar lunas sebesar Rp. 75.166.250 ; menyatakan sah dan berharga Sita Jaminan (Conservatoir Beslag) atas agunan ; dilelang melalui KPKNL ; Memerintahkan TERGUGAT mengosongkan obyek agunan ; Menghukum TERGUGAT membayar uang paksa (dwangsom) Rp. 500.000 setiap hari ; putusan serta merta (Uit voerbaar bij voraad) ; denda keterlambatan ;";

  // Wakaf: pola 314/Pdt.G/2022/PA.Buk (gugatan ahli waris wakif terhadap ikrar wakaf), nama diganti.
  const WAKAF =
    "1. Bahwa Kepala Urusan Agama Kecamatan Contoh selaku Pejabat Pembuat Akta Ikrar Wakaf (PPAIW), telah menerbitkan Akta Ikrar Wakaf tertanggal 2 Oktober 2004 dengan Wakif bernama Mahjun dan Nadzir adalah Moh. Nasir,Amd (Tergugat I).\n" +
    "2. Bahwa Wakif Mahjun telah mewakafkan sebidang tanah kepada Nadzir untuk keperluan Pembangunan Madrasah Aliyah. Tanah tersebut terletak di Desa Ipi.\n" +
    "3. Bahwa Wakif (Alm. Mahjun) meninggal dunia pada tanggal 19 pebruari 2016 dan meninggalkan ahli waris.\n" +
    "4. Bahwa dalam menjalankan tugas Nadzir tidak didaftar pada kantor urusan agama kecamatan.\n" +
    "5. Bahwa proses perwakafan ternyata hanya didasarkan pada surat wakaf dibawah tangan bukan akta otentik karena tidak memiliki nomor ikrar wakaf.\n" +
    "6. Bahwa tanah wakaf tersebut sudah dilakukan ganti rugi oleh pemerintah kabupaten.";

  // Hibah: TIDAK ada contoh nyata (0 perkara hibah di PA Donggala dan PA Bungku); fixture dari pola gugatan hibah orang tua kepada anak.
  const HIBAH =
    "1. Bahwa Almarhum Hasan bin Umar menghibahkan sebidang tanah beserta rumah di atasnya kepada Tergugat yaitu anak kandungnya Ridwan bin Hasan secara lisan pada tanggal 3 Maret 2015 di hadapan dua orang saksi.\n" +
    "2. Bahwa setelah menerima hibah Tergugat menelantarkan orang tuanya dan menjual sebagian tanah itu.\n" +
    "3. Bahwa ahli waris tidak menyetujui hibah itu karena penghibah sedang sakit menjelang meninggal.";

  const faktaDari = (posita: string, jenis: string) => {
    const hasil = Posita.positaTambahan(posita, jenis) as any[];
    return Object.fromEntries(hasil.map((x) => [x.kunci, x]));
  };

  it("wasiat: bentuk dan tanggal, daftar objek dan penerima terbaca dari bunyi gugatan; semua berkeyakinan ragu", () => {
    const f = faktaDari(WASIAT, "wasiat");
    expect(f.bentukWasiat.nilai).toBe("secara tertulis tertanggal 27 Juli 2011");
    expect(f.objekWasiat.nilai).toContain("Tanah sawah yang terletak di Dusun III");
    expect(f.objekWasiat.nilai).toContain("kalung emas");
    expect(f.objekWasiat.nilai.split("; ").length).toBe(4);
    expect(f.penerimaWasiat.nilai).toBe("keturunan dari Almarhum Kamaruzaman");
    for (const k of ["bentukWasiat", "objekWasiat", "penerimaWasiat"]) expect(f[k].yakin).toBe("ragu");
  });

  it("wasiat: kalimat yang menyangkal akta Notaris tidak dibaca sebagai akta; tanpa tanggal tidak ada bentuk", () => {
    expect(faktaDari(WASIAT, "wasiat").bentukWasiat.nilai).not.toMatch(/akta/i);
    expect(faktaDari("Bahwa Pewasiat membuat wasiat secara lisan di depan dua orang saksi pada tanggal 5 Mei 2019.", "wasiat").bentukWasiat.nilai).toBe("secara lisan pada tanggal 5 Mei 2019");
    expect(faktaDari("Bahwa pewasiat membuat wasiat dengan Akta Notaris Nomor 12 tanggal 3 Januari 2018.", "wasiat").bentukWasiat.nilai).toBe("dengan akta Notaris Nomor 12 tanggal 3 Januari 2018");
    expect(faktaDari("Bahwa para pihak adalah ahli waris.", "wasiat").bentukWasiat).toBeUndefined();
    expect(Posita.positaTambahan("", "wasiat")).toEqual([]);
  });

  it("ekonomi syariah: akad berjenis ganda, rincian pembiayaan, jatuh tempo, daftar surat peringatan, agunan dan jumlah kewajiban", () => {
    const f = faktaDari(ES, "eksyar");
    expect(f.akad.nilai).toBe("Akad Jual Beli Murabahah Nomor 025/ULS-XYZ/PP-MRB/XII/2019 tanggal 18 Desember 2019");
    expect(f.rincianPembiayaan.nilai).toBe("harga beli Rp45.000.000,00, margin Rp30.456.000,00, harga jual Rp75.456.000,00 dan jangka waktu 36 bulan");
    expect(f.angsuranJatuhTempo.nilai).toBe("jatuh tempo setiap tanggal 02");
    expect(f.suratPeringatan.nilai).toBe("Surat Nomor 248/ULS-XYZ/SP-1/I/2023 tanggal 04 Oktober 2023 (Surat Peringatan I); Surat Nomor 263/ULM-XYZ/SP2/XII/2023 tanggal 21 Desember 2023 (Surat Peringatan II)");
    expect(f.agunan.nilai).toBe("Sertifikat Hak Milik Nomor 00623/Desa Contoh 02 Juli 2018 seluas 197 m2 terdaftar atas nama PEMILIK");
    expect(f.jumlahUtang.nilai).toBe("75.166.250");
    for (const x of Object.values<any>(f)) expect(x.yakin).toBe("ragu");
  });

  it("wakaf: nazhir bernama dibaca (bukan kata 'Nadzir'), wakif tanpa kata 'Wakif', bentuk ikrar dengan tanggal", () => {
    const f = faktaDari(WAKAF, "wakaf");
    expect(f.wakif.nilai).toBe("Mahjun");
    expect(f.nazhir.nilai).toBe("Moh. Nasir,Amd");
    expect(f.bentukIkrar.nilai).toBe("dengan Akta Ikrar Wakaf tanggal 2 Oktober 2004");
    expect(f.hartaWakaf.nilai).toBe("sebidang tanah");
    // tanpa nama nazhir yang tertulis, fakta nazhir tidak dikarang
    const tanpa = faktaDari("Bahwa Wakif bernama Mahjun telah mewakafkan sebidang tanah kepada Nadzir untuk keperluan masjid.", "wakaf");
    expect(tanpa.nazhir).toBeUndefined();
  });

  it("hibah: bentuk hibah lisan dengan tanggal dan penerima hibah dibaca; penghibah dan benda tetap dari pola lama", () => {
    const f = faktaDari(HIBAH, "hibah");
    expect(f.bentukHibah.nilai).toBe("secara lisan pada tanggal 3 Maret 2015");
    expect(f.penerimaHibah.nilai).toContain("Tergugat");
    expect(f.penghibah.nilai).toContain("Hasan bin Umar");
    expect(faktaDari("Bahwa Penggugat tinggal di Donggala.", "hibah").bentukHibah).toBeUndefined();
  });

  it("saran keadaan dari posita dan petitum: hanya yang tertulis, semuanya ragu", () => {
    const eks = KB.saranKeadaan(ES, ES_PETITUM, "eksyar", { alur: "17" });
    const ada = (daftar: any[], kunci: string, nilai: string) => daftar.some((x) => x.kunci === kunci && x.nilai === nilai);
    expect(ada(eks, "acara", "gugatan-sederhana")).toBe(true);
    expect(ada(eks, "jenisAkad", "murabahah")).toBe(true);
    expect(ada(eks, "jenisJaminan", "tanah-bangunan")).toBe(true);
    expect(ada(eks, "teguran", "surat-peringatan")).toBe(true);
    for (const n of ["sita-jaminan", "lelang-agunan", "pengosongan", "uang-paksa", "serta-merta", "denda-ganti-rugi"]) expect(ada(eks, "tuntutanTambahan", n), n).toBe(true);
    // konsisten dengan pembaca petitum berbutir milik U6: jenis tuntutan yang dikenalnya ada pula pada saran
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PB = require(path.join(REPO, "aleta_bot", "services", "petitumBerbutir.js")) as any;
    const jenisAda = PB.petitumBerbutir(ES_PETITUM, { jenis: "eksyar" }).jenisAda as Record<string, number>;
    expect(jenisAda.sita).toBeGreaterThan(0);
    expect(jenisAda["serta-merta"]).toBeGreaterThan(0);
    expect(ada(eks, "tuntutanTambahan", "sita-jaminan")).toBe(true);
    expect(ada(eks, "tuntutanTambahan", "serta-merta")).toBe(true);
    expect(ada(eks, "klausulaArbitrase", "ada")).toBe(false);
    expect(ada(eks, "jenisJaminan", "kendaraan-fidusia")).toBe(false);
    const was = KB.saranKeadaan(WASIAT, WASIAT_PETITUM, "wasiat");
    expect(ada(was, "bentukWasiat", "tertulis")).toBe(true);
    expect(ada(was, "bentukWasiat", "akta-notaris")).toBe(false);
    expect(ada(was, "dalilCacat", "pewasiat-sudah-wafat")).toBe(true);
    expect(ada(was, "dalilCacat", "objek-musnah")).toBe(false);
    expect(ada(was, "persetujuan", "ada-yang-menolak")).toBe(true);
    expect(ada(was, "pencabutan", "dicabut")).toBe(false);
    for (const n of ["ganti-rugi", "sita-jaminan", "uang-paksa"]) expect(ada(was, "tuntutanTambahan", n), n).toBe(true);
    const wak = KB.saranKeadaan(WAKAF, "", "wakaf");
    expect(ada(wak, "bentukIkrar", "akta-ikrar-wakaf")).toBe(true);
    expect(ada(wak, "statusWakif", "sudah-meninggal")).toBe(true);
    expect(ada(wak, "keadaanNazhir", "belum-terdaftar")).toBe(true);
    expect(ada(wak, "dalilBatal", "ikrar-tanpa-akta")).toBe(true);
    expect(ada(wak, "bentukPengalihan", "ganti-rugi-pemerintah")).toBe(true);
    const hib = KB.saranKeadaan(HIBAH, "", "hibah");
    expect(ada(hib, "bentukHibah", "lisan")).toBe(true);
    expect(ada(hib, "statusPenghibah", "sudah-meninggal")).toBe(true);
    expect(ada(hib, "sebabTarik", "menelantarkan-penghibah")).toBe(true);
    expect(ada(hib, "sebabTarik", "menjual-atau-menjaminkan-objek")).toBe(true);
    expect(ada(hib, "persetujuan", "ada-yang-menolak")).toBe(true);
    for (const x of [...eks, ...was, ...wak, ...hib]) {
      expect(x.yakin).toBe("ragu");
      expect(x.sumber).toBe("gugatan");
    }
    expect(KB.saranKeadaan("", "", "wasiat")).toEqual([]);
    expect(KB.saranKeadaan("Bahwa Penggugat tinggal di Donggala.", "", "hibah")).toEqual([]);
  });

  it("saran keadaan yang dipakai adalah nilai yang SAH menurut katalog (kunci dan nilai ada di keadaan katalog)", () => {
    const peta: Record<string, [string, string, string]> = { wasiat: ["wasiat", WASIAT, WASIAT_PETITUM], eksyar: ["ekonomi-syariah", ES, ES_PETITUM], wakaf: ["wakaf", WAKAF, ""], hibah: ["hibah", HIBAH, ""] };
    for (const [jenis, [kunci, posita, petitum]] of Object.entries(peta)) {
      const kat = v2(kunci);
      for (const s of KB.saranKeadaan(posita, petitum, jenis, { alur: "17" })) {
        expect(kat.keadaan[s.kunci], `${kunci}.${s.kunci}`).toBeTruthy();
        expect(kat.keadaan[s.kunci].nilai, `${kunci}.${s.kunci}=${s.nilai}`).toContain(s.nilai);
      }
    }
  });

  it("variabel ABT terisi dari gugatan bersumber dan berkeyakinan ragu; isian petugas tidak ditimpa", () => {
    const tambahan = Posita.positaTambahan(ES, "eksyar");
    const fakta = Jawab.bangunFakta({ isian: {}, tambahan, sebutan: { P: "Penggugat", T: "Tergugat" } });
    const ctx = { jenis: "eksyar", P: "Penggugat", T: "Tergugat" };
    const rincian = Jawab.nilaiVariabel("4765", fakta, ctx);
    expect(rincian.teks).toContain("harga beli Rp45.000.000,00");
    expect(rincian.yakin).toBe("ragu");
    expect(Jawab.nilaiVariabel("9340", fakta, ctx).teks).toContain("Murabahah");
    expect(Jawab.nilaiVariabel("4767", fakta, ctx).teks).toContain("Surat Peringatan I");
    expect(Jawab.nilaiVariabel("4768", fakta, ctx).teks).toContain("Sertifikat Hak Milik");
    // isian petugas menang atas gugatan dan berkeyakinan pasti/yakin
    const dengan = Jawab.bangunFakta({ isian: { 4765: "plafon Rp100.000.000,00 dan jangka waktu 24 bulan", 9793: "Hasan bin Umar" }, tambahan, sebutan: { P: "Penggugat", T: "Tergugat" } });
    const r = Jawab.nilaiVariabel("4765", dengan, ctx);
    expect(r.teks).toBe("plafon Rp100.000.000,00 dan jangka waktu 24 bulan");
    const hanyaIsian = Jawab.bangunFakta({ isian: { 4765: "plafon Rp100.000.000,00 dan jangka waktu 24 bulan" }, tambahan: [], sebutan: { P: "Penggugat", T: "Tergugat" } });
    expect(Jawab.nilaiVariabel("4765", hanyaIsian, ctx).yakin).not.toBe("ragu");
    expect(Jawab.nilaiVariabel("9793", dengan, { jenis: "hibah", P: "Penggugat", T: "Tergugat" }).teks).toBe("Hasan bin Umar");
    // wasiat dan wakaf
    const fw = Jawab.bangunFakta({ isian: {}, tambahan: Posita.positaTambahan(WASIAT, "wasiat"), sebutan: { P: "Penggugat", T: "Tergugat" } });
    expect(Jawab.nilaiVariabel("9478", fw, { jenis: "wasiat", P: "Penggugat", T: "Tergugat" }).teks).toBe("secara tertulis tertanggal 27 Juli 2011");
    const fk = Jawab.bangunFakta({ isian: {}, tambahan: Posita.positaTambahan(WAKAF, "wakaf"), sebutan: { P: "Penggugat", T: "Tergugat" } });
    expect(Jawab.nilaiVariabel("9825", fk, { jenis: "wakaf", P: "Penggugat", T: "Tergugat" }).teks).toContain("2 Oktober 2004");
    expect(Jawab.nilaiVariabel("9824", fk, { jenis: "wakaf", P: "Penggugat", T: "Tergugat" }).teks).toBe("Moh. Nasir,Amd");
  });

  it("aturan otomatisasi berdasar: modul pendeteksi tidak pernah memberi keyakinan pasti atau cukup", () => {
    const sumber = baca(REPO, "aleta_bot", "services", "isiJawabanSaksiKebendaan.js");
    expect(sumber).not.toMatch(/yakin:\s*"(?:pasti|cukup)"/);
    const semua = [...PositaLain.positaLain(ES.split("\n"), "eksyar"), ...PositaLain.positaLain(WASIAT.split("\n"), "wasiat"), ...PositaLain.positaLain(WAKAF.split("\n"), "wakaf"), ...PositaLain.positaLain(HIBAH.split("\n"), "hibah")];
    expect(semua.length).toBeGreaterThan(15);
    for (const x of semua) expect(x.yakin, x.kunci).toBe("ragu");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("F. berkas untuk sesi utama dan data ekstensi", () => {
  it("variabel baru yang diminta: hanya jatah 4765-4779, tipe data_teks, tanpa kata Aleta, dan semuanya dipakai katalog", () => {
    const vars = json(PAKET, "untuk-sesi-utama", "variabel-katalog-k2.json") as any[];
    expect(vars.length).toBeGreaterThan(0);
    const pakai = JSON.stringify(v2("ekonomi-syariah"));
    for (const x of vars) {
      expect(Number(x.no)).toBeGreaterThanOrEqual(4765);
      expect(Number(x.no)).toBeLessThanOrEqual(4779);
      expect(x.tipe).toBe("data_teks");
      expect(x.nama.length).toBeLessThan(260);
      expect(JSON.stringify(x)).not.toMatch(/aleta/i);
      expect(pakai).toContain(`#${x.no}#`);
    }
    // semua kode di jatah yang dipakai katalog (mana pun) dideklarasikan di variabelBaru dan didefinisikan di berkas ini
    for (const { kunci } of JENIS) {
      const kat = v2(kunci);
      const kode = new Set<string>(JSON.stringify(kat).match(/#47(?:6[5-9]|7\d)#/g)?.map((x) => x.slice(1, 5)) ?? []);
      for (const k of kode) {
        expect(kat.variabelBaru, `${kunci} ${k}`).toContain(k);
        expect(vars.some((x) => x.no === k), k).toBe(true);
      }
    }
  });

  it("peta fakta tambahan: tiap kode tepat satu fakta dan tidak bentrok dengan peta bersama bila sudah ada", () => {
    const tambah = json(PAKET, "untuk-sesi-utama", "peta-fakta-tambahan-k2.json");
    const kodeSemua: string[] = Object.values<any>(tambah.fakta).flatMap((f) => f.kode);
    expect(new Set(kodeSemua).size).toBe(kodeSemua.length);
    const berkasPeta = path.join(REPO, "aleta_bot", "config", "peta-fakta-variabel.json");
    const peta = json(berkasPeta);
    const pemilik = new Map<string, string[]>();
    for (const [nama, f] of Object.entries<any>(peta.fakta)) for (const c of f.kode) pemilik.set(typeof c === "string" ? c : c.kode, [...(pemilik.get(typeof c === "string" ? c : c.kode) ?? []), nama]);
    for (const [nama, f] of Object.entries<any>(tambah.fakta)) {
      for (const k of f.kode) {
        const p = pemilik.get(k);
        // belum digabung: tidak boleh dimiliki fakta lain; sudah digabung: harus tepat fakta yang sama
        expect(!p || (p.length === 1 && p[0] === nama), `${k} -> ${p}`).toBe(true);
      }
      expect(typeof f.kunciSaksi).toBe("string");
    }
    // kunci fakta yang dituju tersedia di pemetaan isian -> fakta jawaban saksi
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Fakta = require(path.join(REPO, "aleta_bot", "services", "isiJawabanSaksiFakta.js")) as any;
    for (const f of Object.values<any>(tambah.fakta)) for (const k of f.kode) expect(Fakta.KODE_FAKTA[k], k).toBe(f.kunciSaksi);
  });

  it("rujukan baru: berkas rujukan memuat setiap dasar hukum baru; yang perlu-verifikasi tidak tercetak di teks pertanyaan atau jawaban", () => {
    const md = baca(PAKET, "untuk-sesi-utama", "rujukan-k2.md");
    for (const { kunci } of JENIS) {
      const lama = new Set(ids(v1(kunci).dasarHukum));
      const kat = v2(kunci);
      for (const d of kat.dasarHukum.filter((x: any) => !lama.has(x.id))) {
        expect(md, d.id).toContain(d.id);
        expect(["terverifikasi", "perlu-verifikasi"]).toContain(d.status);
        expect(d.sumber.length).toBeGreaterThan(20);
      }
      const tampil = JSON.stringify([kat.pertanyaan, kat.jawabanUmum, kat.catatanPetugas]);
      for (const d of kat.dasarHukum.filter((x: any) => x.status === "perlu-verifikasi")) expect(tampil.includes(d.rujukan), d.rujukan).toBe(false);
    }
  });

  it("data ekstensi (saksi-katalog-data.js) memuat versi 2 dan keempat katalog tambahan", () => {
    const g: any = {};
    new Function("globalThis", baca(REPO, "ekstensi-sipp", "saksi-katalog-data.js"))(g);
    const data = g.ALETA_SAKSI_KATALOG_DATA as any[];
    for (const { kunci } of JENIS) {
      const k = data.find((x) => x.kunci === kunci);
      expect(k.versi).toBe(2);
      expect(k.pertanyaan.length).toBe(v2(kunci).pertanyaan.length);
    }
    for (const t of ["wasiat-tergugat", "hibah-tergugat", "wakaf-tergugat", "ekonomi-syariah-tergugat"]) expect(data.some((x) => x.kunci === t), t).toBe(true);
  });

  it("salinan v1 yang disimpan sama dengan katalog sebelum perubahan (versi 1, tanpa profil)", () => {
    for (const { kunci } of JENIS) {
      const a = v1(kunci);
      expect(a.versi).toBe(1);
      expect(a.profilSaksi).toBeUndefined();
    }
  });
});
