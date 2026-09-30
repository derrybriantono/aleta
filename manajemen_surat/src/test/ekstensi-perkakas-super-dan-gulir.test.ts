/**
 * Ekstensi 1.129.0 - tujuh perkakas super admin dan bilah gulir yang dapat
 * ditekan.
 *
 * ============================================================================
 * YANG DIJALANKAN, BUKAN HANYA YANG DIBACA
 * ============================================================================
 *
 * Sebagian besar penjaga ekstensi di repo ini membaca TEKS berkasnya - cara
 * yang masuk akal untuk tata letak dan warna, sebab keduanya memang tinggal
 * di CSS. Tetapi tiga hal di rilis ini adalah KEPUTUSAN, dan keputusan yang
 * hanya dibaca teksnya tidak pernah benar-benar diuji:
 *
 *   - apa yang ditahan mode kering, dan apa yang justru harus lolos;
 *   - halaman ini SIPP yang mana;
 *   - kotak hitam yang tidak boleh tumbuh tanpa batas.
 *
 * Karena itu panel-alat.js benar-benar DIJALANKAN di sini, di dalam konteks
 * node:vm dengan document, window, chrome, dan fetch tiruan seperlunya. Yang
 * diuji perilakunya, bukan kalimatnya.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, beforeEach } from "vitest";

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const sumberAlat = readFileSync(path.join(AKAR, "panel-alat.js"), "utf8");
const gaya = readFileSync(path.join(AKAR, "panel.css"), "utf8");
const konten = readFileSync(path.join(AKAR, "konten.js"), "utf8");
const abt = readFileSync(path.join(AKAR, "abt.js"), "utf8");

const tanpaCatatan = gaya.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

/** SELURUH aturan dengan pemilih itu, disambung - satu pemilih boleh muncul
 *  di beberapa tempat, dan peramban memberlakukan semuanya. */
function aturan(pemilih: string): string {
  const semua: string[] = [];
  for (const m of tanpaCatatan.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].trim().replace(/\s+/g, " ") === pemilih) semua.push(m[2]);
  }
  if (semua.length === 0) throw new Error(`aturan tidak ditemukan: ${pemilih}`);
  return semua.join("\n");
}

// ── panel-alat.js dijalankan sungguhan ───────────────────────────────────────

type Konteks = Record<string, unknown> & { [k: string]: any };

/** Elemen tiruan seadanya - cukup untuk yang disentuh fungsi-fungsi ini. */
function elemenTiruan(tag: string): any {
  const atribut = new Map<string, string>();
  const anak: any[] = [];
  return {
    tagName: String(tag).toUpperCase(),
    className: "",
    textContent: "",
    title: "",
    hidden: false,
    dataset: {},
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute: (n: string, v: string) => atribut.set(n, String(v)),
    removeAttribute: (n: string) => atribut.delete(n),
    getAttribute: (n: string) => (atribut.has(n) ? atribut.get(n) : null),
    appendChild: (x: any) => (anak.push(x), x),
    querySelector: () => null,
    addEventListener() {},
    getBoundingClientRect: () => ({ right: 100, left: 0, top: 0, bottom: 100 }),
    anak,
  };
}

