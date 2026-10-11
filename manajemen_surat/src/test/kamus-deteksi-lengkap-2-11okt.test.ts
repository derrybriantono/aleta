// @vitest-environment node
/**
 * ============================================================================
 * 11 OKT 2026 - KAMUS DETEKSI LENGKAP 2 (agen 2 batch B, blok KDL2)
 * ============================================================================
 *
 * Kalimat di bawah adalah bentuk NYATA keterangan saksi / posita / label SIPP
 * PA Donggala (salinan 9 Okt), nama orang disamarkan. Yang dijaga PERILAKU:
 *   A. benih kelompok baru tempat-tinggal sah & dibaca pemuat kamus
 *   B. alasan: penyangkal bercakupan "letak" (hanya kecocokan di dalam rentangnya),
 *      ejaan petugas & bahasa daerah, sebab baru, posita itsbat "tidak ada pihak
 *      ketiga yang mengganggu gugat", potongan nama (Sirajudin) - semua dari kamus
 *   C. waktu: "N tahun yang lalu" (mundur dari tanggal sidang), "N bulan setelah
 *      menikah" (maju dari tanggal nikah posita), "sejak awal pernikahan" tanpa perkiraan
 *   D. hubungan saksi: pembetul ejaan, istilah baru, jangkar terbalik + ekor
 *   E. tempat tinggal bersama: ruas, jenis, pemilik, alamat, terakhir, berpindah,
 *      rumah saksi dipetakan lewat hubungan, kartu 1006 & 8570
 *   F. rute /abt/usulan sumber "saksi" sungguhan: kartu 1006/8570 ditambahkan,
 *      posita SIPP dipakai bila ekstensi tidak mengirim, usulan lama tidak berubah
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const BOT = path.join(AKAR, "aleta_bot");
const require_ = createRequire(path.join(BOT, "package.json"));
const kamus = require_(path.join(BOT, "services/kamusDeteksi.js"));
const usulan = require_(path.join(BOT, "services/abtUsulanService.js"));
const deteksi = require_(path.join(BOT, "services/deteksiAlasanService.js"));
const saksi = require_(path.join(BOT, "services/deteksiSaksiService.js"));
const tt = require_(path.join(BOT, "services/deteksiTempatTinggalService.js"));
const benih = (k: string) => JSON.parse(readFileSync(path.join(BOT, "kamus-deteksi/awal", `${k}.json`), "utf8"));

const sebab = (t: string) => (deteksi.sebabDariTeks(t) as { sebab: string }[]).map((x) => x.sebab);

afterEach(() => {
  kamus.aturLapisDatabase({});
});

// ============================================================================
// A. BENIH
// ============================================================================
describe("A. benih kelompok baru tempat-tinggal", () => {
  it("kelompok tempat-tinggal dimuat; semua jenis tempat aktif & terukur, tidak ada 'pasti' tanpa ukur", () => {
    expect(kamus.daftarKelompok()).toContain("tempat-tinggal");
    const b = benih("tempat-tinggal");
    expect(b.kelompok).toBe("tempat-tinggal");
    const jenis = b.pola.filter((p: any) => p.jenis === "jenis").map((p: any) => p.kunci);
    for (const k of ["orang-tua", "milik-pihak", "bersama", "sewa", "keluarga", "dinas", "rumah-saksi"]) expect(jenis).toContain(k);
    for (const p of b.pola) {
      expect(p.yakin).toBe("ragu");
      if (p.status === "aktif") expect(p.ukur.n).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// B. ALASAN
// ============================================================================
describe("B. alasan: penyangkal letak, ejaan, sebab baru, salah tangkap itsbat", () => {
  it("penyangkal LETAK hanya memadamkan kecocokan di dalam rentangnya", () => {
    expect(sebab("Bahwa Tergugat tidak pernah memukul Penggugat, yang jelas saling cekcok")).not.toContain("kekerasan dalam rumah tangga");
    expect(sebab("Bahwa Tergugat sering memukul Penggugat, tetapi tidak pernah memukul anaknya")).toContain("kekerasan dalam rumah tangga");
    expect(sebab("Bahwa antara Penggugat dan Tergugat tidak ada pertengkaran")).not.toContain("perselisihan terus-menerus");
    expect(sebab("Bahwa saya tidak pernah melihat pertengkaran antara Pemohon dan Termohon")).not.toContain("perselisihan terus-menerus");
    // "tidak kekerasan" = salah ketik "tindak kekerasan" - BUKAN penyangkalan.
    expect(sebab("Bahwa Tergugat biasa melakukan tidak Kekerasan Dalam Rumah Tangga")).toContain("kekerasan dalam rumah tangga");
    // membanting BARANG bukan kekerasan terhadap orang, tetapi sebab sendiri.
    const s = sebab("Bahwa Tergugat kalau marah membanting piring");
    expect(s).not.toContain("kekerasan dalam rumah tangga");
    expect(s).toContain("merusak barang");
  });

  it("posita itsbat 'tidak (ada) pihak ketiga yang mengganggu gugat' bukan sebab pihak lain; selingkuh tetap", () => {
    const pihak = "pihak lain (wanita/pria idaman lain)";
    expect(sebab("Bahwa selama pernikahan tersebut tidak ada pihak ketiga yang mengganggu gugat pernikahan para Pemohon")).not.toContain(pihak);
    expect(sebab("Bahwa selama pernikahan tersebut tidak pihak ketiga yang mengganggu gugat pernikahan para Pemohon")).not.toContain(pihak);
    expect(sebab("Bahwa Tergugat selingkuh dengan wanita lain")).toContain(pihak);
  });

  it("potongan nama orang (Sirajudin) bukan judi; 'berjudi' tetap judi", () => {
    expect(sebab("Bahwa saksi nikah bernama Sirajudin dan Yoga")).not.toContain("judi");
    expect(sebab("Bahwa Tergugat suka berjudi")).toContain("judi");
  });

  it("ejaan petugas & Melayu Manado, sebab baru berkunci F", () => {
    expect(sebab("Bahwa mereka sering baku bantah")).toContain("perselisihan terus-menerus");
    expect(sebab("Bahwa penyebab lain perselisian antara Tergugat adalah karena Tergugat tidak menafkahi")).toContain("perselisihan terus-menerus");
    expect(sebab("Bahwa tangan Penggugat lebam akibat di pukul oleh Tergugat")).toContain("kekerasan dalam rumah tangga");
    expect(sebab("Bahwa Tergugat keluar dari kediaman di pukul 22.30")).not.toContain("kekerasan dalam rumah tangga");
    expect(sebab("Bahwa Tergugat sering mengucapkan kata talak kepada Penggugat")).toContain("mengucapkan kata talak/cerai");
    expect(sebab("Bahwa Termohon tidak taat dan tidak patuh kepada Pemohon")).toContain("tidak taat/nusyuz");
    expect(sebab("Bahwa Tergugat sering berhutang tanpa sepengetahuan Penggugat")).toContain("masalah ekonomi");
    expect(sebab("Bahwa pernikahan Penggugat dan Tergugat adalah hasil perjodohan antara orangtua")).toContain("kawin paksa");
    expect(sebab("Bahwa Tergugat pergi kerja di Palu dan tidak pernah balik lagi")).toContain("meninggalkan");
    // sebab baru tidak mengubah usulan huruf F (hanya perselisihan yang menunjuk F)
    expect(deteksi.HURUF_LANGSUNG["mengucapkan kata talak/cerai"]).toBeUndefined();
  });

  it("penyangkal dibaca dari KAMUS: dimatikan lewat lapis database -> kecocokan kembali menyala", () => {
    const p = benih("alasan").pola.find((x: any) => x.kode === "sangkal-d-tidak-pernah-memukul");
    kamus.aturLapisDatabase({ pola: [{ ...p, kelompok: "alasan", status: "nonaktif" }] });
    expect(sebab("Bahwa Tergugat tidak pernah memukul Penggugat")).toContain("kekerasan dalam rumah tangga");
  });
});

// ============================================================================
// C. WAKTU
// ============================================================================
describe("C. petunjuk waktu relatif (tidak mengisi variabel)", () => {
  const uj = () => deteksi.penguji("waktu");
  it("'sejak N tahun/bulan yang lalu' -> perkiraan mundur dari tanggal sidang; '2 tahun 8 bulan' dijumlah", () => {
    const a = deteksi.petunjukWaktu(["Bahwa pemohon dan Termohon sudah pisah tempat tinggal sejak 3 tahun lalu"], "0246", uj(), "12 Maret 2026");
    expect(a.kode).toBe("fakta-sejak-lalu");
    expect(a.perkiraan).toBe("tahun 2023");
    const b = deteksi.petunjukWaktu(["Bahwa penggugat dan Tergugat sudah pisah tempat tinggal sejak 9 bulan yang lalu"], "0246", uj(), "12 September 2026");
    expect(b.perkiraan).toBe("bulan Desember 2025");
    const c = deteksi.petunjukWaktu(["Bahwa Penggugat dan Tergugat sudah berpisah tempat tinggal, sudah ada 2 tahun 8 bulan yang lalu"], "0246", uj(), "15 Mei 2023");
    expect(c.perkiraan).toBe("bulan September 2020");
    // "selama 1 tahun lalu tinggal di ..." = "lalu" sebagai "kemudian" - bukan petunjuk waktu.
    expect(deteksi.petunjukWaktu(["Bahwa tinggal di rumah orang tua Pemohon selama 1 tahun lalu tinggal di rumah kediaman bersama sampai pisah"], "0246", uj(), "12 Maret 2026")).toBeNull();
  });

  it("'N bulan setelah menikah' -> maju dari tanggal nikah posita; 'sejak awal pernikahan' tanpa perkiraan", () => {
    const opsi = { tanggalNikah: deteksi.tanggalNikahDari(["Bahwa pada tanggal 15 Juni 2024 Penggugat dan Tergugat melangsungkan pernikahan"]) };
    const a = deteksi.petunjukWaktu(["Bahwa sejak 3 (tiga) bulan setelah menikah antara Penggugat dan Tergugat sering terjadi perselisihan"], "0222", uj(), "", opsi);
    expect(a.kode).toBe("fakta-setelah-menikah");
    expect(a.perkiraan).toBe("bulan September 2024");
    const b = deteksi.petunjukWaktu(["Bahwa antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran sejak awal pernikahan"], "0222", uj(), "", opsi);
    expect(b.kode).toBe("fakta-awal-menikah");
    expect(b.perkiraan).toBeUndefined();
  });

  it("kartu 0246 kosong menyebut perkiraannya beserta dasar hitungnya", () => {
    const s = "- Bahwa penggugat dan Tergugat sudah pisah tempat tinggal sejak 7 bulan yang lalu";
    const r = usulan.dariKeteranganSaksi(s, s, "10 Oktober 2026", { pelaku: "Tergugat", lawan: "Penggugat" }, "");
    const u = r.usulan.find((x: any) => x.kode === "0246");
    expect(u.petunjukWaktu[0].perkiraan).toBe("bulan Maret 2026");
    if (!u.nilai) expect(u.catatan).toContain("dihitung mundur dari tanggal sidang");
  });
});

// ============================================================================
// D. HUBUNGAN SAKSI
// ============================================================================
describe("D. hubungan saksi: ejaan, istilah baru, jangkar terbalik", () => {
  const label = (t: string) => saksi.deteksiHubungan(t, { bentuk: "label" })?.kunci ?? null;
  const kalimat = (t: string) => saksi.deteksiHubungan(t, { bentuk: "kalimat" });
  it("label SIPP bersalah ketik terbaca; label bukan hubungan tetap null", () => {
    expect(label("Kakaik Kandung")).toBe("Kakak Kandung");
    expect(label("Saudarav kandung Pemohon")).toBe("Saudara Kandung");
    expect(label("Sepupu Sau Kali Penggugat.")).toBe("Sepupu Satu Kali");
    expect(label("Paman Penohon II")).toBe("Paman");
    expect(label("Itsbat Nikah")).toBeNull();
    expect(label("Cerai Gugat")).toBeNull();
  });
  it("istilah baru & draf yang diaktifkan", () => {
    expect(label("Paman Kandung Penggugat")).toBe("Paman");
    expect(label("Ayah Sambung Penggugat")).toBe("Ayah Tiri");
    expect(label("Anak Sambung Pemohon")).toBe("Anak Tiri");
    expect(label("Orang tua angkat Pemohon I")).toBe("Orang Tua Angkat");
    expect(label("Mantan Karyawan Warung Penggugat")).toBe("Karyawan/Pekerja");
    expect(label("Kepala Desa Rejeki")).toBe("Aparat Desa");
    expect(label("Pegawai Syara Batusuya")).toBe("Tokoh Agama");
    expect(label("Pemangku Adat Desa setempat")).toBe("Tokoh Adat");
  });
  it("jangkar terbalik membalik hubungan & membawa pihaknya; bentuk 'sebagai ... saya' tetap tidak dikenali", () => {
    const h = kalimat("Saya kenal dengan Tergugat karena Tergugat adalah menantu saya");
    expect(h.kunci).toBe("Mertua");
    expect(h.jangkar).toBe("hub-jangkar-terbalik");
    expect(saksi.hubunganTampil("", h, "P", "Penggugat", "Tergugat")).toBe("Mertua Tergugat");
    expect(kalimat("Penggugat adalah adik kandung saya sedangkan Tergugat adalah adik ipar saya").kunci).toBe("Kakak Kandung");
    expect(kalimat("Tergugat adalah keponakan saya")).toBeNull(); // kebalikan tak pasti (paman/tante)
    expect(kalimat("Saya kenal dengan Tergugat sebagai kaka ipar saya;")).toBeNull();
    expect(kalimat("Saya kenal dengan Tergugat sebagai suami Penggugat;")).toBeNull();
    expect(kalimat("Saya kenal karena saya masih sepupu dengan Penggugat").kunci).toBe("Sepupu");
    expect(kalimat("Saya kenal karena saya bertetangga dengan Penggugat;").kunci).toBe("Tetangga");
  });
  it("pembetul ejaan dibaca dari kamus (dimatikan lewat lapis database -> tidak terbaca)", () => {
    const p = benih("saksi-hubungan").pola.find((x: any) => x.kode === "ejaan-kakak");
    kamus.aturLapisDatabase({ pola: [{ ...p, kelompok: "saksi-hubungan", status: "nonaktif" }] });
    expect(label("Kakaik Kandung")).toBeNull();
  });
});

// ============================================================================
// E. TEMPAT TINGGAL BERSAMA
// ============================================================================
const POSITA_TT =
  "<p>1. Bahwa pada tanggal 08 Juni 2010 Penggugat dan Tergugat melangsungkan pernikahan;</p>" +
  "<p>4. Bahwa setelah menikah, Penggugat dan Tergugat tinggal bersama di rumah orang tua Penggugat di Desa Kotapulu selama 3 hari, setelah itu Penggugat dan Tergugat tinggal bersama di rumah Tergugat di Desa Kotapulu selama kurang lebih 1 tahun, setelah itu Penggugat dan Tergugat kembali lagi kerumah Tergugat di Desa Kotapulu, hingga pisah rumah;</p>";

describe("E. tempat tinggal bersama semasa rukun", () => {
  const ruas = (t: string, saksiKah = false) => tt.riwayat(tt.butirDari(t), { saksi: saksiKah });
  it("riwayat posita per ruas: jenis, pemilik (sisi), alamat, lama; ekor 'hingga pisah' dibuang", () => {
    const r = ruas(POSITA_TT);
    expect(r.ruas.map((x: any) => [x.jenis, x.sisi, x.alamat, x.lama])).toEqual([
      ["orang-tua", "lawan", "Desa Kotapulu", "selama 3 hari"],
      ["milik-pihak", "pelaku", "Desa Kotapulu", "selama kurang lebih 1 tahun"],
      ["milik-pihak", "pelaku", "Desa Kotapulu", ""],
    ]);
    expect(r.potongan.startsWith("rumah orang tua Penggugat di Desa Kotapulu selama 3 hari, setelah itu")).toBe(true);
    expect(r.potongan).not.toMatch(/pisah/);
  });
  it("bentuk templat 'mengambil tempat kediaman', berpindah-pindah, ruas terakhir, salah ketik", () => {
    expect(ruas("Bahwa setelah menikah Penggugat dan Tergugat mengambil tempat kediaman dirumah orang tua penggugat sampai sekarang;").ruas[0]).toMatchObject({ jenis: "orang-tua", sisi: "lawan" });
    const b = ruas("Setahu saya, setelah menikah awalnya Pemohon dan Termohon tinggal bersama didi rumah orang tua Termohon,kemudian Pemohon dan Termohon sering berpindah-pindah tempat tinggal (tinggal di rumah kos) dan terakhir Pemohon dan Termohon tinggal di rumah orang tua Pemohon di Desa Wani I hingga pisah tempat tinggal;", true);
    expect(b.berpindah).toBe(true);
    expect(b.ruas.map((x: any) => x.jenis)).toEqual(["orang-tua", "sewa", "orang-tua"]);
    expect(b.ruas[2]).toMatchObject({ sisi: "lawan", terakhir: true });
    expect(ruas("Setelah menikah Penggugat dan Tergugat tinggal bersama di rumah 0rang tua Penggugat selama 3 bulan").ruas[0]).toMatchObject({ jenis: "orang-tua", sisi: "lawan" });
    // "4. Bahwa" tidak memotong kalimat (regresi: titik sesudah nomor butir)
    expect(ruas("4. Bahwa setelah menikah, Pemohon dan Termohon tinggal bersama di rumah orangtua Termohon di Kabupaten Bone hingga pisah rumah;").ruas[0]).toMatchObject({ jenis: "orang-tua", sisi: "pelaku" });
  });
  it("rumah saksi dipetakan lewat hubungan saksi (ibu kandung Penggugat -> rumah orang tua Penggugat)", () => {
    const r = ruas("Setelah menikah Penggugat dan Tergugat tinggal bersama di rumah saya di Desa Lalombi hingga pisah rumah;", true);
    expect(r.ruas[0].jenis).toBe("rumah-saksi");
    const m = tt.ruasSaksiDipetakan(r.ruas[0], { kunci: "Ibu Kandung", golongan: "keluarga", sisi: "lawan" });
    expect(m).toMatchObject({ jenis: "orang-tua", sisi: "lawan", dipetakan: "Ibu Kandung" });
  });
  it("kartu 1006 & 8570: posita + saksi sama -> cukup; saksi berbeda -> bentrok; kutipan posita & saksi", () => {
    const s1 = "- Bahwa Setelah menikah Penggugat dan Tergugat tinggal bersama di rumah orang tua Penggugat di Desa Kotapulu, setelah itu tinggal di rumah Tergugat hingga pisah rumah";
    const k = tt.usulanTempatTinggal({ posita: POSITA_TT, saksi1: s1, saksi2: "" });
    const u1006 = k.usulan.find((x: any) => x.kode === "1006");
    const u8570 = k.usulan.find((x: any) => x.kode === "8570");
    expect(u1006.keyakinan).toBe("cukup");
    expect(u1006.sumber.map((x: any) => x.asal || `saksi${x.saksi}`)).toEqual(["posita", "saksi1"]);
    expect(u8570.nilai).toBe("rumah Tergugat di Desa Kotapulu");
    expect(u8570.keyakinan).toBe("cukup");
    const beda = tt.usulanTempatTinggal({ posita: POSITA_TT, saksi1: "- Bahwa Setelah menikah Penggugat dan Tergugat tinggal bersama di rumah orang tua Tergugat hingga berpisah", saksi2: "" });
    expect(beda.usulan.find((x: any) => x.kode === "1006").keyakinan).toBe("bentrok");
    expect(beda.usulan.find((x: any) => x.kode === "1006").catatan).toMatch(/BERBEDA dengan posita/);
  });
  it("tanpa posita: saksi tanpa 'rumah saya' -> usulan ragu; saksi 'rumah saya' -> tanpa kartu; tidak pernah serumah -> 1006 kosong", () => {
    const a = tt.usulanTempatTinggal({ posita: "", saksi1: "- Bahwa Setelah menikah Penggugat dan Tergugat tinggal bersama di rumah kontrakan di Kota Palu hingga pisah rumah", saksi2: "" });
    expect(a.usulan.find((x: any) => x.kode === "1006")).toMatchObject({ nilai: "rumah kontrakan di Kota Palu", keyakinan: "ragu" });
    const b = tt.usulanTempatTinggal({ posita: "", saksi1: "- Bahwa Setelah menikah Penggugat dan Tergugat tinggal bersama di rumah saya hingga pisah rumah", saksi2: "" });
    expect(b.usulan).toEqual([]);
    const c = tt.usulanTempatTinggal({ posita: "<p>Bahwa setelah menikah antara Pemohon dan Termohon tidak pernah tinggal bersama hingga saat ini</p>" });
    expect(c.usulan.find((x: any) => x.kode === "1006")).toMatchObject({ nilai: "", kodePola: "tt-tidak-serumah" });
  });
});

// ============================================================================
// F. RUTE /abt/usulan SUNGGUHAN (sumber "saksi")
// ============================================================================
const BERKAS_RUTE = path.join(BOT, "routes", "internalGatewayRoutes.js");
let penanganBot: (body: unknown) => Promise<{ status: number; json: any }>;
let positaSipp = "";
beforeAll(() => {
  const isi = readFileSync(BERKAS_RUTE, "utf8");
  const tanda = isi.indexOf("// PENYARING MASUKAN /abt/usulan (kontrak K6)");
  const awal = isi.lastIndexOf("\n// ====", tanda);
  const akhir = isi.indexOf('router.post("/abt/pdf"');
  if (!(tanda > 0 && awal > 0 && akhir > tanda)) throw new Error("Potongan rute /abt/usulan tidak ditemukan.");
  const rRute = createRequire(BERKAS_RUTE);
  const rute: Record<string, (req: unknown, res: unknown) => Promise<void>> = {};
  const layananAsli = rRute("../services/abtUsulanService");
  const konteks = vm.createContext({
    require: rRute,
    // SIPP tidak ada di uji: posita perkara diganti tiruan pada SATU-SATUNYA pintunya.
    abtUsulanService: { ...layananAsli, konteksPerkaraSaksi: async () => (positaSipp ? { posita: positaSipp, tanggalSidang: "" } : null) },
    requireInternalToken: () => undefined,
    router: { post: (jalur: string, _p: unknown, f: (req: unknown, res: unknown) => Promise<void>) => void (rute[jalur] = f) },
    console,
  });
  vm.runInContext(isi.slice(awal, akhir), konteks, { filename: "internalGatewayRoutes.js#abt-usulan" });
  const f = rute["/abt/usulan"];
  penanganBot = async (body) => {
    let status = 200;
    let json: any = null;
    await f({ body: JSON.parse(JSON.stringify(body)) }, { status: (s: number) => ((status = s), { json: (j: any) => void (json = j) }), json: (j: any) => void (json = j) });
    return { status, json };
  };
});

describe("F. rute /abt/usulan sumber saksi", () => {
  const SAKSI1 = "- Bahwa Setelah menikah Penggugat dan Tergugat tinggal bersama di rumah orang tua Penggugat di Desa Kotapulu, setelah itu tinggal di rumah Tergugat hingga pisah rumah\n- Bahwa sering terjadi perselisihan dan pertengkaran sejak tahun 2023";
  const SAKSI2 = "- Bahwa sering terjadi perselisihan dan pertengkaran sejak tahun 2023";
  it("posita dari ekstensi: kartu 1006/8570 ditambahkan; usulan lama sama persis dengan dariKeteranganSaksi", async () => {
    positaSipp = "";
    const bot = await penanganBot({ sumber: "saksi", nomorPerkara: "381/Pdt.G/2025/PA.Dgl", saksi1: SAKSI1, saksi2: SAKSI2, pelaku: "Tergugat", lawan: "Penggugat", posita: POSITA_TT });
    const kode = bot.json.saksi.usulan.map((u: any) => u.kode);
    expect(kode).toContain("1006");
    expect(kode).toContain("8570");
    const langsung = usulan.dariKeteranganSaksi(SAKSI1, SAKSI2, "", { pelaku: "Tergugat", lawan: "Penggugat" }, POSITA_TT);
    expect(kode.slice(0, langsung.usulan.length)).toEqual(langsung.usulan.map((u: any) => u.kode));
    const u = bot.json.saksi.usulan.find((x: any) => x.kode === "1006");
    expect(u.sumber[0]).toMatchObject({ asal: "posita" });
    expect(bot.json.saksi.tempatTinggal.posita.ruas.length).toBe(3);
  });
  it("ekstensi tanpa posita (blangko BAS tanpa 5125): posita SIPP dipakai", async () => {
    positaSipp = POSITA_TT;
    const bot = await penanganBot({ sumber: "saksi", nomorPerkara: "381/Pdt.G/2025/PA.Dgl", saksi1: SAKSI1, saksi2: SAKSI2, pelaku: "Tergugat", lawan: "Penggugat", posita: "" });
    const u = bot.json.saksi.usulan.find((x: any) => x.kode === "1006");
    expect(u.nilai.startsWith("rumah orang tua Penggugat di Desa Kotapulu")).toBe(true);
    positaSipp = "";
  });
});
