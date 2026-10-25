// @vitest-environment node
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { FITUR_FAKTA_NON_CERAI, KATALOG_FITUR_SATKER, keadaanFitur } from "@/lib/fitur-satker";

/**
 * ============================================================================
 * 25 OKT 2026 - RANTAI C, C5 (U9): KEADAAN DAN FAKTA PERKARA NON-CERAI
 * ============================================================================
 *
 * Saklar Fitur Satker "fakta-non-cerai" (bawaan MATI):
 *   - keadaan perkara non-cerai dibaca dari posita/petitum menjadi SARAN (kalimat sumber + tombol Pakai; tidak ada yang terisi
 *     sendiri; sangkalan tidak dihitung; pilih-satu yang bertentangan tidak diusulkan);
 *   - 2557/2558 (berapa kali saksi melihat dan mendengar pertengkaran) dibaca dari BAS yang sudah tersimpan, usulan "ragu";
 *   - gerbang presisi per jenis perkara (entri `perJenis`, diisi data U3 oleh rantai D) - kosong = semua "ragu".
 * Mati = perilaku lama persis. Seluruh posita, nama, dan nomor di bawah REKAAN.
 */

type Apa = any;
const REPO = path.resolve(__dirname, "../../..");
const muatBot = createRequire(path.join(REPO, "aleta_bot/package.json"));
const Kea: Apa = muatBot(path.join(REPO, "aleta_bot/services/keadaanNonCerai.js"));
const Kali: Apa = muatBot(path.join(REPO, "aleta_bot/services/kaliPertengkaranBas.js"));
const Gerbang: Apa = muatBot(path.join(REPO, "aleta_bot/services/gerbangIsian.js"));
const EKS = path.join(REPO, "ekstensi-sipp");
const KATALOG = path.join(EKS, "saksi-katalog");
const katalog = (k: string) => JSON.parse(readFileSync(path.join(KATALOG, `${k}.json`), "utf8"));
const saranDari = (hasil: Apa, kunci: string) => hasil.saran.find((s: Apa) => s.kunci === kunci);

// ─── Portal: saklar ─────────────────────────────────────────────────────────

describe("saklar fakta-non-cerai", () => {
  it("terdaftar di katalog Fitur Satker dan bawaannya MATI", () => {
    expect(KATALOG_FITUR_SATKER.find((f) => f.kode === FITUR_FAKTA_NON_CERAI)).toMatchObject({ bawaan: "mati", bagian: "ekstensi" });
    expect(keadaanFitur(FITUR_FAKTA_NON_CERAI, {}).menyala).toBe(false);
  });
});

// ─── Bot: aturan terhadap katalog ───────────────────────────────────────────

describe("keadaanNonCerai: aturan konsisten dengan katalog saksi", () => {
  const berkas = readdirSync(KATALOG).map((n) => n.replace(/\.json$/, ""));

  it("setiap katalog beraturan ada, bukan katalog perceraian, dan setiap isian + nilainya dikenal katalog", () => {
    const kunciAturan = Object.keys(Kea.ATURAN);
    expect(kunciAturan.length).toBeGreaterThanOrEqual(20);
    for (const kunci of kunciAturan) {
      expect(berkas, kunci).toContain(kunci);
      expect(kunci).not.toMatch(/^cerai-/);
      const kat = katalog(kunci);
      for (const [kunciKeadaan, def] of Object.entries(Kea.ATURAN[kunci]) as Array<[string, Apa]>) {
        const k = kat.keadaan?.[kunciKeadaan];
        expect(k, `${kunci}.${kunciKeadaan}`).toBeTruthy();
        expect(k.sumber, `${kunci}.${kunciKeadaan}: isian otomatis bukan urusan saran`).not.toBe("otomatis");
        const sah = new Set<string>(k.nilai || []);
        const nilaiAturan: string[] = [];
        if (def.pilih) {
          for (const [nilai] of def.pilih) nilaiAturan.push(nilai);
          expect(Boolean(def.jamak), `${kunci}.${kunciKeadaan} jamak`).toBe(Boolean(k.jamak));
        }
        if (def.ya) nilaiAturan.push(def.ya);
        if (def.tidak) nilaiAturan.push(def.tidak);
        for (const n of nilaiAturan) expect(sah.has(n), `${kunci}.${kunciKeadaan}=${n}`).toBe(true);
      }
    }
  });

  it("katalog perceraian dan kunci tak dikenal tidak menghasilkan saran", () => {
    for (const kunci of ["cerai-gugat", "cerai-talak", "cerai-kumulasi", "tidak-ada"]) {
      expect(Kea.turunkanKeadaan({ kunciKatalog: kunci, posita: "Bahwa Penggugat adalah ibu kandung anak; harta bersama berupa rumah." })).toMatchObject({ ok: true, saran: [] });
    }
    expect(Kea.turunkanKeadaan({}).saran).toEqual([]);
  });
});