function jalankanAlat(pilihan: { inang?: string; versi?: string } = {}): Konteks {
  const simpananSesi = new Map<string, string>();
  const simpananChrome: Record<string, unknown> = {};
  const akar = elemenTiruan("html");

  const konteks: Konteks = {
    console,
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Promise,
    Error,
    Map,
    Set,
    document: {
      documentElement: akar,
      createElement: (t: string) => elemenTiruan(t),
      querySelector: (p: string) => (pilihan as any).penunjukAda?.includes(p) ? elemenTiruan("div") : null,
      addEventListener() {},
    },
    window: {
      location: { hostname: pilihan.inang || "127.0.0.1", pathname: "/index.php/detil_perkara", search: "" },
      sessionStorage: {
        getItem: (k: string) => (simpananSesi.has(k) ? simpananSesi.get(k)! : null),
        setItem: (k: string, v: string) => void simpananSesi.set(k, v),
      },
      addEventListener() {},
      postMessage() {},
    },
    chrome: {
      runtime: { getManifest: () => ({ version: pilihan.versi || "1.129.0" }) },
      storage: {
        onChanged: { addListener() {} },
        local: {
          get: async (kunci: string[]) => {
            const hasil: Record<string, unknown> = {};
            for (const k of kunci) if (k in simpananChrome) hasil[k] = simpananChrome[k];
            return hasil;
          },
          set: async (isi: Record<string, unknown>) => void Object.assign(simpananChrome, isi),
        },
      },
    },
    fetch: async () => ({ ok: true, status: 200, statusText: "OK", json: async () => ({ ok: true, versi: "1.129.0" }) }),
    navigator: { clipboard: { writeText: async () => undefined } },
    Response: class {
      body: string;
      status: number;
      statusText: string;
      ok: boolean;
      constructor(body: string, init: any) {
        this.body = body;
        this.status = init?.status ?? 200;
        this.statusText = init?.statusText ?? "";
        this.ok = this.status >= 200 && this.status < 300;
      }
      async json() {
        return JSON.parse(this.body);
      }
    },
    AbortController: class {
      signal = {};
      abort() {}
    },
  };
  konteks.globalThis = konteks;
  vm.createContext(konteks);
  vm.runInContext(sumberAlat, konteks, { filename: "panel-alat.js" });
  return konteks;
}

