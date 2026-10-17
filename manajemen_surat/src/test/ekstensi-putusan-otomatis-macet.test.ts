// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PUTUSAN OTOMATIS MACET DI "MENUNGGU ANONIMISASI SIAP" (7 Okt 2026)
 * ============================================================================
 *
 * Keluhan (perkara 532/Pdt.G/2026 Cerai Talak, UI Baru): sesudah "Isikan yang
 * dicentang" panel berhenti di "13 isian terisi. Menunggu anonimisasi siap..."
 * selamanya - blangko putusan tidak disimpan, edoc putusan dan edoc
 * anonimisasi tidak terunggah.
 *
 * SEBAB (butir 3): anonimisasi yang disiapkan di latar (s1SiapkanAnonimAwal)
 * berhenti di dialog pemeriksa "Pemeriksaan anonimisasi sebelum unggah ke
 * SIPP" - dan dialog itu digambar di kotak naskah di PUNCAK bagian Putusan,
 * jauh di atas tombol Isikan. Penantian di bawah (a30OpsiSimpanPutusan ->
 * await anonSiap) tidak berbatas dan tidak menyebut apa yang ditunggu. ABT
 * yang tidak menjawab (fetch tanpa batas) membuatnya menunggu tanpa akhir pula.
 *
 * SEBAB dialog itu muncul (butir 4): ABT menyamarkan dengan str_replace atas
 * RTF mentah (aps_badilag models/abt/Anonimisasi.php) - persis besar-kecil
 * huruf, hanya nama/alamat pihak dari SIPP. "MUH. RIZAL Bin SUARDIN" di naskah
 * lolos karena SIPP menulisnya "Muh. Rizal Bin Suardin"; nama saksi tidak
 * pernah disentuh.
 *
 * Diuji dengan MENJALANKAN potongan konten.js yang sesungguhnya (bagian
 * Putusan otomatis, anonimisasi, pemeriksa, penyamar) di jsdom; ABT, portal,
 * Simpan, dan unggah edoc ditiru.
 *
 * Pembukti gigitan: ALETA_UJI_KONTEN=<salinan konten.js 0fcfecb> membuat
 * skenario A-D merah (macet / dialog di puncak / tanpa batas).
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const KONTEN = () =>
  (process.env.ALETA_UJI_KONTEN ? readFileSync(process.env.ALETA_UJI_KONTEN, "utf8") : baca("konten.js")).replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");

const ASAL = "http://192.168.10.10";
const NOMOR = "532/Pdt.G/2026/PA.Dgl";
const ANONIM_ABT = `${ASAL}/aps_badilag/abt/main/anonim`;