// ─── Bot: perilaku nyata ────────────────────────────────────────────────────

const POSITA_WARIS = [
  "Bahwa Pewaris bernama Fulan Rekaan bin Contoh telah meninggal dunia pada tanggal 3 Maret 2025 dan meninggalkan seorang istri bernama Siti Fiktif;",
  "Bahwa Pewaris meninggalkan anak kandung bernama Ali Rekaan dan Budi Rekaan serta saudara kandung bernama Candra Contoh;",
  "Bahwa Pewaris meninggalkan harta peninggalan berupa sebidang tanah dan rumah, sebuah mobil, serta tabungan di bank;",
  "Bahwa harta tersebut merupakan harta bersama Pewaris dengan istrinya;",
  "Bahwa Tergugat tidak memiliki wasiat apa pun;",
].join("\n");
const PETITUM_WARIS = "1. Mengabulkan gugatan Penggugat; 2. Menetapkan ahli waris; 3. Meletakkan sita jaminan atas objek sengketa;";

describe("keadaanNonCerai: kewarisan dari posita dan petitum", () => {
  const h = Kea.turunkanKeadaan({ kunciKatalog: "kewarisan", posita: POSITA_WARIS, petitum: PETITUM_WARIS, alur: "15", jenisPerkaraId: "364" });

  it("membaca pilihan satu dan jamak, lengkap dengan kalimat sumber", () => {
    expect(h.ok).toBe(true);
    expect(saranDari(h, "statusPewaris")).toMatchObject({ nilai: "menikah", jamak: false, sumber: "posita" });
    expect(saranDari(h, "ahliWaris").nilai).toEqual(expect.arrayContaining(["anak", "saudara"]));
    expect(saranDari(h, "ahliWaris").jamak).toBe(true);
    expect(saranDari(h, "jenisHarta").nilai).toEqual(expect.arrayContaining(["tanah-bangunan", "kendaraan", "uang-simpanan"]));
    expect(saranDari(h, "asalHarta").nilai).toBe("bersama-pasangan");
    expect(saranDari(h, "sita")).toMatchObject({ nilai: "ada", sumber: "petitum" });
    expect(saranDari(h, "ahliWaris").kalimat).toMatch(/anak kandung/);
  });

  it("sangkalan tidak dihitung: 'tidak memiliki wasiat' bukan wasiat ada", () => {
    expect(saranDari(h, "wasiat")).toBeUndefined();
    const ada = Kea.turunkanKeadaan({ kunciKatalog: "kewarisan", posita: "Bahwa Pewaris membuat wasiat kepada cucunya." });
    expect(saranDari(ada, "wasiat")).toMatchObject({ nilai: "ada" });
  });

  it("SEMUA saran 'ragu' (belum terukur) dan bernada saran, tanpa nama aplikasi", () => {
    expect(h.saran.length).toBeGreaterThanOrEqual(5);
    for (const s of h.saran) {
      expect(s.yakin).toBe("ragu");
      expect(s.catatan).toMatch(/belum dikuatkan saksi/);
      expect(JSON.stringify(s)).not.toMatch(/aleta/i);
    }
  });

  it("pilih-satu yang bertentangan tidak diusulkan; kalimat bernama aplikasi diabaikan", () => {
    const b = Kea.turunkanKeadaan({
      kunciKatalog: "hak-asuh",
      posita: "Bahwa Penggugat adalah ibu kandung dari anak tersebut; Bahwa Penggugat adalah ayah kandung dari anak tersebut;",
    });
    expect(saranDari(b, "kedudukanPengaju")).toBeUndefined();
    const a = Kea.turunkanKeadaan({ kunciKatalog: "wasiat", posita: "Bahwa wasiat tertulis dibuat oleh ALETA pewasiat; Bahwa Aleta menyebut wasiat lisan;" });
    expect(a.saran).toEqual([]);
  });
});