// ============================================================================
describe("lingkungan: SIPP yang mana", () => {
  it("127.0.0.1 adalah LOKAL, dan itu disebut dengan tegas", () => {
    const k = jalankanAlat({ inang: "127.0.0.1" });
    const l = k.alatLingkungan();
    expect(l.kunci).toBe("lokal");
    expect(l.label).toBe("LOKAL");
    expect(l.judul).toMatch(/komputer ini/i);
  });

  it("192.168.10.10 adalah server, dan judulnya menyebut data sungguhan", () => {
    const k = jalankanAlat({ inang: "192.168.10.10" });
    const l = k.alatLingkungan();
    expect(l.kunci).toBe("peladen");
    expect(l.judul).toMatch(/SUNGGUHAN/);
  });

  it("alamat lain tidak dianggap aman - ia bukan server, bukan komputer ini", () => {
    const k = jalankanAlat({ inang: "10.0.0.9" });
    expect(k.alatLingkungan().kunci).toBe("lain");
  });

  it("di server, petugas biasa tidak melihat lencana apa pun; super admin melihat", () => {
    // Tulisan yang selalu ada berhenti dibaca. Yang perlu menonjol justru
    // ketika halamannya BUKAN peladen.
    const k = jalankanAlat({ inang: "192.168.10.10" });
    expect(k.alatLencanaLingkungan("Panitera Pengganti")).toBeNull();
    expect(k.alatLencanaLingkungan("Super Admin")).not.toBeNull();
  });

  it("di luar server, semua peran melihatnya", () => {
    const k = jalankanAlat({ inang: "127.0.0.1" });
    expect(k.alatLencanaLingkungan("Panitera Pengganti")).not.toBeNull();
    expect(k.alatLencanaLingkungan("")).not.toBeNull();
  });

  it("warnanya tidak ikut palet - artinya bukan selera", () => {
    // Palet boleh berganti menurut selera; yang menyatakan "ini bukan
    // peladen" tidak boleh ikut berganti.
    for (const kelas of [".aleta-lingkungan-lokal", ".aleta-lingkungan-lain", ".aleta-lingkungan-peladen"]) {
      const isi = aturan(kelas);
      expect(isi, kelas).toMatch(/#[0-9a-fA-F]{6}/);
      expect(isi, kelas).not.toContain("var(--aleta-merek");
    }
  });
});

// ============================================================================
describe("mode kering: apa yang ditahan, dan apa yang justru harus lolos", () => {
  let k: Konteks;
  beforeEach(async () => {
    k = jalankanAlat();
    await k.alatSetelKering(true);
  });

  it("tulisan ke ALETA ditahan", () => {
    expect(k.alatKeringMenahan("/aleta/api/aleta-bot/penunjukan/catat", { method: "POST" })).toBe(true);
    expect(k.alatKeringMenahan("/aleta/api/aleta-ecourt/berkas", { method: "PUT" })).toBe(true);
    expect(k.alatKeringMenahan("/aleta/api/x", { method: "DELETE" })).toBe(true);
  });

  it("BACAAN tetap lolos - panel yang kosong tidak memperlihatkan apa pun untuk diperiksa", () => {
    expect(k.alatKeringMenahan("/aleta/api/aleta-bot/sipp-konteks?nomor=1", { method: "GET" })).toBe(false);
    expect(k.alatKeringMenahan("/aleta/api/aleta-bot/sipp-konteks", {})).toBe(false);
    expect(k.alatKeringMenahan("/aleta/api/x", { method: "HEAD" })).toBe(false);
  });

  it("permintaan ke SIPP sendiri tidak disentuh", () => {
    // ALETA tidak pernah menulis ke SIPP lewat jaringan, melainkan lewat
    // borangnya - dan borang itu ditahan di tempat lain.
    expect(k.alatKeringMenahan("/index.php/simpan_putusan", { method: "POST" })).toBe(false);
  });

  it("ketika mati, tidak ada yang ditahan sama sekali", async () => {
    await k.alatSetelKering(false);
    expect(k.alatKeringNyala()).toBe(false);
    expect(k.alatKeringMenahan("/aleta/api/apa-pun", { method: "POST" })).toBe(false);
  });

  it("jawaban tiruannya 423 dan menyebut sebabnya, bukan berpura-pura berhasil", async () => {
    // Yang paling berbahaya adalah mode kering yang menjawab "ok" - panel akan
    // melaporkan tersimpan, padahal tidak ada yang tersimpan.
    const jawab = k.alatJawabanKering("/aleta/api/x", { method: "POST" });
    expect(jawab.status).toBe(423);
    expect(jawab.ok).toBe(false);
    const isi = await jawab.json();
    expect(isi.ok).toBe(false);
    expect(isi.alasan).toBe("mode_kering");
    expect(isi.yangDitahan.cara).toBe("POST");
  });

  it("penandanya dipasang di akar halaman, supaya panel dapat bergaris putus-putus", async () => {
    expect(k.document.documentElement.getAttribute("data-aleta-kering")).toBe("ya");
    await k.alatSetelKering(false);
    expect(k.document.documentElement.getAttribute("data-aleta-kering")).toBeNull();
    expect(aturan('html[data-aleta-kering="ya"] .aleta-panel')).toContain("outline: 2px dashed");
  });

  it("pilihannya bertahan di penyimpanan ekstensi, bukan hanya di halaman ini", async () => {
    await k.alatSetelKering(true);
    const simpan = await k.chrome.storage.local.get(["modeKering"]);
    expect(simpan.modeKering).toBe(true);
    });

  it("pilihan yang baru disetel MENANG atas bacaan penyimpanan yang masih di jalan", async () => {
    // Lomba yang berakibat buruk satu arah: orang mengira tulisan sedang
    // ditahan, padahal bacaan yang terlambat sudah memadamkannya diam-diam.
    const k = jalankanAlat();
    const bacaanTerlambat = k.alatMuatKering();
    await k.alatSetelKering(true);
    await bacaanTerlambat;
    expect(k.alatKeringNyala()).toBe(true);
  });

  it("tab lain ikut seketika lewat chrome.storage.onChanged", () => {
    // Tab sebelah itulah yang paling mungkin dipakai menekan sesuatu.
    const badan = sumberAlat.slice(sumberAlat.indexOf("function alatDengarkanKering("));
    expect(badan.slice(0, 500)).toContain("chrome.storage.onChanged.addListener(");
    expect(badan.slice(0, 500)).toContain("alatTandaiKering();");
  });
});

// ============================================================================
describe("mode kering di jembatan: medan tetap diisi, Simpan yang ditahan", () => {
  it("yang ditahan hanya perintah tekan", () => {
    const badan = konten.slice(konten.indexOf("async function kirimKeJembatan(pesan) {"));
    const fungsi = badan.slice(0, badan.indexOf("\n}\n"));
    expect(fungsi).toContain('if (jenis === "tekan" && alatKeringNyala()) {');
    expect(fungsi).toContain('return { ok: false, alasan: "mode_kering" };');
    // Tidak ada cabang yang menahan "isi" - itu justru yang ingin dilihat.
    expect(fungsi).not.toMatch(/jenis === "isi" && alatKeringNyala\(\)/);
  });

  it("nilai lama dibaca SEBELUM diisi - dari situlah pulihkan mungkin", () => {
    const badan = konten.slice(konten.indexOf("async function kirimKeJembatan(pesan) {"));
    const fungsi = badan.slice(0, badan.indexOf("\n}\n"));
    const letakBaca = fungsi.indexOf('jenis: "nilai"');
    const letakKirim = fungsi.indexOf("const jawab = await kirimKeJembatanLangsung(pesan);");
    expect(letakBaca).toBeGreaterThan(0);
    expect(letakKirim).toBeGreaterThan(letakBaca);
  });

  it("pemulih memakai jalur langsung - tidak tercatat ulang, tidak ikut ditahan", () => {
    // Riwayat yang mencatat pemulihannya sendiri tumbuh tanpa henti; dan
    // mengembalikan keadaan harus tetap boleh justru saat mode kering menyala.
    const badan = konten.slice(konten.indexOf("alatDaftarkanPemulih("));
    expect(badan.slice(0, 600)).toContain("kirimKeJembatanLangsung({");
    expect(badan.slice(0, 600)).not.toContain("await kirimKeJembatan({");
  });

  it("medan yang nilai lamanya GAGAL dibaca tidak pernah ditawari Pulihkan", () => {
    // Bedanya dengan medan yang memang kosong itu menentukan. Yang kosong
    // punya jalan pulang: dikosongkan lagi. Yang gagal dibaca tidak - dan
    // menawarkan Pulihkan untuknya justru akan MENGOSONGKAN medan yang
    // tadinya berisi, dengan meyakinkan, atas nama mengembalikan keadaan.
    const badan = konten.slice(konten.indexOf("async function kirimKeJembatan(pesan) {"));
    const fungsi = badan.slice(0, badan.indexOf("\n}\n"));
    expect(fungsi).toContain("let lamaTerbaca = false;");
    expect(fungsi).toContain("lamaTerbaca = true;");
    expect(fungsi).toContain("dapatPulih: Boolean(jawab && jawab.ok) && lamaTerbaca,");
    // Medan yang tidak tampak juga tidak dihitung terbaca.
    expect(fungsi).toContain("baca.tampak !== false");
  });

  it("penekanan Simpan dicatat sebagai TIDAK dapat dipulihkan", () => {
    const badan = konten.slice(konten.indexOf("async function kirimKeJembatan(pesan) {"));
    const fungsi = badan.slice(0, badan.indexOf("\n}\n"));
    const tekan = fungsi.slice(fungsi.indexOf('jenis: "tekan",'));
    expect(tekan.slice(0, 300)).toContain("dapatPulih: false");
  });
});

// ============================================================================
describe("kotak hitam", () => {
  it("menyimpan yang belum diterjemahkan, dengan batas jumlah", () => {
    const k = jalankanAlat();
    for (let i = 0; i < 120; i += 1) k.alatCatat("ambil", `permintaan ke-${i}`, "");
    const isi = k.alatKotakHitam();
    expect(isi.length).toBe(50);
    // Yang tersisa yang TERAKHIR - kejadian menjelang kegagalan, bukan
    // kejadian saat halaman baru dibuka.
    expect(isi[isi.length - 1].ringkas).toBe("permintaan ke-119");
  });

  it("rinci yang panjang dipotong - kotak hitam tidak boleh membuat halaman berat", () => {
    const k = jalankanAlat();
    k.alatCatat("ambil", "besar", "x".repeat(5000));
    const satu = k.alatKotakHitam()[0];
    expect(satu.rinci.length).toBeLessThanOrEqual(401);
    expect(satu.rinci.endsWith("…")).toBe(true);
  });

  it("selamat dari muat ulang halaman - justru saat itulah ia dibutuhkan", () => {
    // Kegagalan unggah kerap diikuti halaman yang berpindah.
    const k = jalankanAlat();
    k.alatCatat("ambil-galat", "POST /aleta/api/x → TypeError", "gagal");
    const disimpan = k.window.sessionStorage.getItem("aleta-kotak-hitam");
    expect(disimpan).toBeTruthy();
    expect(JSON.parse(disimpan!)[0].ringkas).toContain("TypeError");
  });

  it("dikosongkan berarti benar-benar kosong", () => {
    const k = jalankanAlat();
    k.alatCatat("ambil", "satu", "");
    k.alatKotakKosongkan();
    expect(k.alatKotakHitam()).toEqual([]);
  });

  it("alamat panjang dipendekkan supaya satu baris tetap satu baris", () => {
    const k = jalankanAlat();
    expect(k.alatRingkasAlamat("http://192.168.10.10/aleta/api/x")).toBe("/aleta/api/x");
    expect(k.alatRingkasAlamat(`/aleta/api/${"y".repeat(200)}`).length).toBeLessThanOrEqual(71);
  });
});

// ============================================================================
describe("pemantau permintaan: satu kait, bukan tiga puluh", () => {
  it("fetch dibungkus sekali saja", () => {
    const k = jalankanAlat();
    const sesudahSatu = k.fetch;
    k.alatPasangPemantauAmbil();
    expect(k.fetch).toBe(sesudahSatu);
  });

  it("permintaan yang berhasil tercatat beserta status dan lamanya", async () => {
    const k = jalankanAlat();
    k.alatKotakKosongkan();
    await k.fetch("/aleta/api/aleta-bot/sipp-konteks?nomor=1", { method: "GET" });
    const catatan = k.alatKotakHitam().filter((x: any) => x.jenis === "ambil");
    expect(catatan.length).toBeGreaterThan(0);
    expect(catatan[catatan.length - 1].ringkas).toMatch(/GET \/aleta\/api\/.* → 200 \(\d+ ms\)/);
  });

  it("dalam mode kering, tulisan ditahan dan dicatat sebagai DITAHAN", async () => {
    const k = jalankanAlat();
    await k.alatSetelKering(true);
    k.alatKotakKosongkan();
    const jawab = await k.fetch("/aleta/api/aleta-bot/penunjukan/catat", { method: "POST" });
    expect(jawab.status).toBe(423);
    const catatan = k.alatKotakHitam();
    expect(catatan.some((x: any) => x.jenis === "kering" && x.ringkas.includes("DITAHAN POST"))).toBe(true);
  });
});

// ============================================================================
describe("riwayat tindakan dan jalan pulangnya", () => {
  it("mencatat nilai lama dan baru, dengan batas jumlah", () => {
    const k = jalankanAlat();
    for (let i = 0; i < 60; i += 1) {
      k.alatCatatTindakan({ jenis: "isi", penunjuk: `#m${i}`, nilaiLama: "a", nilaiBaru: "b", dapatPulih: true });
    }
    const r = k.alatRiwayatTindakan();
    expect(r.length).toBe(40);
    expect(r[r.length - 1].penunjuk).toBe("#m59");
  });

  it("nilai yang sangat panjang dipotong", () => {
    const k = jalankanAlat();
    k.alatCatatTindakan({ jenis: "isi", penunjuk: "#posita", nilaiBaru: "z".repeat(2000), dapatPulih: true });
    expect(k.alatRiwayatTindakan()[0].nilaiBaru.length).toBeLessThanOrEqual(300);
  });

  it("yang dipulihkan ditandai, dan tidak ditawarkan dua kali", () => {
    const k = jalankanAlat();
    const baris = k.alatCatatTindakan({ jenis: "isi", penunjuk: "#x", nilaiLama: "lama", nilaiBaru: "baru", dapatPulih: true });
    k.alatTandaiDipulihkan(baris.id);
    expect(k.alatRiwayatTindakan().find((x: any) => x.id === baris.id).dipulihkan).toBe(true);
  });

  it("tanpa pemulih terdaftar, riwayat tetap terbaca - hanya tanpa tombolnya", () => {
    // Panel ABT dan panel portal tidak punya jembatan ke borang SIPP.
    const k = jalankanAlat();
    expect(k.alatRiwayatTindakan()).toEqual([]);
    const badan = sumberAlat.slice(sumberAlat.indexOf("function alatDaftarkanPemulih("));
    expect(badan.slice(0, 200)).toContain('typeof fungsi === "function" ? fungsi : null');
  });
});

// ============================================================================
describe("periksa penunjuk", () => {
  it("yang tidak ketemu dilaporkan, dan wajib-tidaknya dibedakan", () => {
    const k = jalankanAlat();
    k.alatDaftarkanPenunjuk("Kerangka", ["#tidak-ada-sama-sekali"], { wajib: true });
    k.alatDaftarkanPenunjuk("Kadang ada", ["#juga-tidak-ada"], { wajib: false });
    const hasil = k.alatPeriksaPenunjuk();
    expect(hasil.length).toBe(2);
    expect(hasil[0]).toMatchObject({ nama: "Kerangka", ketemu: false, wajib: true });
    expect(hasil[1]).toMatchObject({ nama: "Kadang ada", ketemu: false, wajib: false });
  });

  it("nama yang sama tidak didaftarkan dua kali", () => {
    const k = jalankanAlat();
    k.alatDaftarkanPenunjuk("Kerangka", ["#a"], {});
    k.alatDaftarkanPenunjuk("Kerangka", ["#b"], {});
    expect(k.alatPeriksaPenunjuk().length).toBe(1);
  });

  it("penunjuk yang tidak sah dihitung tidak ketemu, bukan melemparkan error", () => {
    // Penunjuk rusak memang cacat - tetapi laporan yang MELEDAK tidak
    // memberi tahu penunjuk mana yang rusak.
    const k = jalankanAlat();
    k.alatDaftarkanPenunjuk("Rusak", ["!!!bukan penunjuk"], {});
    expect(() => k.alatPeriksaPenunjuk()).not.toThrow();
    expect(k.alatPeriksaPenunjuk()[0].ketemu).toBe(false);
  });

  it("halaman SIPP dan ABT mendaftarkan kerangkanya sebagai wajib", () => {
    expect(konten).toContain('alatDaftarkanPenunjuk("Kerangka SIPP", ["#konten", ".wrapper"], { wajib: true });');
    expect(konten).toContain('alatDaftarkanPenunjuk("Simpan putusan", PENUNJUK_SIMPAN_PUTUSAN, { wajib: false');
    expect(abt).toContain('alatDaftarkanPenunjuk("Kerangka ABT", ["#wrapper", "#content"], { wajib: true });');
    // Yang hanya ada di halaman tertentu TIDAK wajib - peringatan palsu
    // adalah cara tercepat membuat orang berhenti membaca laporan.
    expect(konten).toContain('alatDaftarkanPenunjuk("Tab perkara", ["#usual2", ".usual"], { wajib: false');
  });
});

// ============================================================================
describe("papan kesehatan dan laporan", () => {
  it("menjawab lingkungan, versi, portal, mode kering, dan penunjuk", async () => {
    const k = jalankanAlat({ inang: "192.168.10.10" });
    const papan = await k.alatPapanKesehatan({});
    const nama = papan.map((x: any) => x.nama);
    for (const perlu of ["Lingkungan", "Versi terpasang", "Portal ALETA", "Mode kering", "Kotak hitam", "Penunjuk halaman"]) {
      expect(nama, perlu).toContain(perlu);
    }
    expect(papan.find((x: any) => x.nama === "Lingkungan").keadaan).toBe("awas");
  });

  it("portal yang mati dilaporkan buruk, bukan diam-diam dilewati", async () => {
    const k = jalankanAlat();
    k.fetch = async () => {
      throw new Error("gagal");
    };
    const papan = await k.alatPapanKesehatan({});
    expect(papan.find((x: any) => x.nama === "Portal ALETA").keadaan).toBe("buruk");
  });

  it("versi yang tidak sama menyebutkan apa yang harus dikerjakan", async () => {
    const k = jalankanAlat({ versi: "1.120.0" });
    const papan = await k.alatPapanKesehatan({});
    const baris = papan.find((x: any) => x.nama === "Ekstensi mutakhir");
    expect(baris.keadaan).toBe("awas");
    expect(baris.ket).toMatch(/Muat Ulang/i);
  });

  it("versi tertinggal dijawab null ketika portal mati - portal yang mati bukan urusan versi", async () => {
    const k = jalankanAlat({ versi: "1.120.0" });
    k.fetch = async () => {
      throw new Error("gagal");
    };
    expect(await k.alatVersiTertinggal()).toBeNull();
  });

  it("laporan memuat ketiganya sekaligus: keadaan, riwayat, kotak hitam", () => {
    const k = jalankanAlat({ inang: "127.0.0.1" });
    k.alatCatat("ambil-galat", "POST /aleta/api/x → 500", "invalid byte sequence");
    k.alatCatatTindakan({ jenis: "isi", penunjuk: "#amar", nilaiLama: "", nilaiBaru: "Mengabulkan", dapatPulih: true });
    const teks = k.alatLaporan({ perkara: "492/Pdt.G/2026/PA.Dgl" });
    expect(teks).toContain("LAPORAN ALETA");
    expect(teks).toContain("lingkungan : LOKAL");
    expect(teks).toContain("492/Pdt.G/2026/PA.Dgl");
    expect(teks).toContain("KOTAK HITAM");
    expect(teks).toContain("invalid byte sequence");
    expect(teks).toContain("RIWAYAT TINDAKAN");
    expect(teks).toContain("#amar");
  });
});

// ============================================================================
describe("laci perkakas hanya untuk super admin", () => {
  it("peran lain tidak mendapat tombolnya sama sekali", () => {
    const badan = sumberAlat.slice(sumberAlat.indexOf("function alatTombolPerkakas("));
    expect(badan.slice(0, 400)).toContain('if (peran !== "super" && !/super/i.test(peran)) return null;');
    expect(badan.slice(0, 400)).toContain('if (wadah.querySelector(".aleta-perkakas-tombol")) return null;');
  });

  it("panel digulir ke puncak saat laci dibuka", () => {
    // Laci diletakkan absolut di dalam panel yang bisa digulir; panel yang
    // sedang tergulir membuat kepala lacinya keluar dari layar.
    const badan = sumberAlat.slice(sumberAlat.indexOf("function alatTombolPerkakas("));
    expect(badan).toContain("panel.scrollTop = 0;");
  });

  it("ketiga panel memasangnya", () => {
    expect(sumberAlat).toContain("alatTombolPerkakas(panel, wadah, pilihan);");
    expect(konten).toContain("alatTombolPerkakas(panel, alatKepala, {");
  });

  it("titik peringatan muncul saat mode kering menyala atau versi tertinggal", () => {
    const badan = sumberAlat.slice(sumberAlat.indexOf("function alatTombolPerkakas("));
    expect(badan).toContain('tombol.classList.toggle("aleta-perkakas-perlu", alatKeringNyala())');
    expect(badan).toContain("void alatVersiTertinggal().then((tertinggal) => {");
    expect(aturan(".aleta-perkakas-tombol.aleta-perkakas-perlu::after")).toContain("border-radius: 999px;");
  });
});

// ============================================================================
describe("bilah gulir: mudah dilihat, mudah ditekan", () => {
  const JALUR = ".aleta-panel::-webkit-scrollbar, .aleta-panel .aleta-isi::-webkit-scrollbar, .aleta-panel .aleta-perkakas-isi::-webkit-scrollbar";
  const PEGANGAN = ".aleta-panel::-webkit-scrollbar-thumb, .aleta-panel .aleta-isi::-webkit-scrollbar-thumb, .aleta-panel .aleta-perkakas-isi::-webkit-scrollbar-thumb";
  const TAMPAK =
    '.aleta-panel[data-gulir="tampak"]::-webkit-scrollbar-thumb, .aleta-panel[data-gulir="tampak"] .aleta-isi::-webkit-scrollbar-thumb, .aleta-panel[data-gulir="tampak"] .aleta-perkakas-isi::-webkit-scrollbar-thumb';

  it("jalurnya 12 piksel - sasaran yang dapat ditekan, bukan 9 yang meleset", () => {
    expect(aturan(JALUR)).toContain("width: 12px;");
  });

  it("yang dilihat mata tetap ramping: bingkai tembus pandang + background-clip", () => {
    // Jalurnya 12 piksel penuh untuk kursor; yang dicat hanya 8 di tengahnya.
    const p = aturan(PEGANGAN);
    expect(p).toContain("border: 2px solid transparent;");
    expect(p).toContain("background-clip: padding-box;");
  });

  it("tembus pandang selama tidak dipakai", () => {
    expect(aturan(PEGANGAN)).toContain("background-color: transparent;");
  });

  it("muncul hanya ketika data-gulir=tampak, dan warnanya mengikuti TEMA", () => {
    // --aleta-tulisan-lembut kelabu terang pada tema gelap dan kelabu gelap
    // pada tema terang, jadi satu aturan melayani keduanya tanpa aturan
    // tema terang tersendiri. Diperiksa di layar, bukan disimpulkan: pegangan
    // ini memang terlihat, sementara warna GARIS yang dipakai bilah gulir
    // lama praktis lenyap pada pita setipis ini.
    expect(aturan(TAMPAK)).toContain("background-color: var(--aleta-tulisan-lembut);");
    const terang = aturan('.aleta-panel[data-tema="terang"]');
    expect(terang).toMatch(/--aleta-tulisan-lembut:\s*#[0-9a-fA-F]{6}/);
  });

  it("LEBARNYA tidak pernah ikut berubah antar keadaan", () => {
    // Bilah yang melebar saat disentuh menggeser isi panel tepat ketika
    // orang sedang membidiknya.
    for (const sel of [PEGANGAN, TAMPAK]) {
      expect(aturan(sel), sel).not.toMatch(/(^|\s)width\s*:/);
    }
  });

  it("aturan gulir lama sudah dibuang - dua aturan yang berselisih lebih buruk daripada satu yang salah", () => {
    expect(gaya).not.toContain(".aleta-panel::-webkit-scrollbar { width: 9px; }");
    expect(gaya).not.toContain(".aleta-isi::-webkit-scrollbar { width: 9px; }");
  });

  it("tiga keadaan yang memunculkannya, dan ketiganya berarti sedang berurusan dengan gulir", () => {
    const badan = sumberAlat.slice(sumberAlat.indexOf("function alatPasangGulir("));
    const fungsi = badan.slice(0, badan.indexOf("\n}\n"));
    expect(fungsi).toContain('panel.addEventListener("pointermove"');
    expect(fungsi).toContain('panel.addEventListener("scroll", tampakSebentar, true);');
    expect(fungsi).toContain('panel.addEventListener("focusin", tampakSebentar);');
    // Fase TANGKAP: yang bergulir kerap .aleta-isi, dan scroll tidak menggelembung.
    expect(fungsi).toContain(", true);");
  });

  it("kursor keluar panel menyembunyikannya lagi", () => {
    const badan = sumberAlat.slice(sumberAlat.indexOf("function alatPasangGulir("));
    expect(badan.slice(0, badan.indexOf("\n}\n"))).toContain('panel.addEventListener("pointerleave"');
  });

  it("tidak dipasang dua kali pada panel yang sama", () => {
    const k = jalankanAlat();
    const panel = elemenTiruan("div") as any;
    let jumlah = 0;
    panel.addEventListener = () => {
      jumlah += 1;
    };
    k.alatPasangGulir(panel);
    const sesudahSatu = jumlah;
    k.alatPasangGulir(panel);
    expect(jumlah).toBe(sesudahSatu);
  });

  it("yang meminta gerak dikurangi mendapat pegangan yang tinggal tetap terlihat", () => {
    expect(gaya).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