const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function sampai<T>(periksa: () => T, keterangan: string, batas = 5000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${keterangan}`);
    await tunggu(10);
  }
}

function potongFungsi(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => new RegExp(`^(?:async )?function ${nama}\\(`).test(b));
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  let j = mulai;
  while (j < baris.length && baris[j] !== "}") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}
function tetapan(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => b.startsWith(`const ${nama} = `));
  if (mulai < 0) throw new Error(`tetapan ${nama} tidak ketemu`);
  if (baris[mulai].trimEnd().endsWith(";")) return baris[mulai];
  let j = mulai;
  while (j < baris.length && baris[j] !== "};" && baris[j] !== "];") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}
const ada = (isi: string, nama: string) => new RegExp(`^(?:async )?function ${nama}\\(`, "m").test(isi);
const adaTetapan = (isi: string, nama: string) => new RegExp(`^const ${nama} = `, "m").test(isi);

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

// ----------------------------------------------------------------------------
// Bentuk dari gambar 33: anonim ABT meninggalkan nama pihak (huruf besar),
// saksi, dan alamat; nama majelis dan panitera ada di naskah.
// ----------------------------------------------------------------------------
const RTF_ABT_BOCOR =
  "{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\f0 " +
  "2. Mengabulkan permohonan PEMOHON secara verstek;\\par " +
  "3. Memberikan izin kepada Pemohon ({\\b MUH. RIZAL} Bin SUARDIN) untuk menjatuhkan talak satu raj\\'92i terhadap Termohon (TERMOHON);\\par " +
  "B. Saksi: 1. Sulfiani binti H. Abd Hamid Dg. Pagella, umur 43 tahun, agama Islam;\\par " +
  "Saksi Sulfiani menerangkan kenal dengan Muh Rizal;\\par " +
  "kuasa yang beralamat di BTN TAMAN RIA ESTATE, JL. MUNIF RAHMAN, Kelurahan Kabonena;\\par " +
  "Hakim Ketua Drs. H. Ahmad Fauzi, M.H.\\par " +
  "Panitera Pengganti Nurhayati, S.H.\\par }";

const NIK = "7203111072023001";

/** Halaman SIPP: tabel pihak, alamat, dan majelis (penetapan) - bentuk tab_penetapan_v.php. */
const TABEL_SIPP =
  "<table><tr><td>Status</td><td>Nama</td></tr><tr><td>Penggugat</td><td>Muh. Rizal Bin Suardin</td></tr></table>" +
  "<table><tr><td>Alamat</td><td>BTN TAMAN RIA ESTATE, JL. MUNIF RAHMAN, Kelurahan Kabonena</td></tr></table>" +
  "<table><tr><td>Tanggal Penetapan</td><td>Nama Hakim/Majelis Hakim</td></tr><tr><td>01-10-2026</td><td>Hakim Ketua: Drs. H. Ahmad Fauzi, M.H.</td></tr></table>" +
  // Tabel jabatan berkolom "Nama": tanpa pelindung, nama majelis ikut terbaca sebagai pihak.
  "<table><tr><td>Jabatan</td><td>Nama</td></tr><tr><td>Hakim Ketua</td><td>Drs. H. Ahmad Fauzi</td></tr><tr><td>Panitera Pengganti</td><td>Nurhayati</td></tr></table>";

const KONTEKS = {
  nomorPerkara: NOMOR,
  nomorPihak: [
    { nama: "Muh. Rizal Bin Suardin", pihakKe: 1, jenis: "Pemohon" },
    { nama: "Siti Lestari Binti Gito", pihakKe: 2, jenis: "Termohon" },
    { nama: "Sulfiani binti H. Abd Hamid Dg. Pagella", jenis: "Saksi" },
  ],
};

type Abt = { rtf?: string; gantung?: boolean };

function pasang(o: { abt: Abt; batasTungguMs?: number; batasAbtMs?: number }) {
  const konten = KONTEN();
  const dom = new JSDOM(`<!doctype html><html><body><div id="sipp">${TABEL_SIPP}</div></body></html>`);
  terbuka.push(dom);
  const dokumen = dom.window.document;
  const jejak: string[] = [];
  let simpanDitekan = 0;
  const unggahan: Array<{ putusan: string; anonimisasi: File | null }> = [];
  const permintaanAbt: Array<{ perkaraId: string; nomor: string }> = [];

  const pil = (...x: string[]) => [{ nilai: "-1", label: "Pilih" }, ...x.map((l, i) => ({ nilai: String(i + 1), label: l }))];
  const borang: Record<string, { tampak: boolean; nilai: string; pilihan: Array<{ nilai: string; label: string }> }> = {
    'select[name="status_putusan"]': { tampak: true, nilai: "1", pilihan: pil("Dikabulkan", "Ditolak") },
    'select[name="verstek"]': { tampak: true, nilai: "Y", pilihan: [{ nilai: "T", label: "Tidak" }, { nilai: "Y", label: "Ya" }] },
    'select[name="qobla"]': { tampak: true, nilai: "1", pilihan: [{ nilai: "-1", label: "Pilih" }, { nilai: "0", label: "Qobla Dukhul" }, { nilai: "1", label: "Ba'da Dukhul" }] },
  };

  const jawabJson = (isi: unknown) => {
    const r: any = { ok: true, status: 200, json: async () => polos(isi), clone: () => r };
    return r;
  };
  const k: Record<string, any> = {
    console: { ...console, warn() {}, log() {} },
    setTimeout,
    clearTimeout,
    AbortController,
    URLSearchParams,
    URL,
    TextDecoder,
    TextEncoder,
    FormData: dom.window.FormData,
    File: dom.window.File,
    Blob: dom.window.Blob,
    encodeURIComponent,
    document: dokumen,
    location: { origin: ASAL, pathname: "/SIPP/detil_perkara_agama", search: "", hostname: "192.168.10.10" },
    window: {
      location: { hostname: "192.168.10.10", pathname: "/SIPP/detil_perkara_agama", search: "", origin: ASAL },
      sessionStorage: { getItem: () => null, setItem() {} },
      localStorage: { getItem: () => null, setItem() {} },
      addEventListener() {},
      postMessage() {},
    },
    chrome: {
      runtime: { getManifest: () => ({ version: "0.0.0" }), getURL: (x: string) => x },
      storage: {
        onChanged: { addListener() {} },
        local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined },
        session: { get: async () => ({}), set: async () => undefined },
      },
    },
    fetch: async (alamat: string, opsi?: { method?: string; body?: any; signal?: AbortSignal }) => {
      const url = String(alamat);
      const cara = String(opsi?.method || "GET").toUpperCase();
      if (url === ANONIM_ABT) {
        jejak.push("ABT diminta");
        permintaanAbt.push({ perkaraId: String(opsi?.body?.get("perkara_id")), nomor: String(opsi?.body?.get("perkara_no")) });
        if (o.abt.gantung) {
          return new Promise((_, tolak) => {
            opsi?.signal?.addEventListener("abort", () => tolak(Object.assign(new Error("aborted"), { name: "AbortError" })));
          });
        }
        const bita = Uint8Array.from(Buffer.from(o.abt.rtf || "", "latin1"));
        return { ok: true, status: 200, url, arrayBuffer: async () => bita.buffer.slice(bita.byteOffset, bita.byteOffset + bita.byteLength) };
      }
      if (url.includes("/ekstensi/tipe-keluaran")) throw new TypeError("Failed to fetch");
      if (url.includes("/putusan/unggah-naskah")) return jawabJson({ data: { ok: true, versi: 2, bagian: [] } });
      if (url.includes("/putusan/isian-sipp") && cara === "POST") {
        const badan = JSON.parse(String(opsi?.body || "{}"));
        return jawabJson({
          data: {
            usulan: badan.medan.map((m: { kunci: string; pilihan: Array<{ nilai: string; label: string }> }) => {
              const x = m.pilihan.find((y) => y.nilai !== "-1") || m.pilihan[0];
              return { kunci: m.kunci, nilai: x.nilai, nilaiLabel: x.label, keyakinan: "pasti", nilaiBanyak: [x] };
            }),
          },
        });
      }
      if (url.includes("/putusan/isian-sipp")) {
        return jawabJson({
          data: {
            ada: true,
            versi: 2,
            keadaan: "draf",
            jenisPerkara: "Cerai Talak",
            pertimbangan: "<p>Menimbang.</p>",
            amar: "<p>1. Mengabulkan;</p>",
            amarAnonim: "<p>1. Mengabulkan;</p>",
          },
        });
      }
      if (url.includes("/putusan/praperiksa")) return jawabJson({ data: { ada: true, hentikan: false, ringkas: "lolos", temuan: [] } });
      return jawabJson({ ok: true });
    },
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
  };
  k.globalThis = k;
  vm.createContext(k);
  vm.runInContext(ALAT, k, { filename: "panel-alat.js" });
  Object.assign(k, {
    bagian: (judul: string) => {
      const kotak = dokumen.createElement("div") as any;
      kotak.appendChild(dokumen.createElement("h3")).textContent = judul;
      kotak.isi = dokumen.createElement("div");
      kotak.appendChild(kotak.isi);
      dokumen.body.appendChild(kotak);
      return kotak;
    },
    konteksTerakhir: KONTEKS,
    alatCatat: (...x: unknown[]) => void jejak.push(`catat ${x.join(" | ")}`),
    alatCatatTindakan: () => undefined,
    alatKeringNyala: () => false,
    alatCobaAktif: () => false,
    alatLatihanNyala: () => false,
    t7RaporAgen: () => dokumen.createElement("div"),
    gambarRaporAgen: () => dokumen.createElement("div"),
    t7PasangPenyunting: () => undefined,
    perkaraIdDariHalaman: () => "4321",
    namaPenggunaSipp: () => "petugas",
    a30Aktif: () => true,
    s1Aktif: () => true,
    a30PesanDitahan: (_b: unknown, apa: string) => `${apa} ditahan`,
    // Butir 6 (1.189.x): perkara di dunia uji BELUM diputus - sama dengan
    // bacaPutusanSegar di bawah. Di peladen ambilStatusPerkara sudah tersimpan
    // sejak panel dibuka (b6PeringatkanBilaTerisi), jadi tidak ada jeda baru.
    // Konfirmasi timpa tidak boleh muncul untuk perkara yang belum diputus.
    ambilStatusPerkara: async () => ({ putusan: { sudahPutus: false }, putusanLengkap: {} }),
    bacaPutusanSegar: async () => ({ sudahPutus: false, tanggal: "", status: "" }),
    a30UnggahEdoc: async (p: { putusan: File; anonimisasi: File | null }) => {
      unggahan.push({ putusan: p.putusan.name, anonimisasi: p.anonimisasi || null });
      jejak.push("edoc terunggah");
      return { ok: true, bunyi: p.anonimisasi ? "Edoc putusan dan edoc anonimisasi terunggah." : "Edoc putusan terunggah." };
    },
    simpanPutusanLaluBuka: async (_n: string, kabar: any, opsi: any) => {
      if (opsi && opsi.sebelum) await opsi.sebelum;
      simpanDitekan += 1;
      jejak.push("Simpan ditekan");
      const lanjut = opsi && opsi.sesudahTersimpan ? await opsi.sesudahTersimpan(kabar) : { bunyi: "" };
      return { ok: true, bunyi: `Tersimpan di SIPP. ${lanjut.bunyi}` };
    },
    kirimKeJembatanLangsung: async (pesan: { jenis: string; penunjuk: string; nilai?: string }) => {
      await tunggu(2);
      const m = borang[pesan.penunjuk];
      if (pesan.jenis === "pilihan") {
        if (!m) return { ok: false, alasan: "tidak_ada" };
        return { ok: true, tampak: m.tampak, nilaiSekarang: m.nilai, pilihan: m.pilihan.map((x) => ({ ...x, terpilih: x.nilai === m.nilai })) };
      }
      if (pesan.jenis === "nilai") return { ok: true, nilai: m ? m.nilai : "07/10/2026", tampak: true };
      if (pesan.jenis === "isi") {
        if (m) m.nilai = String(pesan.nilai);
        return { ok: true };
      }
      return { ok: false };
    },
  });

  // Batas waktu dipersingkat untuk uji - nilainya diganti, bukan kodenya.
  const ganti = (baris: string, nama: string, nilai?: number) =>
    nilai === undefined ? baris : `const ${nama} = ${nilai};`;
  const tetapanOpsional = (nama: string, nilai?: number) => (adaTetapan(konten, nama) ? [ganti(tetapan(konten, nama), nama, nilai)] : []);
  const fungsiOpsional = (...nama: string[]) => nama.filter((n) => ada(konten, n));

  vm.runInContext(
    [
      tetapan(konten, "ALETA_API_ISIAN_PUTUSAN"),
      tetapan(konten, "ALETA_API_PRAPERIKSA_PUTUSAN"),
      tetapan(konten, "ALETA_API_UNGGAH_NASKAH"),
      tetapan(konten, "BATAS_UNGGAH_NASKAH_MS"),
      tetapan(konten, "NILAI_BAWAAN_BORANG"),
      tetapan(konten, "PENUNJUK_TANGGAL_PUTUSAN"),
      tetapan(konten, "A30_TERIMA_NASKAH"),
      tetapan(konten, "A30_MIME"),
      tetapan(konten, "A30_API_SIDANG"),
      ...tetapanOpsional("A30_BATAS_ANONIM_ABT_MS", o.batasAbtMs),
      ...tetapanOpsional("A30_BATAS_TUNGGU_ANONIM_MS", o.batasTungguMs),
      ...tetapanOpsional("A30_DETAK_TUNGGU_ANONIM_MS", 50),
      ...tetapanOpsional("A30_BUKAN_SAMARAN"),
      ...(/^const s1Jeda = /m.test(konten) ? [tetapan(konten, "s1Jeda")] : []),
      "let penggunaTerakhir = null;",
      "let kapabilitasTerakhir = null;",
      ...[
        "buatElemen",
        "ringkasHentikan",
        "kirimKeJembatan",
        "nilaiTerpilihMedan",
        "nilaiTerpilihBukanBawaan",
        "muatanUsulanMedan",
        "bagianIsiPutusan",
        // Butir 6 (1.189.x): tombol Isikan menunggu b6KonfirmasiTimpaPutusan
        // (berkas yang sama, di luar potongan lama). Ikut DIPOTONG - bukan
        // disalin - supaya jalur Isikan yang diuji tetap kode sungguhan.
        // Salinan kode lebih tua (pembukti gigitan) belum punya fungsinya.
        ...(/^async function b6KonfirmasiTimpaPutusan\(/m.test(konten)
          ? ["b6KeadaanPutusanTerisi", "b6RincianPutusan", "b6KonfirmasiTimpaPutusan"]
          : []),
        "jalankanPraperiksaPanel",
        "bacaUsulanBorangPutusan",
        "mintaPraperiksaPutusan",
        "a30OpsiSimpanPutusan",
        "a30BarisSekaligus",
        "a30Bentuk",
        "a30PerluKeRtf",
        "a30NamaAnonim",
        "a30GantiAkhiran",
        "a30SiapkanAnonimisasi",
        "a30PerkaraIdUntukAbt",
        "a30HalamanMasukAbt",
        "a30AnonimAbt",
        "a30TeksRtf",
        "a30DataPribadiHalaman",
        "a30PolaKata",
        "a30PeriksaAnonim",
        "a30Tanya",
        "s1SiapkanAnonimAwal",
        ...fungsiOpsional(
          "s1BacaUsulanBorangCepat",
          "s1TungguBerubah",
          "a30PetaRtf",
          // 12 Okt 2026 (butir 19): bentuk nama ber-"alias", potongan depan, spasi lentur.
          "a30BentukNamaPihak",
          "a30PotonganDepan",
          "a30AmanKata",
          "a30PolaSasaran",
          "a30DepanMilikPihak",
          "a30SamarkanSisaRtf",
          "a30BitaKeTeks",
          "a30TeksKeBita",
          "a30TungguAnonim",
          "a30PilihSesudahBatas"
        ),
      ]
        .filter((n) => n === "a30GantiAkhiran" ? ada(konten, n) : true)
        .map((nama) => potongFungsi(konten, nama)),
      "this.__uji = { bagianIsiPutusan, a30AnonimAbt, a30DataPribadiHalaman, a30PeriksaAnonim, a30TeksRtf, " +
        "a30SamarkanSisaRtf: typeof a30SamarkanSisaRtf === 'function' ? a30SamarkanSisaRtf : null, " +
        "a30BitaKeTeks: typeof a30BitaKeTeks === 'function' ? a30BitaKeTeks : null, " +
        "a30TeksKeBita: typeof a30TeksKeBita === 'function' ? a30TeksKeBita : null };",
    ].join("\n"),
    k,
    { filename: "konten.js (potongan)" }
  );
  return { dom, dokumen, k, uji: k.__uji, jejak, unggahan, permintaanAbt, simpan: () => simpanDitekan };
}

/** Naskah dipilih (UI Baru) -> usulan tampil -> Isikan ditekan. */
async function jalankanSampaiIsikan(h: ReturnType<typeof pasang>) {
  const kotak = h.uji.bagianIsiPutusan(NOMOR) as HTMLDivElement;
  const pemilih = kotak.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(pemilih, "files", {
    configurable: true,
    value: [new h.dom.window.File(["{\\rtf1 naskah}"], "532_Pdt.G_2026_PA.Dgl - [01] [Kabul Verstek] Cerai.rtf")],
  });
  pemilih.dispatchEvent(new h.dom.window.Event("change"));
  const terap = await sampai(
    () => Array.from(kotak.querySelectorAll("button")).find((b) => b.textContent === "Isikan yang dicentang") as HTMLButtonElement | undefined,
    "Isikan muncul",
    10000
  );
  // Medan yang muncul sesudah status dipilih tidak ada di borang tiruan ini.
  terap.click();
  return { kotak, terap };
}

async function teksBerkas(h: ReturnType<typeof pasang>, f: File): Promise<string> {
  // File jsdom tidak punya arrayBuffer(); FileReader-nya ada.
  const ab: ArrayBuffer = await new Promise((selesai, gagal) => {
    const r = new h.dom.window.FileReader();
    r.onload = () => selesai(r.result as ArrayBuffer);
    r.onerror = () => gagal(r.error);
    r.readAsArrayBuffer(f);
  });
  return Buffer.from(new Uint8Array(ab)).toString("latin1");
}

// ============================================================================
describe("butir 3: Putusan otomatis tidak lagi macet di 'Menunggu anonimisasi siap'", () => {
  it("A (gambar 32/33): sisa nama ABT disamarkan ALETA -> tanpa dialog, Simpan sekali, KEDUA edoc terunggah", async () => {
    const h = pasang({ abt: { rtf: RTF_ABT_BOCOR } });
    const { kotak } = await jalankanSampaiIsikan(h);
    try {
      await sampai(() => /Tersimpan di SIPP/.test(kotak.textContent || ""), "tersimpan + edoc", 8000);
    } catch {
      throw new Error(`MACET: ${String(kotak.textContent).replace(/\s+/g, " ").slice(-700)}`);
    }
    expect(h.simpan()).toBe(1);
    expect(h.unggahan).toHaveLength(1);
    expect(h.unggahan[0].putusan).toMatch(/Kabul Verstek/);
    expect(h.unggahan[0].anonimisasi).not.toBeNull();
    expect(kotak.querySelector(".aleta-a30-tanya")).toBeNull();
    expect(kotak.textContent).toMatch(/Edoc putusan dan edoc anonimisasi terunggah/);
    // ABT diminta dengan perkara_id dan nomor perkara ini.
    expect(h.permintaanAbt).toEqual([{ perkaraId: "4321", nomor: NOMOR }]);
    // Jejak jujur di kotak hitam ALETA.
    expect(h.jejak.some((x) => /sisa disamarkan ALETA pada salinan anonimisasi/.test(x))).toBe(true);
  });

  it("B: sisa yang TIDAK dapat disamarkan (nama terbelah ganti paragraf) -> dialog tepat di bawah kabar Isikan, bukan di puncak; Tetap unggah -> selesai", async () => {
    // 12 Okt 2026 (butir 19): NIK 16 angka kini DISAMARKAN ALETA. Yang tetap
    // tidak dapat disamarkan otomatis: nama yang terbelah ganti paragraf.
    const h = pasang({
      abt: { rtf: RTF_ABT_BOCOR.replace("umur 43 tahun", `NIK ${NIK}, umur 43 tahun, ipar dari Siti\\par Lestari`) },
    });
    const { kotak, terap } = await jalankanSampaiIsikan(h);
    const tanya = await sampai(() => kotak.querySelector(".aleta-a30-tanya") as HTMLElement | null, "dialog pemeriksa", 8000);
    // Dialog harus SESUDAH tombol Isikan (terlihat dari tempat petugas menunggu).
    await sampai(
      () => (terap.compareDocumentPosition(tanya) & h.dom.window.Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      "dialog berada di bawah tombol Isikan",
      3000
    ).catch(() => {
      throw new Error("Dialog pemeriksa tergambar DI ATAS tombol Isikan (kotak naskah) - petugas tidak melihatnya dan penantian tampak macet.");
    });
    // NIK, nama pihak/saksi/alamat yang utuh sudah disamarkan; yang tersisa
    // hanya nama yang terbelah ganti paragraf.
    expect(tanya.textContent).not.toContain(NIK);
    expect(tanya.textContent).toMatch(/nama pihak "Siti\s+Lestari"/);
    expect(tanya.textContent).not.toMatch(/alamat "/);
    expect(tanya.textContent).toMatch(/ALETA sudah menyamarkan \d+ sisa/);
    await sampai(() => /menunggu jawaban Anda/.test(kotak.textContent || ""), "kabar menunjuk dialog", 3000);
    expect(h.simpan()).toBe(0);
    const cek = tanya.querySelector(".aleta-a30-tanya-centang input") as HTMLInputElement;
    cek.checked = true;
    cek.dispatchEvent(new h.dom.window.Event("change"));
    (tanya.querySelector(".aleta-a30-tanya-ya") as HTMLButtonElement).click();
    await sampai(() => /Tersimpan di SIPP/.test(kotak.textContent || ""), "tersimpan + edoc", 5000);
    expect(h.simpan()).toBe(1);
    expect(h.unggahan).toHaveLength(1);
    expect(h.unggahan[0].anonimisasi).not.toBeNull();
  });

  it("C: ABT tidak menjawab -> sesudah batas, sebab + pilihan; 'Simpan, unggah edoc putusan saja' menyimpan dan mengunggah putusan", async () => {
    const h = pasang({ abt: { gantung: true }, batasTungguMs: 1200, batasAbtMs: 600000 });
    const { kotak } = await jalankanSampaiIsikan(h);
    const kartu = await sampai(() => kotak.querySelector(".aleta-a30-tunggu") as HTMLElement | null, "kartu batas waktu", 8000).catch(() => {
      throw new Error(`Tanpa batas waktu: ${String(kotak.textContent).replace(/\s+/g, " ").slice(-400)}`);
    });
    expect(kartu.textContent).toMatch(/Anonimisasi belum siap sesudah 1 detik/);
    expect(kartu.textContent).toMatch(/langkah terakhir: "Anonimisasi 2\/4: meminta ABT menganonimkan/);
    expect(kartu.textContent).toMatch(/Putusan BELUM disimpan/);
    const tombol = Array.from(kartu.querySelectorAll("button")).map((b) => b.textContent);
    expect(tombol).toEqual(["Tunggu lagi", "Ulangi anonimisasi", "Simpan, unggah edoc putusan saja"]);
    expect(h.simpan()).toBe(0);
    (kartu.querySelector('[data-a30-pilih="lewati"]') as HTMLButtonElement).click();
    await sampai(() => /Tersimpan di SIPP/.test(kotak.textContent || ""), "tersimpan", 5000);
    expect(h.simpan()).toBe(1);
    expect(h.unggahan).toEqual([{ putusan: expect.stringMatching(/Kabul Verstek/), anonimisasi: null }]);
    expect(kotak.textContent).toMatch(/Edoc anonimisasi BELUM diunggah/);
  });

  it("C2: 'Tunggu lagi' menunggu lagi; anonimisasi yang keburu siap menutup kartunya sendiri", async () => {
    const h = pasang({ abt: { gantung: true }, batasTungguMs: 1000, batasAbtMs: 600000 });
    const { kotak } = await jalankanSampaiIsikan(h);
    const kartu = await sampai(() => kotak.querySelector(".aleta-a30-tunggu") as HTMLElement | null, "kartu batas waktu", 8000);
    (kartu.querySelector('[data-a30-pilih="tunggu"]') as HTMLButtonElement).click();
    expect(kotak.querySelector(".aleta-a30-tunggu")).toBeNull();
    // Kartu kembali sesudah batas berikutnya - tidak menyimpan sendiri.
    await sampai(() => kotak.querySelector(".aleta-a30-tunggu"), "kartu kedua", 5000);
    expect(h.simpan()).toBe(0);
  });

  it("D: fetch anonim ABT dibatasi waktu - jawabannya bersebab, bukan menggantung", async () => {
    const h = pasang({ abt: { gantung: true }, batasAbtMs: 1000 });
    const rtf = new h.dom.window.File(["{\\rtf1 x}"], "putusan.rtf");
    const hasil = await Promise.race([
      h.uji.a30AnonimAbt(rtf, NOMOR, "4321"),
      tunggu(4000).then(() => ({ menggantung: true })),
    ]);
    expect(hasil).not.toHaveProperty("menggantung");
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/ABT tidak menjawab dalam 1 detik/);
  });
});

// ============================================================================
describe("butir 4: anonimisasi otomatis benar-benar menyamarkan (bentuk dari gambar 33)", () => {
  it("penyamar: semua bentuk nama pihak, saksi, dan alamat tersamar; majelis & panitera utuh; kurung = '( xxx )'", () => {
    const h = pasang({ abt: { rtf: "" } });
    expect(h.uji.a30SamarkanSisaRtf).toBeTypeOf("function");
    const data = h.uji.a30DataPribadiHalaman();
    const hasil = h.uji.a30SamarkanSisaRtf(RTF_ABT_BOCOR, data);
    const teks = h.uji.a30TeksRtf(hasil.rtf);
    // Kode format RTF di tengah nama tetap, namanya hilang.
    expect(hasil.rtf).toContain("{\\b ");
    expect(teks).toContain("Memberikan izin kepada Pemohon ( xxx ) untuk menjatuhkan talak");
    expect(teks).not.toMatch(/rizal/i);
    expect(teks).not.toMatch(/suardin/i);
    expect(teks).not.toMatch(/sulfiani/i);
    expect(teks).not.toMatch(/pagella/i);
    expect(teks).toContain("B. Saksi: 1. xxx, umur 43 tahun");
    expect(teks).toContain("Saksi xxx menerangkan kenal dengan xxx;");
    expect(teks).not.toMatch(/TAMAN RIA/i);
    expect(teks).not.toMatch(/MUNIF/i);
    // Yang bukan data pribadi pihak tetap utuh.
    expect(teks).toContain("Hakim Ketua Drs. H. Ahmad Fauzi, M.H.");
    expect(teks).toContain("Panitera Pengganti Nurhayati, S.H.");
    expect(teks).toContain("Mengabulkan permohonan PEMOHON secara verstek");
    expect(teks).toContain("raj’i"); // 17 Okt: \'92 dibaca cp1252 (’), bukan U+0092
    // Pemeriksa atas hasilnya: bersih.
    const periksa = h.uji.a30PeriksaAnonim(teks, data);
    expect(periksa.temuan).toEqual([]);
  });

  it("nama majelis/panitera di tabel jabatan SIPP tidak dibaca sebagai pihak (dilindungi)", () => {
    const h = pasang({ abt: { rtf: "" } });
    const nama = h.uji.a30DataPribadiHalaman().nama.map((x: { teks: string }) => x.teks);
    expect(nama).toContain("Muh. Rizal Bin Suardin");
    expect(nama).toContain("Muh. Rizal");
    expect(nama).toContain("Sulfiani binti H. Abd Hamid Dg. Pagella");
    expect(nama).toContain("Sulfiani");
    expect(nama.some((x: string) => /fauzi/i.test(x))).toBe(false);
    expect(nama.some((x: string) => /nurhayati/i.test(x))).toBe(false);
  });

  it("bentuk lain dari nama yang sama: tanpa titik, tanpa spasi sesudah titik, huruf besar, terbelah kode format", () => {
    const h = pasang({ abt: { rtf: "" } });
    const data = { nama: [{ teks: "Muh. Rizal Bin Suardin", dari: "SIPP" }, { teks: "Muh. Rizal", dari: "SIPP" }], alamat: [] };
    for (const bentuk of ["MUH. RIZAL BIN SUARDIN", "Muh Rizal bin Suardin", "MUH.RIZAL", "{\\i Muh.} Rizal", "muh.  rizal"]) {
      const rtf = `{\\rtf1\\ansi Kepada ${bentuk} di tempat;\\par }`;
      const teks = h.uji.a30TeksRtf(h.uji.a30SamarkanSisaRtf(rtf, data).rtf);
      expect(teks, bentuk).toBe("Kepada xxx di tempat;\n");
    }
  });

  it("bita di luar ASCII (\\'92, bita mentah 0x93) kembali persis sesudah penyamaran", () => {
    const h = pasang({ abt: { rtf: "" } });
    const asal = "{\\rtf1 raj\\'92i \u0093kutip\u0094 Pemohon (Muh. Rizal Bin Suardin)\\par }";
    const bita = Uint8Array.from(Buffer.from(asal, "latin1"));
    const teks = h.uji.a30BitaKeTeks(bita);
    expect(teks).toBe(asal);
    const samar = h.uji.a30SamarkanSisaRtf(teks, { nama: [{ teks: "Muh. Rizal Bin Suardin", dari: "SIPP" }], alamat: [] });
    const keluar = Buffer.from(h.uji.a30TeksKeBita(samar.rtf)).toString("latin1");
    expect(keluar).toBe("{\\rtf1 raj\\'92i \u0093kutip\u0094 Pemohon ( xxx )\\par }");
  });

  it("berkas anonimisasi yang diunggah adalah salinan tersamar; edoc putusan asli tidak diubah", async () => {
    const h = pasang({ abt: { rtf: RTF_ABT_BOCOR } });
    const { kotak } = await jalankanSampaiIsikan(h);
    await sampai(() => /Tersimpan di SIPP/.test(kotak.textContent || ""), "tersimpan + edoc", 8000);
    const anon = await teksBerkas(h, h.unggahan[0].anonimisasi as File);
    expect(anon.startsWith("{\\rtf1")).toBe(true);
    expect(anon).not.toMatch(/RIZAL|Sulfiani|TAMAN RIA/i);
    expect(anon).toContain("Pemohon ( xxx )");
    expect(anon).toContain("Drs. H. Ahmad Fauzi");
    expect(h.unggahan[0].putusan).toBe("532_Pdt.G_2026_PA.Dgl - [01] [Kabul Verstek] Cerai.rtf");
  });
});