describe("keadaanNonCerai: jenis lain", () => {
  it("harta bersama: objek, status tanah (belum bersertifikat bukan bersertifikat), perjanjian kawin disangkal", () => {
    const posita = [
      "Bahwa selama perkawinan Penggugat dan Tergugat memperoleh sebidang tanah dengan surat keterangan tanah (belum bersertifikat) dan sebuah sepeda motor;",
      "Bahwa Penggugat dan Tergugat tidak membuat perjanjian kawin;",
      "Bahwa Penggugat memohon pembagian seperdua bagian;",
    ].join("\n");
    const h = Kea.turunkanKeadaan({ kunciKatalog: "harta-bersama", posita });
    expect(saranDari(h, "jenisObjek").nilai).toEqual(expect.arrayContaining(["tanah-bangunan", "kendaraan"]));
    expect(saranDari(h, "statusTanah").nilai).toBe("belum-bersertifikat");
    expect(saranDari(h, "perjanjianKawin").nilai).toBe("tidak-ada");
    expect(saranDari(h, "pembagianDiminta").nilai).toBe("seperdua");
  });

  it("hak asuh: kedudukan pengaju, jumlah anak, umur anak (>= 12 sudah, < 12 belum, campur tidak diusulkan)", () => {
    const dasar = (umur: string) => Kea.turunkanKeadaan({ kunciKatalog: "hak-asuh", posita: `Bahwa Pemohon adalah ibu kandung dari dua orang anak; Bahwa anak pertama berumur ${umur};` });
    expect(saranDari(dasar("14 tahun"), "anakMumayyiz").nilai).toBe("sudah");
    expect(saranDari(dasar("6 tahun"), "anakMumayyiz").nilai).toBe("belum");
    expect(saranDari(dasar("14 tahun"), "kedudukanPengaju").nilai).toBe("ibu");
    expect(saranDari(dasar("14 tahun"), "jumlahAnak").nilai).toBe("lebih");
    const campur = Kea.turunkanKeadaan({ kunciKatalog: "hak-asuh", posita: "Bahwa anak pertama berumur 14 tahun; Bahwa anak kedua berumur 6 tahun;" });
    expect(saranDari(campur, "anakMumayyiz")).toBeUndefined();
  });

  it("itsbat nikah: bentuk dari alur dan 'Pemohon I dan Pemohon II'", () => {
    const berdua = Kea.turunkanKeadaan({ kunciKatalog: "itsbat-nikah", posita: "Bahwa Pemohon I dan Pemohon II telah menikah pada tahun 2010;", alur: "16" });
    expect(saranDari(berdua, "bentuk").nilai).toBe("permohonan-berdua");
    const gugat = Kea.turunkanKeadaan({ kunciKatalog: "itsbat-nikah", posita: "Bahwa suami Penggugat telah meninggal dunia pada tahun 2020;", alur: "15" });
    expect(saranDari(gugat, "bentuk").nilai).toBe("gugatan-pasangan-meninggal");
    const tanpaAlur = Kea.turunkanKeadaan({ kunciKatalog: "itsbat-nikah", posita: "Bahwa Pemohon menikah di rumah wali;", alur: "" });
    expect(saranDari(tanpaAlur, "bentuk")).toBeUndefined();
  });

  it("wasiat dan hibah: bentuk, kondisi, dalil cacat", () => {
    const w = Kea.turunkanKeadaan({ kunciKatalog: "wasiat", posita: "Bahwa pewasiat membuat wasiat tertulis dalam keadaan sakit keras; Bahwa tanda tangan dipalsukan;" });
    expect(saranDari(w, "bentukWasiat").nilai).toBe("tertulis");
    expect(saranDari(w, "kondisiPewasiat").nilai).toBe("sakit-menjelang-wafat");
    expect(saranDari(w, "dalilCacat").nilai).toContain("tanda-tangan-dipalsukan");
    const hb = Kea.turunkanKeadaan({ kunciKatalog: "hibah", posita: "Bahwa hibah dibuat dengan akta hibah di hadapan PPAT; Bahwa penghibah telah meninggal;" });
    expect(saranDari(hb, "bentukHibah").nilai).toBe("akta-ppat");
    expect(saranDari(hb, "statusPenghibah").nilai).toBe("sudah-meninggal");
  });

  it("hak bekas istri: hak yang dituntut dan dukhul; izin poligami: alasan dan sikap istri", () => {
    const hk = Kea.turunkanKeadaan({ kunciKatalog: "hak-bekas-istri", posita: "Bahwa Penggugat menuntut nafkah iddah, mut'ah, dan nafkah madliyah; Bahwa Penggugat dan Tergugat telah dikaruniai dua orang anak;" });
    expect(saranDari(hk, "hakDituntut").nilai).toEqual(expect.arrayContaining(["nafkah-iddah", "mutah", "nafkah-madliyah"]));
    expect(saranDari(hk, "dukhul").nilai).toBe("bada");
    const pg = Kea.turunkanKeadaan({ kunciKatalog: "izin-poligami", posita: "Bahwa istri Pemohon tidak dapat melahirkan keturunan; Bahwa istri Pemohon menyetujui rencana tersebut; Bahwa Pemohon bekerja sebagai PNS;" });
    expect(saranDari(pg, "alasanPoligami").nilai).toEqual(["c"]);
    expect(saranDari(pg, "sikapIstri").nilai).toBe("setuju");
    expect(saranDari(pg, "pekerjaanSuami").nilai).toBe("asn-tni-polri");
    const tak = Kea.turunkanKeadaan({ kunciKatalog: "izin-poligami", posita: "Bahwa istri Pemohon tidak setuju;" });
    expect(saranDari(tak, "sikapIstri")).toBeUndefined();
  });
});

