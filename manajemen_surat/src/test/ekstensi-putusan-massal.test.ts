/**
 * Ekstensi 1.131.0 - putusan massal ABT + SIPP.
 *
 * ============================================================================
 * YANG DIUJI DI SINI ADALAH KEPUTUSANNYA, DIJALANKAN SUNGGUHAN
 * ============================================================================
 *
 * Fondasi massal (pemetaan blangko, antrean lintas-tab, sidang pada tanggal)
 * dipotong dari panel-alat.js dan dijalankan di node:vm dengan chrome.storage,
 * fetch, dan document tiruan. Yang dijaga perilakunya, bukan bentuk kodenya:
 *
 *   - token blangko yang tidak sah TIDAK tersimpan sebagai pemetaan,
 *   - antrean yang habis menjawab null, bukan mengulang perkara terakhir,
 *   - satu perkara gagal tidak mengubah keadaan perkara lain,
 *   - "sudah putus" tidak pernah ditawarkan untuk diisi ulang.
 *
 * Itu keputusan yang, kalau hanya dibaca teksnya, tidak pernah benar-benar
 * teruji - dan cacatnya baru terlihat ketika sudah menyentuh berkas perkara
 * yang sungguhan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const sumberAlat = readFileSync(path.join(AKAR, "panel-alat.js"), "utf8");
const abt = readFileSync(path.join(AKAR, "abt.js"), "utf8");
const konten = readFileSync(path.join(AKAR, "konten.js"), "utf8");
const gaya = readFileSync(path.join(AKAR, "panel.css"), "utf8");

type Konteks = Record<string, unknown> & { [k: string]: any };

function elemenTiruan(tag: string): any {
  const anak: any[] = [];
  return {
    tagName: String(tag).toUpperCase(),
    className: "",
    textContent: "",
    title: "",
    hidden: false,
    value: "",
    dataset: {},
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    removeAttribute() {},
    getAttribute: () => null,
    appendChild: (x: any) => (anak.push(x), x),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    anak,
  };
}

function jalankanAlat(saluranFetch?: (url: string, opsi: any) => any): Konteks {
  const simpanan: Record<string, unknown> = {};
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
    URLSearchParams,
    URL,
    AbortController,
    document: {
      documentElement: elemenTiruan("html"),
      createElement: (t: string) => elemenTiruan(t),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
    },
    location: { origin: "http://127.0.0.1", pathname: "/aps_badilag/abt/main/beranda", search: "" },
    window: {
      location: { hostname: "127.0.0.1", pathname: "/index.php", search: "", origin: "http://127.0.0.1" },
      sessionStorage: { getItem: () => null, setItem() {} },
      localStorage: { getItem: () => null, setItem() {} },
      addEventListener() {},
      postMessage() {},
    },
    chrome: {
      runtime: { getManifest: () => ({ version: "1.131.0" }), getURL: (p: string) => p },
      storage: {
        onChanged: { addListener() {} },
        local: {
          get: async (kunci: string[]) => {
            const hasil: Record<string, unknown> = {};
            for (const k of kunci) if (k in simpanan) hasil[k] = simpanan[k];
            return hasil;
          },
          set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, isi),
          remove: async (kunci: string[]) => {
            for (const k of kunci) delete simpanan[k];
          },
        },
      },
    },
    // alatAmbil menyalin (clone) jawaban GET untuk tiap peminta - jawaban
    // tiruan pun harus dapat disalin, kalau tidak yang diuji bukan kodenya.
    fetch: async (url: string, opsi: any) => {
      const r = saluranFetch ? await saluranFetch(url, opsi) : { ok: true, status: 200, json: async () => ({ ok: true }) };
      if (r && typeof r.clone !== "function") r.clone = () => r;
      return r;
    },
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
  };
  konteks.globalThis = konteks;
  vm.createContext(konteks);
  vm.runInContext(sumberAlat, konteks, { filename: "panel-alat.js" });
  return konteks;
}

// ============================================================================
describe("pemetaan blangko - dapat disunting, dan tidak menerima sampah", () => {
  it("kunci jenis merapikan besar-kecil dan spasi", () => {
    const k = jalankanAlat();
    expect(k.alatKunciJenis("  Cerai   Gugat ")).toBe("cerai gugat");
    expect(k.alatKunciJenis("CERAI GUGAT")).toBe("cerai gugat");
  });

  it("baris yang lengkap dikenali; yang tokennya kosong tidak", () => {
    const k = jalankanAlat();
    const penuh = k.alatRapikanBlangko({ blangko: "(C3) 1", berkas: "CG Verstek", a: "aB9+/xy=", b: "cD8_klmn" });
    expect(k.alatBlangkoLengkap(penuh)).toBe(true);
    const kurang = k.alatRapikanBlangko({ blangko: "(C3) 1", berkas: "CG Verstek", a: "", b: "cD8_klmn" });
    expect(k.alatBlangkoLengkap(kurang)).toBe(false);
  });

  it("token yang mengandung spasi atau kutip DIBUANG - ia tidak akan pernah sah bagi ABT", () => {
    const k = jalankanAlat();
    const kotor = k.alatRapikanBlangko({ blangko: "x", berkas: "y", a: 'a" onload=', b: "b c" });
    expect(kotor.a).toBe("");
    expect(kotor.b).toBe("");
  });

  it("pemetaan bertahan di penyimpanan ekstensi", async () => {
    const k = jalankanAlat();
    await k.alatSimpanPetaBlangko({ "cerai gugat": { blangko: "x", berkas: "y", a: "aaaaaaaa", b: "bbbbbbbb" } });
    const kembali = await k.alatMuatPetaBlangko();
    expect(kembali["cerai gugat"].berkas).toBe("y");
  });

  it("token dibaca dari tautan ABT - onclick post() maupun href preview", () => {
    const k = jalankanAlat();
    const dariOnclick = k.alatTokenDariTautan({
      getAttribute: (n: string) =>
        n === "onclick"
          ? 'showLoading();post("/aps_badilag/abt/main/cari", { a:"ENCDIR123", b:"ENCFILE456", c:"789" });'
          : null,
    });
    expect(dariOnclick).toMatchObject({ a: "ENCDIR123", b: "ENCFILE456" });
    const dariHref = k.alatTokenDariTautan({
      getAttribute: (n: string) => (n === "href" ? "/aps_badilag/abt/preview?c=1&b=BB&a=AA&d=3" : null),
    });
    expect(dariHref).toMatchObject({ a: "AA", b: "BB", d: "3" });
  });

  it("alamat preview terisi hanya bila blangkonya lengkap", () => {
    const k = jalankanAlat();
    const peta = k.alatRapikanBlangko({ blangko: "x", berkas: "y", a: "AAAAAAAA", b: "BBBBBBBB", d: "5" });
    const alamat = k.alatAlamatPreviewAbt("http://127.0.0.1/aps_badilag/abt", peta, "492");
    expect(alamat).toContain("c=492");
    expect(alamat).toContain("a=AAAAAAAA");
    expect(alamat).toContain("d=5");
    expect(k.alatAlamatPreviewAbt("http://x", peta, "")).toBe("");
  });
});

// ============================================================================
describe("antrean massal - lintas tab, dan tidak mengulang yang selesai", () => {
  it("dibuat dengan seluruh butir menunggu, dan batas jumlah", () => {
    const k = jalankanAlat();
    const butir = Array.from({ length: 200 }, (_, i) => ({ nomor: `${i}/Pdt.G`, perkaraId: `${i}` }));
    const q = k.alatBuatAntrean({ tahap: "abt", butir });
    expect(q.butir.length).toBeLessThanOrEqual(120);
    expect(q.butir.every((b: any) => b.keadaan === "menunggu")).toBe(true);
    expect(q.kering).toBe(true); // kering kecuali disebut sebaliknya
  });

  it("berikutnya menunjuk yang menunggu; habis menjawab null", () => {
    const k = jalankanAlat();
    const q = k.alatBuatAntrean({ butir: [{ nomor: "1" }, { nomor: "2" }] });
    expect(k.alatAntreanBerikutnya(q).nomor).toBe("1");
    q.butir[0].keadaan = "selesai";
    expect(k.alatAntreanBerikutnya(q).nomor).toBe("2");
    q.butir[1].keadaan = "gagal";
    expect(k.alatAntreanBerikutnya(q)).toBeNull();
  });

  it("ringkas menghitung tiap keadaan", () => {
    const k = jalankanAlat();
    const q = k.alatBuatAntrean({ butir: [{ nomor: "1" }, { nomor: "2" }, { nomor: "3" }] });
    q.butir[0].keadaan = "selesai";
    q.butir[1].keadaan = "gagal";
    const h = k.alatAntreanRingkas(q);
    expect(h).toMatchObject({ selesai: 1, gagal: 1, menunggu: 1 });
  });

  it("disimpan lalu dimuat kembali - inilah yang menyeberang dari tab ABT ke tab SIPP", async () => {
    const k = jalankanAlat();
    const q = k.alatBuatAntrean({ tahap: "sipp", modus: "otomatis", butir: [{ nomor: "492/Pdt.G", perkaraId: "1" }] });
    await k.alatSimpanAntrean(q);
    const kembali = await k.alatMuatAntrean();
    expect(kembali.tahap).toBe("sipp");
    expect(kembali.modus).toBe("otomatis");
    expect(kembali.butir[0].nomor).toBe("492/Pdt.G");
  });

  it("disimpan null berarti benar-benar dibuang", async () => {
    const k = jalankanAlat();
    await k.alatSimpanAntrean(k.alatBuatAntrean({ butir: [{ nomor: "1" }] }));
    await k.alatSimpanAntrean(null);
    expect(await k.alatMuatAntrean()).toBeNull();
  });
});

// ============================================================================
describe("sidang pada satu tanggal - menyodorkan, bukan memutuskan", () => {
  it("satu perkara satu baris walau bersidang dua kali sehari", async () => {
    const k = jalankanAlat(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        available: true,
        sidang: [
          { nomorPerkara: "1/Pdt.G", perkaraId: "10", jenisPerkara: "Cerai Gugat", agenda: "Pembuktian", sudahPutus: false },
          { nomorPerkara: "1/Pdt.G", perkaraId: "10", jenisPerkara: "Cerai Gugat", agenda: "Putusan", sudahPutus: false },
          { nomorPerkara: "2/Pdt.G", perkaraId: "11", jenisPerkara: "Cerai Gugat", agenda: "Putusan", sudahPutus: true },
        ],
      }),
    }));
    const hasil = await k.alatSidangPadaTanggal("2026-09-13");
    expect(hasil.length).toBe(2);
    expect(hasil.find((x: any) => x.nomor === "2/Pdt.G").sudahPutus).toBe(true);
  });

  it("ALETA yang tak menjawab dilaporkan, bukan ditelan jadi daftar kosong", async () => {
    const k = jalankanAlat(async () => ({ ok: true, status: 200, json: async () => ({ available: false, message: "bot mati" }) }));
    await expect(k.alatSidangPadaTanggal("2026-09-13")).rejects.toThrow(/bot mati/);
  });

  it("tanggal hari ini berbentuk YYYY-MM-DD", () => {
    const k = jalankanAlat();
    expect(k.alatTanggalIso(new Date("2026-09-13T10:00:00"))).toBe("2026-09-13");
  });
});

// ============================================================================
describe("pemasangan - ketiga panel, dan penjaganya", () => {
  it("panel massal ABT dipasang pada halaman beranda blangko", () => {
    expect(abt).toContain("void pasangMassalAbt();");
    expect(abt).toContain("function halamanBerandaAbt()");
    // Beranda blangko: ada bilah kelompok DAN kartu berkas, bukan halaman
    // variabel satu perkara.
    const badan = abt.slice(abt.indexOf("function halamanBerandaAbt()"));
    expect(badan.slice(0, 300)).toContain("if (halamanBlangko() || halamanTanyaJawab()) return false;");
  });

  it("konsumen antrean SIPP dipasang di panel perkara dan panel daftar", () => {
    expect(konten).toContain("void bagianAntreanSipp(konteks.nomorPerkara).then");
    expect(konten).toContain('void bagianAntreanSipp("").then');
  });

  it("mode otomatis mengisi sendiri; manual berhenti untuk diperiksa", () => {
    const badan = konten.slice(konten.indexOf("async function bagianAntreanSipp("));
    const fungsi = badan.slice(0, badan.indexOf("\nconst NAMA_KEADAAN_ANTREAN"));
    expect(fungsi).toContain('if (antrean.modus === "otomatis") {');
    expect(fungsi).toContain("jalankanSatuAntreanSipp");
  });

  it("perkara yang sudah putus TIDAK diisi ulang", () => {
    const badan = konten.slice(konten.indexOf("async function jalankanSatuAntreanSipp("));
    const fungsi = badan.slice(0, badan.indexOf("\n}\n", badan.indexOf("bacaPutusanSegar")));
    expect(fungsi).toContain("if (segar && segar.sudahPutus) {");
    expect(fungsi).toContain('butir.keadaan = "dilewati";');
  });

  it("satu perkara gagal tidak menghentikan sisanya (ABT)", () => {
    // Tiap perkara berdiri sendiri - beda dengan penetapan yang berantai.
    const badan = abt.slice(abt.indexOf("tombolJalan.addEventListener"));
    expect(badan).toContain('butir.keadaan = hasil.ok ? "selesai" : "gagal";');
    // Loopnya tidak break saat gagal.
    const loop = badan.slice(badan.indexOf("for (const butir of antrean.butir)"));
    expect(loop.slice(0, 800)).not.toContain("break;");
  });

  it("gaya panel massal ada dan seimbang", () => {
    expect(gaya).toContain(".aleta-panel-massal");
    expect(gaya).toContain(".aleta-massal-tanggal");
  });
});

// ============================================================================
describe("tidak ada yang tercentang sendiri, dan kering dulu", () => {
  it("ABT: periksa dulu, jalankan menyala sesudah hasilnya dibaca", () => {
    const badan = abt.slice(abt.indexOf("function bagianMassalAbt("));
    // "kering" istilah pemrogram; yang menekannya panitera. Yang dijaga di
    // sini bukan katanya melainkan JANJINYA: tombol pertama harus menyatakan
    // bahwa belum ada yang dikerjakan.
    expect(badan).toContain('buatElemen("button", "aleta-permintaan-tombol", "Periksa dulu - belum dijalankan")');
    expect(badan).not.toContain("(kering)");
    expect(badan).toContain("tombolJalan.disabled = true"); // menyala hanya sesudah diperiksa
    expect(badan).toContain('"Tidak ada yang tercentang sendiri."');
  });

  it("daftar massal dapat dicari, disaring, dan diurutkan", () => {
    const badan = abt.slice(abt.indexOf("function bagianMassalAbt("));
    expect(badan).toContain("aleta-massal-cari");
    expect(badan).toContain("aleta-massal-saring");
    expect(badan).toContain("aleta-massal-urut");
    // Urutan bawaan: agenda yang menyebut putus berdiri di depan.
    expect(badan).toContain("function agendaPutusan(s)");
    expect(badan).toContain("/putus/i.test(String((s && s.agenda)");
  });

  it("yang tercentang TIDAK hilang ketika daftarnya disaring", () => {
    // Saringan mengubah yang terlihat, bukan yang terpilih. Centang yang
    // lenyap diam-diam ketika saringan diganti adalah cara paling halus untuk
    // menjalankan perkara yang tidak dimaksudkan - atau melewatkan yang
    // dimaksudkan.
    const badan = abt.slice(abt.indexOf("function bagianMassalAbt("));
    expect(badan).toContain("const dicentang = new Set();");
    expect(badan).toContain("centang.checked = dicentang.has(s.nomor);");
    // Yang dijalankan dibaca dari ingatan, bukan dari baris yang tergambar.
    expect(badan).toContain("return keadaan.sidang.filter((s) => dicentang.has(s.nomor) && !s.sudahPutus);");
    // Dan berapa yang tercentang tetapi tidak terlihat DISEBUT.
    expect(badan).toContain("tidak terlihat");
  });

  it("unggah dokumen ke SIPP mati secara bawaan - ia yang benar-benar menulis", () => {
    const badan = abt.slice(abt.indexOf("function bagianMassalAbt("));
    // saklar("...", "unggah", false, ...)
    expect(badan).toMatch(/saklar\("Unggah dokumen ke SIPP", "unggah", false/);
  });
});

// ============================================================================
describe("pemetaan menurut NAMA - token menyusul dari halaman ABT (1.131.0)", () => {
  const popupJs = readFileSync(path.join(AKAR, "popup.js"), "utf8");
  const popupHtml = readFileSync(path.join(AKAR, "popup.html"), "utf8");

  it("kunci berkas mengabaikan besar-kecil, spasi ganda, dan akhiran .rtf", () => {
    const k = jalankanAlat();
    expect(k.alatKunciBerkas("  [01]  [Kabul Verstek] Cerai (Format Lengkap).RTF ")).toBe(
      "[01] [kabul verstek] cerai (format lengkap)"
    );
  });

  it("baris bernama tanpa token: terpetakan, tetapi belum lengkap", () => {
    const k = jalankanAlat();
    const b = k.alatRapikanBlangko({ berkas: "[01] [Kabul Verstek] Cerai (Format Lengkap)" });
    expect(k.alatBlangkoTerpetakan(b)).toBe(true);
    expect(k.alatBlangkoLengkap(b)).toBe(false);
  });

  it("bawaan cerai terisi pada pemuatan pertama, dan tidak menimpa yang pernah disunting", async () => {
    const k = jalankanAlat();
    const peta = await k.alatMuatPetaBlangkoLengkap();
    expect(peta["cerai gugat"].berkas).toBe("[01] [Kabul Verstek] Cerai (Format Lengkap)");
    expect(peta["cerai talak"].berkas).toBe("[01] [Kabul Verstek] Cerai (Format Lengkap)");
    expect(peta["cerai gugat"].a).toBeUndefined();
    // Ketiganya DIPERIKSA pada folder blangko peladen 14 September 2026.
    // Sebelumnya dispensasi berisi tebakan dari ABT setempat yang ditandai
    // "periksa namanya di peladen"; ternyata nama itu tidak ada di sana sama
    // sekali - putusan massal dispensasi akan berhenti pada "berkas tidak
    // ditemukan" tanpa ada yang tahu sebabnya.
    expect(peta["itsbat nikah"].berkas).toBe("[01] [Kabul] IN");
    expect(peta["dispensasi kawin"].berkas).toBe("[01] [Kabul] DK - (Anak P Cewek) Hamil");
    // Dua varian kabul berdampingan di peladen untuk satu jenis perkara yang
    // sama di SIPP. Bawaan hanya dapat menyebut satu, jadi catatannya menyebut
    // nama yang lain - supaya yang memilih tidak perlu mencarinya di ABT.
    expect(peta["dispensasi kawin"].catatan).toMatch(/Anak P Cowok\) Calon Istri Hamil/);
    expect(peta["dispensasi kawin"].catatan).not.toMatch(/periksa namanya di peladen/);
    // Disunting (termasuk dilepas menjadi kosong) - bawaan tidak kembali.
    await k.alatSimpanPetaBlangko({ "cerai gugat": { jenisAsli: "Cerai Gugat", berkas: "", bawaan: false } });
    const lagi = await k.alatMuatPetaBlangkoLengkap();
    expect(lagi["cerai gugat"].berkas).toBe("");
    expect(lagi["cerai talak"].berkas).toBe("[01] [Kabul Verstek] Cerai (Format Lengkap)");
  });

  it("berkas dibaca dari HTML kelompok ABT persis dalam bentuk yang ditulis beranda.php", () => {
    // onclick membentang beberapa baris dengan tab, kutip ganda di dalam
    // kutip tunggal - bentuk sebenarnya dari views/abt/beranda.php.
    const html =
      '<div class="pricing-top satu">\n<h3>(C3) 1, Verstek CG</h3>\n</div>\n' +
      "<div class=\"pricing-bottom-bottom\">\n" +
      "\t<p><a title='ukuran file 300 kb' href='#' onclick='showLoading();post(\"http://x/aps_badilag/index.php/abt/main/cari\", {\n" +
      '\t\ta:"ENCDIR+/=1",\n\t\tb:"ENCFILE_2",\n\t\tc:""\n\t\t});\'># <span>[01] [Kabul Verstek] Cerai (Format Lengkap).rtf</span></a></p>\n' +
      "\t<p><a title='ukuran file 120 kb' href='#' onclick='showLoading();post(\"http://x/cari\", {\n" +
      '\t\ta:"ENCDIR+/=1",\n\t\tb:"ENCFILE_3",\n\t\tc:""\n\t\t});\'># <span>@ Pertimbangan PNS.rtf</span></a></p>\n' +
      "</div>";
    const k = jalankanAlat();
    const daftar = k.alatUraiBerkasDariHtml(html);
    expect(daftar.length).toBe(2);
    expect(daftar[0]).toMatchObject({ blangko: "(C3) 1, Verstek CG", berkas: "[01] [Kabul Verstek] Cerai (Format Lengkap).rtf", a: "ENCDIR+/=1", b: "ENCFILE_2" });
    const cocok = k.alatCocokkanBerkas(daftar, "[01] [Kabul Verstek] Cerai (Format Lengkap)");
    expect(cocok && cocok.b).toBe("ENCFILE_2");
    expect(k.alatCocokkanBerkas(daftar, "tidak ada")).toBeNull();
  });

  it("tautan kelompok dibaca dari bilah beranda; satu kelompok satu baris", () => {
    const html =
      '<button class="accordion">Putusan &amp; Penetapan</button><div class="panel">' +
      '<a title="(12 Blangko)" href="http://x/aps_badilag/index.php/abt/main/beranda?a=ENC_A&c=">(C3) 0, Kabul Atau Contra Cerai</a>' +
      '<a class="active" title="(4 Blangko)" href="http://x/aps_badilag/index.php/abt/main/beranda?a=ENC_B&c=">(C3) 1, Verstek CG</a>' +
      '<a href="http://x/aps_badilag/index.php/abt/main/beranda?a=ENC_B&c=">(C3) 1, Verstek CG (ulang)</a>' +
      "</div>";
    const k = jalankanAlat();
    const daftar = k.alatUraiKelompokDariHtml(html);
    expect(daftar.map((x: any) => x.kelompok)).toEqual(["(C3) 0, Kabul Atau Contra Cerai", "(C3) 1, Verstek CG"]);
    expect(daftar[1].a).toBe("ENC_B");
  });

  it("panel ABT mencari token menurut nama, dan mengisinya ke pemetaan - tanpa menghapus yang tidak ketemu", () => {
    expect(abt).toContain("async function cariTokenBlangko(namaBerkas, lapor) {");
    const badan = abt.slice(abt.indexOf("async function lengkapiTokenPeta("));
    const fungsi = badan.slice(0, badan.indexOf("\n}\n"));
    expect(fungsi).toContain('baris.catatan = "berkas tidak ditemukan di ABT ini";');
    expect(fungsi).not.toContain("delete peta[");
    // Halaman yang tergambar dibaca dahulu - tanpa jaringan.
    const cari = abt.slice(abt.indexOf("async function cariTokenBlangko("));
    expect(cari.slice(0, 700)).toContain("alatCocokkanBerkas(berkasBlangkoDiHalaman(), namaBerkas)");
  });

  it("panel ABT: tiga keadaan baris, tombol Ketik dan Ambil token, dan token dilepas bila namanya berganti", () => {
    const editor = abt.slice(abt.indexOf("function bagianPetaBlangkoAbt("));
    const badan = editor.slice(0, editor.indexOf("\n/* ─── Massal"));
    expect(badan).toContain("token belum diambil");
    expect(badan).toContain('buatElemen("button", "aleta-perkakas-pulih", "Ketik")');
    expect(badan).toContain('"Ambil token dari ABT"');
    expect(badan).toContain("keadaan.peta[kunci] = { jenisAsli: label, berkas: nama, bawaan: false };");
  });

  it("blangko KHUSUS per perkara menang atas pemetaan jenisnya - di baris, rencana, dan saat dijalankan", () => {
    const massal = abt.slice(abt.indexOf("function bagianMassalAbt("));
    const badan = massal.slice(0, massal.indexOf("\nasync function kerjakanSatuPerkaraAbt("));
    expect(badan).toContain("const petaUntuk = (s) => pilihanPer.get(s.nomor) || keadaan.peta[alatKunciJenis(s.jenis)];");
    expect(badan).toContain('pilih.className = "aleta-massal-pilih-berkas";');
    expect(badan).toContain(".filter((s) => alatBlangkoLengkap(petaUntuk(s)))");
    expect(badan).toContain("const peta = petaUntuk(butir);");
    expect(badan).not.toContain("keadaan.peta[alatKunciJenis(butir.jenis)]");
  });

  it("popup menyunting pemetaan yang sama: kunci penyimpanan, bawaan, dan kunci jenis identik dengan panel", () => {
    expect(popupJs).toContain('const KUNCI_PETA_BLANGKO = "petaBlangkoPutusan";');
    expect(sumberAlat).toContain('const ALAT_PETA_BLANGKO_KUNCI = "petaBlangkoPutusan";');
    expect(popupJs).toContain('const BERKAS_CERAI_BAWAAN = "[01] [Kabul Verstek] Cerai (Format Lengkap)";');
    expect(sumberAlat).toContain('const ALAT_BERKAS_CERAI_BAWAAN = "[01] [Kabul Verstek] Cerai (Format Lengkap)";');
    expect(popupJs).toContain('const BERKAS_ITSBAT_BAWAAN = "[01] [Kabul] IN";');
    expect(sumberAlat).toContain('const ALAT_BERKAS_ITSBAT_BAWAAN = "[01] [Kabul] IN";');
    expect(popupJs).toContain('const BERKAS_DISPENSASI_BAWAAN = "[01] [Kabul] DK - (Anak P Cewek) Hamil";');
    expect(sumberAlat).toContain('const ALAT_BERKAS_DISPENSASI_BAWAAN = "[01] [Kabul] DK - (Anak P Cewek) Hamil";');
    for (const kunci of ['"cerai gugat"', '"cerai talak"', '"itsbat nikah"', '"dispensasi kawin"']) {
      expect(popupJs).toContain(kunci);
      expect(sumberAlat).toContain(kunci);
    }
    expect(popupHtml).toContain('id="bagianPeta"');
    expect(popupJs).toContain("void pasangPetaBlangkoPopup(peran);");
    // Nama yang berganti melepas token lama - ia milik berkas yang lain.
    expect(popupJs).toContain("? { jenisAsli: baris.jenisAsli || kunci, berkas: nama, bawaan: false }");
    // Dihapus = ditandai kosong, supaya bawaan tidak kembali diam-diam.
    expect(popupJs).toContain('peta[kunci] = { jenisAsli: baris.jenisAsli || kunci, berkas: "", bawaan: false };');
  });

  it("fitur 2: antrean SIPP disusun dari tanggal sidang; yang tanpa draf tidak dijanjikan", () => {
    expect(konten).toContain("function bagianMassalSipp()");
    expect(konten).toContain("isi.appendChild(bagianMassalSipp());");
    const badan = konten.slice(konten.indexOf("function bagianMassalSipp()"));
    expect(badan).toContain("centang.disabled = true;");
    expect(badan).toContain('t.tanda.textContent = "draf ada";');
    expect(badan).toContain('tahap: "sipp",');
    expect(badan).toContain("modus: pilihModus.value,");
    expect(badan).toContain('"Tidak ada yang tercentang sendiri; yang sudah putus tidak ditawarkan."');
  });
});

// ============================================================================
describe("pemetaan diisi dari pohon blangko portal (1.133.0)", () => {
  const popupJs = readFileSync(path.join(AKAR, "popup.js"), "utf8");
  const popupHtml = readFileSync(path.join(AKAR, "popup.html"), "utf8");
  const ruteFile = path.resolve(__dirname, "../app/api/aleta-ecourt/blangko/pohon/route.ts");
  const rute = readFileSync(ruteFile, "utf8");

  const POHON = [
    {
      id: "putusan-cg",
      nama: "Putusan Cerai Gugat",
      folder: "derry_briantono/1 Perceraian CG",
      untuk: ["cerai gugat"],
      ada: true,
      jenjang: [
        { kunci: "kabul verstek", label: "Kabul Verstek", blangko: [{ berkas: "[01] [Kabul Verstek] Cerai (Format Lengkap).rtf", kategori: "Kabul Verstek" }] },
        { kunci: "tolak verstek", label: "Tolak Verstek", blangko: [{ berkas: "[01ab] [Tolak Verstek] Cerai - Tidak ada bukti.rtf", kategori: "Tolak Verstek" }] },
      ],
      usulan: { berkas: "[01] [Kabul Verstek] Cerai (Format Lengkap).rtf", kategori: "Kabul Verstek", kunciJenjang: "kabul verstek" },
    },
    {
      id: "putusan-itsbat",
      nama: "Penetapan Itsbat Nikah",
      folder: "derry_briantono/2 Itsbat Nikah",
      untuk: ["istbat nikah", "itsbat nikah", "pengesahan perkawinan"],
      ada: true,
      jenjang: [{ kunci: "kabul", label: "Kabul", blangko: [{ berkas: "[01] [Kabul] IN.rtf", kategori: "Kabul" }] }],
      usulan: { berkas: "[01] [Kabul] IN.rtf", kategori: "Kabul", kunciJenjang: "kabul" },
    },
    {
      id: "putusan-dispensasi",
      nama: "Penetapan Dispensasi Kawin",
      folder: "derry_briantono/3 Dispensasi Kawin",
      untuk: ["dispensasi kawin"],
      ada: false,
      sebab: "Folder blangko tidak ditemukan.",
      jenjang: [],
      usulan: null,
    },
  ];

  it("nama tampil tanpa .rtf - persis seperti ABT menuliskannya di kartu", () => {
    const k = jalankanAlat();
    expect(k.alatNamaBerkasTampil("  [01] [Kabul] IN.RTF ")).toBe("[01] [Kabul] IN");
  });

  it("set yang cocok mengikuti aturan portal: kata kunci `untuk` terkandung di jenis", () => {
    const k = jalankanAlat();
    expect(k.alatSetCocokJenis(POHON, "Cerai Gugat").map((s: any) => s.id)).toEqual(["putusan-cg"]);
    expect(k.alatSetCocokJenis(POHON, "Istbat Nikah").map((s: any) => s.id)).toEqual(["putusan-itsbat"]);
    expect(k.alatSetCocokJenis(POHON, "Harta Bersama")).toEqual([]);
  });

  it("usulan per jenis: berkas skenario kabul dari set cocok pertama; set yang foldernya tak terbaca menjawab null", () => {
    const k = jalankanAlat();
    expect(k.alatUsulanDariPohon(POHON, "Cerai Gugat")).toMatchObject({
      berkas: "[01] [Kabul Verstek] Cerai (Format Lengkap)",
      blangko: "Putusan Cerai Gugat",
      kategori: "Kabul Verstek",
    });
    expect(k.alatUsulanDariPohon(POHON, "Dispensasi Kawin")).toBeNull();
  });

  it("mengisi baris kosong dan bawaan; baris yang pernah disunting tangan TIDAK disentuh", () => {
    const k = jalankanAlat();
    const peta: any = {
      "cerai gugat": { jenisAsli: "Cerai Gugat", berkas: "[01] [Kabul Verstek] Cerai (Format Lengkap)", bawaan: true },
      "cerai talak": { jenisAsli: "Cerai Talak", berkas: "Pilihan saya sendiri", bawaan: false },
      "itsbat nikah": { jenisAsli: "Itsbat Nikah", berkas: "", bawaan: false },
    };
    const terisi = k.alatIsiPetaDariPohon(peta, POHON, {});
    // cerai gugat: nama sama dengan usulan - tidak ditulis ulang (tokennya bila ada tetap).
    expect(peta["cerai gugat"].bawaan).toBe(true);
    // cerai talak: suntingan tangan menang atas pohon.
    expect(peta["cerai talak"].berkas).toBe("Pilihan saya sendiri");
    // itsbat: kosong -> terisi dari pohon, bersumber pohon, bercatatan.
    expect(peta["itsbat nikah"].berkas).toBe("[01] [Kabul] IN");
    expect(peta["itsbat nikah"].sumber).toBe("pohon");
    expect(peta["itsbat nikah"].catatan).toMatch(/dari pohon blangko/);
    expect(terisi.map((x: any) => x.jenis)).toEqual(["Itsbat Nikah"]);
    // timpa: true pun tidak mengubah baris yang jenisnya tidak punya set di
    // pohon; baris lazim yang belum ada (cerai gugat, itsbat) tetap diisi.
    const peta2: any = { "cerai talak": { jenisAsli: "Cerai Talak", berkas: "Pilihan saya sendiri" } };
    const lagi = k.alatIsiPetaDariPohon(peta2, POHON, { timpa: true });
    expect(peta2["cerai talak"].berkas).toBe("Pilihan saya sendiri");
    expect(lagi.map((x: any) => x.jenis)).not.toContain("Cerai Talak");
    expect(lagi.map((x: any) => x.jenis).sort()).toEqual(["Cerai Gugat", "Itsbat Nikah"]);
  });

  it("baris bersumber pohon boleh diperbarui ketika pohonnya berubah", () => {
    const k = jalankanAlat();
    const peta: any = { "itsbat nikah": { jenisAsli: "Itsbat Nikah", berkas: "[00] Lama", sumber: "pohon" } };
    k.alatIsiPetaDariPohon(peta, POHON, {});
    expect(peta["itsbat nikah"].berkas).toBe("[01] [Kabul] IN");
  });

  it("daftar nama pohon untuk satu jenis memuat seluruh jenjangnya", () => {
    const k = jalankanAlat();
    const nama = k.alatBerkasPohonUntukJenis(POHON, "Cerai Gugat").map((x: any) => x.berkas);
    expect(nama).toEqual(["[01] [Kabul Verstek] Cerai (Format Lengkap)", "[01ab] [Tolak Verstek] Cerai - Tidak ada bukti"]);
  });

  it("rute portal membaca katalog tiap set putusan lewat jembatan bot, berurutan", () => {
    expect(rute).toContain('callAletaBotSippBridge("blangko.katalog", { folder: set.folder })');
    expect(rute).toContain('await pastikanKapabilitas(db, actorUserId, "panel");');
    expect(rute).toContain("for (const satu of daftarSet) set.push(await isiSet(satu));");
    expect(rute).toContain('SET_BLANGKO.filter((set) => set.jenis === "putusan")');
  });

  it("popup dan panel ABT punya tombolnya, dan panel ABT langsung mencari tokennya", () => {
    expect(popupHtml).toContain('id="petaDariPohon"');
    expect(popupJs).toContain("pohon = await ambilPohonBlangkoPopup(asal);");
    expect(popupJs).toContain("if (bernama && ada.bawaan !== true && ada.sumber !== \"pohon\") continue;");
    const editor = abt.slice(abt.indexOf("function bagianPetaBlangkoAbt("));
    expect(editor).toContain('"Isi dari pohon blangko"');
    expect(editor).toContain("const set = await alatAmbilPohonBlangko(\"\");");
    expect(editor).toContain("const token = await lengkapiTokenPeta(keadaan.peta, (t) => {");
  });
});