describe("keadaanNonCerai: gerbang per jenis (data U3 menyusul)", () => {
  const posita = "Bahwa harta peninggalan berupa tanah dan rumah;";
  it("berkas bawaan kosong: semua ragu", () => {
    expect(Kea.keyakinanGerbang("kewarisan", "jenisHarta", "364")).toBe("ragu");
  });
  it("naik 'cukup' hanya bila status otomatis, n >= 30, presisi >= 0,95 - per jenis atau umum", () => {
    const g = {
      kode: {
        "kewarisan.jenisHarta": { perJenis: { "364": { status: "otomatis", n: 40, presisi: 0.97 }, "365": { status: "otomatis", n: 10, presisi: 0.99 } } },
        "kewarisan.sita": { status: "otomatis", n: 30, presisi: 0.94 },
      },
    };
    expect(Kea.keyakinanGerbang("kewarisan", "jenisHarta", "364", g)).toBe("cukup");
    expect(Kea.keyakinanGerbang("kewarisan", "jenisHarta", "365", g)).toBe("ragu");
    expect(Kea.keyakinanGerbang("kewarisan", "jenisHarta", "", g)).toBe("ragu");
    expect(Kea.keyakinanGerbang("kewarisan", "sita", "364", g)).toBe("ragu");
    const h = Kea.turunkanKeadaan({ kunciKatalog: "kewarisan", posita, jenisPerkaraId: "364" }, { gerbang: g });
    expect(saranDari(h, "jenisHarta").yakin).toBe("cukup");
  });
});

describe("gerbangIsian: entri perJenis memilih ketepatan menurut jenis perkara", () => {
  const entri = { n: 10, banding: 10, cocok: 5, persen: 50, status: "saran", perJenis: { "364": { n: 40, banding: 40, cocok: 39, persen: 97.5, status: "otomatis", pangkatMaks: "cukup" } } };
  const gerbang = { kode: { "2557": { asal: { posita: entri } } } };
  const buat = () => ({ kode: "2557", nilai: "3", keyakinan: "cukup", sumber: [{ asal: "saksi-bas" }] });

  it("tanpa jenis atau jenis lain: entri umum (saran -> ragu), persis seperti dulu", () => {
    const a = Gerbang.terapkan([buat()], { gerbang });
    expect(a[0].keyakinan).toBe("ragu");
    const b = Gerbang.terapkan([buat()], { gerbang, jenis: "346" });
    expect(b[0].keyakinan).toBe("ragu");
  });
  it("jenis yang terukur: keyakinan dipertahankan sampai pangkat maksimal", () => {
    const a = Gerbang.terapkan([buat()], { gerbang, jenis: "364" });
    expect(a[0].keyakinan).toBe("cukup");
    expect(a[0].gerbang).toMatchObject({ status: "otomatis", n: 40 });
  });
  it("kode 2557 tanpa ukuran di berkas bawaan = saran ragu", () => {
    const a = Gerbang.terapkan([buat()]);
    expect(a[0].keyakinan).toBe("ragu");
    expect(a[0].gerbang.status).toBe("tanpa-ukuran");
  });
});

// ─── Bot: 2557 / 2558 dari BAS ──────────────────────────────────────────────

const BAS = {
  saksi: [
    {
      pihak: "P",
      urutan: 1,
      id: 11,
      nama: "Saksi Satu Rekaan",
      tanyaJawab: [
        { no: 1, tanya: "Apakah saksi pernah melihat dan mendengar Penggugat dan Tergugat bertengkar?", jawab: "Pernah, saya melihat dan mendengar sendiri." },
        { no: 2, tanya: "Berapa kali saksi melihat dan mendengar pertengkaran tersebut?", jawab: "Sekitar 3 (tiga) kali selama tahun 2025." },
      ],
    },
    {
      pihak: "P",
      urutan: 2,
      id: 12,
      nama: "Saksi Dua Rekaan",
      tanyaJawab: [{ no: 1, tanya: "Berapa kali saksi melihat dan mendengar pertengkaran?", jawab: "Dua kali, saat saya berkunjung." }],
    },
    { pihak: "T", urutan: 1, id: 13, nama: "Saksi Tergugat", tanyaJawab: [{ no: 1, tanya: "Berapa kali pertengkaran?", jawab: "Tidak pernah, 9 kali pun tidak." }] },
  ],
};

describe("kaliPertengkaranBas: 2557/2558 dari keterangan saksi di BAS", () => {
  it("angka digit, kata, 'sekali saja' terbaca; kata samar tidak diubah menjadi angka", () => {
    expect(Kali.bacaKali("Sekitar 3 (tiga) kali")).toMatchObject({ n: 3 });
    expect(Kali.bacaKali("Dua kali saja")).toMatchObject({ n: 2 });
    expect(Kali.bacaKali("dua belas kali")).toMatchObject({ n: 12 });
    expect(Kali.bacaKali("Baru sekali itu")).toMatchObject({ n: 1 });
    expect(Kali.bacaKali("Sering sekali, berkali-kali")).toMatchObject({ samar: true });
    expect(Kali.bacaKali("Saya tidak ingat")).toBeNull();
    expect(Kali.bacaKali("")).toBeNull();
  });

  it("saksi I dan II = dua saksi pihak P menurut urutan; saksi T tidak ikut; keyakinan paling tinggi 'cukup'", () => {
    const u = Kali.usulanKaliPertengkaran(BAS);
    expect(u.map((x: Apa) => [x.kode, x.nilai, x.keyakinan])).toEqual([
      ["2557", "3", "cukup"],
      ["2558", "2", "cukup"],
    ]);
    for (const x of u) {
      expect(x.jagaIsianLama).toBe(true);
      expect(x.sumber[0].asal).toBe("saksi-bas");
      expect(JSON.stringify(x)).not.toMatch(/aleta/i);
    }
  });

  it("dua angka berbeda pada satu saksi: yang pertama dipakai dan usulannya 'ragu'; jawaban samar saja = tidak diusulkan", () => {
    const bas = {
      saksi: [
        {
          pihak: "P",
          urutan: 1,
          tanyaJawab: [
            { tanya: "Apakah pertengkaran itu sering?", jawab: "Sekitar 5 kali." },
            { tanya: "Berapa kali saksi melihat pertengkaran?", jawab: "Dua kali." },
          ],
        },
        { pihak: "P", urutan: 2, tanyaJawab: [{ tanya: "Berapa kali saksi melihat pertengkaran?", jawab: "Sering sekali dan berkali-kali." }] },
      ],
    };
    const u = Kali.usulanKaliPertengkaran(bas);
    expect(u).toHaveLength(1);
    expect(u[0]).toMatchObject({ kode: "2557", nilai: "2", keyakinan: "ragu" });
    expect(u[0].catatan).toMatch(/berbeda/);
  });

  it("tanya-jawab di luar pertengkaran diabaikan; BAS kosong atau salah bentuk = []", () => {
    const luar = { saksi: [{ pihak: "P", urutan: 1, tanyaJawab: [{ tanya: "Berapa kali saksi mengunjungi rumah mereka?", jawab: "4 kali." }] }] };
    expect(Kali.usulanKaliPertengkaran(luar)).toEqual([]);
    expect(Kali.usulanKaliPertengkaran(null)).toEqual([]);
    expect(Kali.usulanKaliPertengkaran({})).toEqual([]);
  });

  it("usulanDariPerkara membaca BAS lewat pembaca baca-saja (hanya SELECT) dan gagal = []", async () => {
    const sql: string[] = [];
    const runQuery = async (q: string) => {
      sql.push(q);
      if (/FROM perkara WHERE nomor_perkara/.test(q)) return [{ id: 77 }];
      if (/FROM perkara_pihak5/.test(q)) return [{ id: 11, ke: 1, urutan: 1, nama: "Saksi Satu Rekaan", hubungan: "tetangga" }];
      return [];
    };
    const runAbt = async (q: string) => {
      sql.push(q);
      if (/FROM abt_keterangan_saksi/.test(q)) {
        return [
          { sidang_id: 1, saksi_id: 11, urutan_pertanyaan: 1, pertanyaan: "Berapa kali saksi melihat dan mendengar pertengkaran?", jawaban: "Tiga kali." },
        ];
      }
      return [];
    };
    const u = await Kali.usulanDariPerkara("55/Pdt.G/2026/PA.Dgl", { runQuery, runAbt });
    expect(u.map((x: Apa) => [x.kode, x.nilai])).toEqual([["2557", "3"]]);
    expect(sql.length).toBeGreaterThan(0);
    for (const q of sql) expect(q.trim()).toMatch(/^SELECT/i);
    expect(await Kali.usulanDariPerkara("", { runQuery, runAbt })).toEqual([]);
    expect(await Kali.usulanDariPerkara("55/Pdt.G/2026/PA.Dgl", { runQuery: async () => { throw new Error("putus"); }, runAbt })).toEqual([]);
  });
});

// ─── Bot: rute /abt/usulan ──────────────────────────────────────────────────

const BERKAS_RUTE = path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js");
function rutePenangan(tiruan: Record<string, unknown>) {
  const rq = createRequire(BERKAS_RUTE);
  const isi = readFileSync(BERKAS_RUTE, "utf8");
  const tanda = isi.indexOf("// PENYARING MASUKAN /abt/usulan (kontrak K6)");
  const awal = isi.lastIndexOf("\n// ====", tanda);
  const akhir = isi.indexOf('router.post("/abt/pdf"');
  const rute: Record<string, (req: unknown, res: unknown) => Promise<void>> = {};
  const abtAsli = rq("../services/abtUsulanService");
  const konteks = vm.createContext({
    require: (p: string) => (p in tiruan ? tiruan[p] : rq(p)),
    abtUsulanService: Object.assign(Object.create(abtAsli), abtAsli, { dariSipp: async () => ({ ok: true, usulan: [{ kode: "1001", nama: "Mas kawin", nilai: "Rp100.000", keyakinan: "pasti", sumber: [{ asal: "sipp" }] }, { kode: "2558", nama: "Kali II", nilai: "", keyakinan: "ragu", sumber: [] }] }) }),
    requireInternalToken: () => undefined,
    router: { post: (jalur: string, _p: unknown, f: (req: unknown, res: unknown) => Promise<void>) => void (rute[jalur] = f) },
    console,
  });
  vm.runInContext(isi.slice(awal, akhir), konteks, { filename: "internalGatewayRoutes.js#abt-usulan" });
  const f = rute["/abt/usulan"];
  return async (body: unknown) => {
    let json: Apa = null;
    await f({ body: JSON.parse(JSON.stringify(body)) }, { status: () => ({ json: (j: Apa) => void (json = j) }), json: (j: Apa) => void (json = j) });
    return json;
  };
}

describe("rute /abt/usulan", () => {
  const tiruan = {
    "../services/kaliPertengkaranBas": {
      usulanDariPerkara: async () => [
        { kode: "2557", nama: "Saksi I", nilai: "3", keyakinan: "cukup", bentrok: "", sumber: [{ saksi: 1, asal: "saksi-bas", kalimat: "x" }], catatan: "", dihitung: false, jagaIsianLama: true },
        { kode: "2558", nama: "Saksi II", nilai: "2", keyakinan: "cukup", bentrok: "", sumber: [{ saksi: 2, asal: "saksi-bas", kalimat: "y" }], catatan: "", dihitung: false, jagaIsianLama: true },
      ],
    },
  };

  it("tanpa permintaan (saklar mati): usulan SIPP persis seperti dulu, 2557 tidak ditambahkan", async () => {
    const j = await rutePenangan(tiruan)({ nomorPerkara: "55/Pdt.G/2026/PA.Dgl", sumber: "sipp" });
    expect(j.sipp.usulan.map((u: Apa) => u.kode)).toEqual(["1001", "2558"]);
  });

  it("diminta: 2557 ditambahkan, 2558 yang kosong diisi, hanya saran ragu lewat gerbang, jenis perkara 'tanpa ukuran'", async () => {
    const j = await rutePenangan(tiruan)({ nomorPerkara: "55/Pdt.G/2026/PA.Dgl", sumber: "sipp", kaliPertengkaranBas: true, jenisPerkara: "347" });
    const kode = j.sipp.usulan.map((u: Apa) => u.kode);
    expect(kode).toEqual(["1001", "2558", "2557"]);
    const u2558 = j.sipp.usulan.find((u: Apa) => u.kode === "2558");
    expect(u2558.nilai).toBe("2");
    for (const kd of ["2557", "2558"]) {
      const u = j.sipp.usulan.find((x: Apa) => x.kode === kd);
      expect(u.keyakinan).toBe("ragu");
      expect(u.gerbang.status).toBe("tanpa-ukuran");
    }
    expect(j.sipp.usulan.find((u: Apa) => u.kode === "1001").nilai).toBe("Rp100.000");
  });

  it("usulan yang sudah berisi tidak ditimpa; galat pembaca BAS tidak menggagalkan usulan SIPP", async () => {
    const j = await rutePenangan({ "../services/kaliPertengkaranBas": { usulanDariPerkara: async () => { throw new Error("putus"); } } })({ nomorPerkara: "55/Pdt.G/2026/PA.Dgl", sumber: "sipp", kaliPertengkaranBas: true });
    expect(j.ok).toBe(true);
    expect(j.sipp.usulan.map((u: Apa) => u.kode)).toEqual(["1001", "2558"]);
  });

  it("isi-jawaban dengan keadaanNonCerai: saran keadaan ikut; tanpa permintaan tidak ada", async () => {
    const penangan = rutePenangan({});
    const dasar = { sumber: "isi-jawaban", nomorPerkara: "", jenisPerkara: "364", alur: "15", kunciKatalog: "kewarisan", posita: POSITA_WARIS, petitum: PETITUM_WARIS, mintaFakta: true };
    const tanpa = await penangan(dasar);
    expect(tanpa.keadaanNonCerai).toBeUndefined();
    const dengan = await penangan({ ...dasar, keadaanNonCerai: true });
    expect(dengan.keadaanNonCerai.ok).toBe(true);
    expect(saranDari(dengan.keadaanNonCerai, "statusPewaris").nilai).toBe("menikah");
    expect(saranDari(dengan.keadaanNonCerai, "sita").sumber).toBe("petitum");
    expect(JSON.stringify(dengan.keadaanNonCerai)).not.toMatch(/aleta/i);
  });
});

// ─── Ekstensi: panel Saran keadaan ──────────────────────────────────────────

const baca = (n: string) => readFileSync(path.join(EKS, n), "utf8");
const SUMBER_EKSTENSI = ["panel-alat.js", "saklar-fitur.js", "saksi-katalog.js", "saksi-katalog-data.js", "saksi-susun.js", "blangko-derry-jawab-katalog.js", "abt.js"].map(baca).join("\n;\n");
const KODE = "0001 8010 0048 7047 7048 0046 0053 0017 8008 0306 5125 0047 0032 0033 8503".split(" ");
const halaman: JSDOM[] = [];
afterEach(async () => {
  await new Promise((s) => setTimeout(s, 20));
  while (halaman.length) halaman.pop()!.window.close();
});

function buka(isi: Record<string, string>, nomor: string, saklar: boolean, catatan: Apa[]) {
  const baris = KODE.map(
    (k) =>
      `<tr valign="top"><td align=center id="${k}">${k}</td><td>Variabel ${k}</td><td>${k in isi ? isi[k] : `isi ${k}`}</td><td align="center"><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','');">edit</a></td></tr>`
  ).join("");
  const dom = new JSDOM(`<!doctype html><html><head><title>Blangko</title></head><body><div id="wrapper"><div id="content"><h3 class="w3l_header"><span>${nomor}</span></h3><table>${baris}</table></div></div></body></html>`, {
    url: "http://127.0.0.1:8056/aps_badilag/index.php/abt/main/view?a=A&b=B&c=10018&d=3",
    runScripts: "outside-only",
  });
  halaman.push(dom);
  const w = dom.window as Apa;
  const simpanan: Record<string, unknown> = { ujiTampilan: "baru" };
  w.chrome = {
    runtime: { getManifest: () => ({ version: "uji" }), getURL: (p: string) => `chrome-extension://uji/${p}`, sendMessage: (_p: unknown, balik?: (x: unknown) => void) => balik && balik({ ok: true }), lastError: undefined },
    storage: { local: { get: async (kunci: string[]) => Object.fromEntries((kunci || []).filter((x) => x in simpanan).map((x) => [x, simpanan[x]])), set: async (b: Record<string, unknown>) => void Object.assign(simpanan, b), remove: async () => {} }, onChanged: { addListener: () => {} } },
  };
  w.Response = globalThis.Response;
  const jawab = (isiJawab: unknown, status = 200) => new Response(JSON.stringify(isiJawab), { status, headers: { "content-type": "application/json" } });
  w.fetch = async (alamat: string, o?: Apa) => {
    if (/ekstensi\/fitur/.test(alamat)) return jawab({ ok: true, data: { fitur: { "fakta-non-cerai": saklar, "mesin-saksi-tunggal": false } } });
    if (/aleta-bot\/abt\/usulan/.test(alamat)) {
      const m = JSON.parse((o && o.body) || "{}");
      catatan.push(m);
      if (m.sumber === "isi-jawaban" && m.mintaFakta === true) {
        const data: Apa = { available: true, isiJawaban: {}, faktaPerkara: {} };
        if (m.keadaanNonCerai === true) data.keadaanNonCerai = Kea.turunkanKeadaan({ kunciKatalog: m.kunciKatalog, posita: POSITA_WARIS, petitum: PETITUM_WARIS, alur: m.alur, jenisPerkaraId: m.jenisPerkara });
        return jawab({ data });
      }
      return jawab({ data: { available: true } });
    }
    return jawab({ ok: false }, 404);
  };
  Object.defineProperty(w.HTMLElement.prototype, "innerText", { configurable: true, get() { return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""); } });
  w.console.warn = () => {};
  w.eval(`${SUMBER_EKSTENSI}\n;\nwindow.__uji = { tahanPost: (nilai) => { alatCobaMenahan = () => nilai; } };`);
  return w;
}
const tunggu = async (kondisi: () => boolean, pesan: string, batas = 400) => {
  for (let i = 0; i < batas; i += 1) {
    if (kondisi()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`menunggu: ${pesan}`);
};
const TOMBOL = "Susun saksi menurut keadaan perkara";
const tombolDi = (akar: Apa, teks: string) => Array.from(akar.querySelectorAll("button")).find((b: Apa) => b.textContent === teks) as Apa;

async function bukaBorang(saklar: boolean, isi: Record<string, string>, nomor: string) {
  const catatan: Apa[] = [];
  const w = buka(isi, nomor, saklar, catatan);
  await tunggu(() => Boolean(w.document.getElementById("aleta-panel-abt")), "panel");
  const panel = w.document.getElementById("aleta-panel-abt");
  await tunggu(() => !tombolDi(panel, TOMBOL)?.hidden, "tombol katalog");
  tombolDi(panel, TOMBOL).click();
  await tunggu(() => Boolean(panel.querySelector(".aleta-ssk .aleta-sdg-form")), "borang");
  return { w, panel, wadah: panel.querySelector(".aleta-ssk"), catatan };
}
const WARIS = { "0048": "Kewarisan", "0046": "Penggugat", "0047": "Tergugat", "5125": POSITA_WARIS };

describe("panel ABT: Saran keadaan dari posita (kewarisan)", () => {
  it("saklar MATI: tidak ada permintaan saran dan tidak ada panel saran (perilaku lama)", async () => {
    const { wadah, catatan } = await bukaBorang(false, WARIS, "9/Pdt.G/2026/PA.Dgl");
    await new Promise((r) => setTimeout(r, 80));
    expect(wadah.querySelector("[data-saran-keadaan]")).toBeNull();
    expect(catatan.filter((m) => m.keadaanNonCerai === true)).toEqual([]);
    expect(wadah.textContent).toContain("Keadaan perkara");
  });

  it("saklar MENYALA: saran tampil saat borang dibuka (tanpa klik Susun), tidak ada keadaan yang terisi sendiri, Pakai mengubah isian", async () => {
    const { wadah, catatan } = await bukaBorang(true, WARIS, "9/Pdt.G/2026/PA.Dgl");
    await tunggu(() => Boolean(wadah.querySelector("[data-saran-keadaan]")), "panel saran");
    const minta = catatan.find((m) => m.keadaanNonCerai === true);
    expect(minta).toBeTruthy();
    expect(minta.kunciKatalog).toBe("kewarisan");
    expect(minta.sumber).toBe("isi-jawaban");
    const panelSaran = wadah.querySelector("[data-saran-keadaan]");
    expect(panelSaran.textContent).toMatch(/belum dikuatkan saksi/);
    // bawaan katalog belum berubah: "Harta bersama" belum terpilih sampai Pakai ditekan
    const baris = panelSaran.querySelector('[data-saran-kunci="asalHarta"]');
    expect(baris).toBeTruthy();
    expect(baris.textContent).toMatch(/bersama/i);
    expect(baris.title).toMatch(/harta bersama/i);
    const pilihAsal = () => Array.from(wadah.querySelectorAll("select")).find((s: Apa) => Array.from(s.options).some((o: Apa) => o.value === "bersama-pasangan")) as Apa;
    expect(pilihAsal().value).toBe("pribadi");
    tombolDi(baris, "Pakai").click();
    await tunggu(() => Boolean(pilihAsal()) && pilihAsal().value === "bersama-pasangan", "isian asal harta berubah");
    // saran yang sudah dipakai hilang dari daftar
    expect(wadah.querySelector('[data-saran-keadaan] [data-saran-kunci="asalHarta"]')).toBeNull();
    // Pakai semua saran
    const semua = tombolDi(wadah.querySelector("[data-saran-keadaan]"), "Pakai semua saran");
    expect(semua).toBeTruthy();
    semua.click();
    await tunggu(() => !wadah.querySelector("[data-saran-keadaan]"), "semua saran dipakai");
    const centang = (nilai: string) => (Array.from(wadah.querySelectorAll('input[type="checkbox"]')).find((c: Apa) => c.value === nilai) as Apa)?.checked;
    expect(centang("saudara")).toBe(true);
    expect(centang("kendaraan")).toBe(true);
  });

  it("katalog perceraian tidak pernah meminta saran, walau saklar menyala", async () => {
    const { wadah, catatan } = await bukaBorang(true, { "0048": "Cerai Gugat", "0046": "Penggugat", "0047": "Tergugat", "8503": "F", "5125": "Bahwa sering terjadi pertengkaran;" }, "9/Pdt.G/2026/PA.Dgl");
    await new Promise((r) => setTimeout(r, 80));
    expect(wadah.querySelector("[data-saran-keadaan]")).toBeNull();
    expect(catatan.filter((m) => m.keadaanNonCerai === true)).toEqual([]);
  });
});

describe("permintaan usulan SIPP membawa kaliPertengkaranBas hanya bila saklar menyala", () => {
  it("sumber abt.js dan isi-sipp-bersama.js menjaga muatan dengan saklar", () => {
    const abt = baca("abt.js");
    expect(abt).toMatch(/AletaSaklarFitur\.aktif\("fakta-non-cerai"\)[\s\S]{0,120}kaliPertengkaranBas: true/);
    const bersama = baca("isi-sipp-bersama.js");
    expect(bersama).toMatch(/AletaSaklarFitur\.aktif\("fakta-non-cerai"\)/);
    expect(bersama).toMatch(/\.\.\.\(kaliBas \? \{ kaliPertengkaranBas: true \} : \{\}\)/);
  });
});
