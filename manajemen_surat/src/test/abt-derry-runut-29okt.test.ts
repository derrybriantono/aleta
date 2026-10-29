// @vitest-environment node
/**
 * ============================================================================
 * 29 OKT 2026 - AUDIT "BLANGKO ABT BY DERRY BRIANTONO": SEMUA FITUR JELAS, BERFUNGSI, RUNUT
 * ============================================================================
 *
 * Panel dijalankan SUNGGUHAN di jsdom (panel-alat.js, jurusita.js, abt-klien.js, blangko-derry*.js, isi-sipp-bersama.js) dengan ABT
 * dan portal ditiru di fetch (kerangka sama dengan blangko-derry-isian-16okt). Yang dijaga adalah PERILAKU layar hasil audit
 * D:/aleta-dev/kerja/audit-abt-derry-29okt.md:
 *   A  ikon (i) keterangan: kepala lima langkah + Lihat sebagai, Tes putusan, Alat saya, Tampilan ABT lama; arahkan = keterangan
 *      singkat (title), klik sekali = kabar singkat, klik dua kali / Enter = pop-up penjelasan, Esc / Tutup / klik di luar menutup;
 *      ikon tidak mengubah keadaan daftar dan tidak bersarang di tombol perkara
 *   B  Alat saya: BAS massal / Relaas massal membuka Cetak massal jenis itu (dulu "menyusul"); alat kasir/PTSP menyebut tempatnya
 *   C  lencana prioritas dan dokumen menyebut alasannya saat kursor; catatan daftar tanpa istilah "bot"
 *   D  langkah 2: petunjuk menyebut tombol yang benar (Ganti blangko) sesudah blangko dipilih
 *   E  langkah 3: label pembaca layar ikon sumber tanpa "ini ini"; bagian otomatis tanpa istilah "tabel ABT"
 *   F  langkah 5: Tambah tanda tangan tepat sesudah PDF (bukan sesudah PDF SALINAN); tiap pilihan berikon (i); tanda tangan tanpa PDF
 *      diingatkan; unggahan sendiri menyebut jenis dokumen (BAS)
 *   G  sinkron: isian yang ditulis PP di BAS dibaca putusan perkara yang sama (satu nilai ABT per perkara)
 *   H  Widget: Gembok dan Ukuran tampilan tersimpan; kartu tawaran "Jangan tawarkan lagi" mematikan tawaran
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { kodeTanyaJawab, kodeUntukNilai, statusNilaiLayar, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import { tawarkanSetSaksi } from "@/lib/set-pertanyaan-saksi";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "jurusita.js", "abt-klien.js", "blangko-derry.js", "isi-sipp-bersama.js", "blangko-derry-saksi.js", "blangko-derry-isian.js", "blangko-derry-massal.js"].map(baca).join("\n;\n");

const ASAL = "http://192.168.10.10";
const ABT = `${ASAL}/aps_badilag/index.php/abt`;
const BERANDA = `${ABT}/main/beranda`;
const HARI_INI = "2026-10-15";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
async function sampai<T>(periksa: () => T, keterangan: string, batas = 6000): Promise<NonNullable<T>> {
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
    await tunggu(5);
  }
}

// ----------------------------------------------------------------------------
// Bahan
// ----------------------------------------------------------------------------
const BLANGKO_PUT = "[01] [Kabul Verstek] Cerai (Format Lengkap)";
const BLANGKO_BAS = "BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi)";
const D = (kode: string, nama: string, jenis: string, sql = "", bawaan = ""): [string, Definisi] => [kode, { kode, nama, jenis, sql, bawaan }];
const KATALOG = new Map<string, Definisi>([
  D("0001", "No Perkara", "data_sipp"),
  D("0046", "Pemohon/ Penggugat", "data_sql", "select ..."),
  D("4001", "AMAR PUTUSAN CERAI UNIVERSAL", "data_sql", "select data from aps_badilag.abt_data_teks where no_var = '8503'"),
  D("8503", "ALASAN PERCERAIAN <br>SATU HURUF", "data_teks"),
  D("8536", "Putusan pidana (khusus alasan C) #11116#", "data_teks"),
  D("0227", "Tanggal Fasakh / Murtad #11117#", "data_tanggal"),
  D("0156", "Kantor Kuasa #0046# #11111#", "data_teks"),
  D("0184", "Tgl. Surat Kuasa #0046# #11111#", "data_tanggal"),
  D("0007", "Telah Dikarunai Anak", "data_teks", "", "#8492#"),
  D("1214", "Alat-alat bukti CG/CT", "data_teks", "", "Fotokopi KTP-el atas nama #4048#"),
  D("2021", "Keterangan Saksi 1 P", "tanya_jawab"),
  D("5058", "TanyaJwb Saksi 1 P", "tanya_jawab"),
  D("2022", "Keterangan Saksi 2 P", "tanya_jawab"),
  D("5059", "TanyaJwb Saksi 2 P", "tanya_jawab"),
  D("11111", "PENANDA ADA KUASA #0046#", "data_sql", "select ..."),
  D("11116", "PENANDA ALASAN C (8503)", "data_sql", "select ..."),
  D("11117", "PENANDA ALASAN H (8503)", "data_sql", "select ..."),
  D("0033", "Tgl Sidang", "multi_sidang"),
  D("0050", "Sidang Ke-", "multi_sidang"),
]);
const PENANDA_PUT = ["0001", "0046", "4001", "0007", "1214", "2021", "2022", "0156", "0184", "8536", "0227", "11111", "11116", "11117", "0033"];
const PENANDA_BAS = ["0001", "0033", "0050", "1214", "5058", "5059", "8503"];
const BAWAAN_1214 =
  "Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama YULFIANI, NIK 7271036411920011 tanggal 23 April 2025, yang dikeluarkan oleh Pemerintah Kabupaten Sigi, Provinsi Sulawesi Tengah, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.1 serta diberi tanggal dan paraf oleh Ketua Majelis;\n" +
  "Fotokopi Kutipan Akta Nikah, Nomor 0114/04/IV/2021 tanggal 05 April 2021, yang dikeluarkan oleh KUA Palu Selatan, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.2 serta diberi tanggal dan paraf oleh Ketua Majelis;";
const RTF_PUT = (isi0007: string) =>
  `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\froman Times New Roman;}}{\\colortbl;\\red0\\green0\\blue0;}` +
  `\\pard\\qc\\b PUTUSAN\\b0\\par\\pard\\qc Nomor 581/Pdt.G/2026/PA.Dgl\\par` +
  `\\pard\\qj Menimbang, bahwa alasan perceraian huruf F telah terbukti; dari pernikahan ${isi0007};\\par` +
  `\\pard\\ql Kuasa: ...; putusan pidana #9999#\\par` +
  `\\trowd\\cellx3000\\cellx6000\\pard\\intbl Hakim Satu, S.H.\\cell Hakim Dua, M.H.\\cell\\row\\pard\\par}`;
const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const SI = (tanggal: string, agenda: string, ket = "", extra: Record<string, unknown> = {}) => ({ sidangId: `s${tanggal}`, tanggal, jam: "09:00", agenda, ket, ditunda: false, urutan: 1, hadir: null, adaBas: null, ruangan: "", ...extra });
const PK = (nomor: string, jenis: string, sidang: unknown[], extra: Record<string, unknown> = {}) => ({
  nomorPerkara: `${nomor}/PA.Dgl`, perkaraId: "10154", jenisPerkara: jenis, alurPerkaraId: 15, sudahPutus: false, tanggalPutusan: "", tanggalMinutasi: "",
  adaBerkasPutusan: false, lewatEcourt: null, ghaib: false, prodeo: false, majelisKode: "", majelisNama: "Hakim Satu, S.H., Hakim Dua, M.H.", paniteraNama: "PP Satu", jurusitaNama: "JS Satu",
  sebagai: ["hakim"], pihak: { penggugat: ["Yulfiani binti Tasbih"], tergugat: ["Andi Rustam bin Syamsudin"] }, sidang, ...extra,
});
const DAFTAR = [PK("581/Pdt.G/2026", "Cerai Gugat", [SI("2026-10-01", "Sidang Pertama", "Panggil Tergugat", { urutan: 1 }), SI("2026-10-15", "Pemeriksaan pokok perkara", "putus DIKABULKAN (verstek)", { urutan: 2 })], { sudahPutus: true, tanggalPutusan: HARI_INI })];
const AKUN = { hakim: ["Hakim Satu", "Hakim Dua"], pp: ["PP Satu"], js: ["JS Satu"] };
type Orang = { nama: string; peran: string; golonganMenu: string[]; roleId?: string };
const ORANG: Record<string, Orang> = {
  hakim: { nama: "Hakim Satu", peran: "Hakim", roleId: "hakim", golonganMenu: ["hakim"] },
  pp: { nama: "PP Satu", peran: "Panitera Pengganti", roleId: "panitera-pengganti", golonganMenu: ["pp"] },
  admin: { nama: "Super Admin", peran: "Super Admin", roleId: "super-admin", golonganMenu: ["admin"] },
};

const MENU = `<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel"><a href="${BERANDA}?a=D1&c=" title="(2 Blangko)">Putusan CG</a><a href="${BERANDA}?a=D2&c=" title="(2 Blangko)">BAS CG</a></div>`;
const HAL_KELOMPOK = (judul: string, berkas: Array<[string, string, string]>) =>
  `<div class="pricing-top tiga"><h3>${judul}</h3></div>` + berkas.map(([n, a, b]) => `<p><a title='ukuran file 139 kb' href='#' onclick='showLoading();post("/aps_badilag/abt/main/cari", { a:"${a}", b:"${b}", c:"" });'># <span>${n}</span></a></p>`).join("");
const POPUP = (kode: string, tipe: string, nilai: string) =>
  `<input type="hidden" name="var_type" value="${tipe}"><table><tr><td>Nomor Variabel</td><td>: ${kode}</td></tr><tr><td>Nama Variabel</td><td>: V${kode}</td></tr></table>Nomor Perkara <b>581/Pdt.G/2026/PA.Dgl</b>` +
  (tipe === "data_tanggal" ? `<input type='text' id='tgl_form' value='${nilai}'>` : `<textarea id="value" ${tipe === "data_sql" ? "readonly" : ""}>${nilai}</textarea>`);

type Minta = { url: string; cara: string; badan: string };
type Halaman = { dom: JSDOM; w: any; simpanan: Record<string, unknown>; minta: Minta[]; latar: Array<Record<string, unknown>>; abt: Record<string, string>; tj: Record<string, Array<{ no: string; tanya: string; jawab: string }>>; pdfRtf: string[]; pdfTtd: Array<Array<{ nama: string; pngBase64: string }>>; opsi: { hakTolak?: boolean } };
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { orang?: string; simpanan?: Record<string, unknown>; hakTolak?: boolean; tjGagal?: boolean; botMati?: boolean; abtAwal?: Record<string, string>; rtfBytes?: Uint8Array } = {}): Halaman {
  const badan = `<div id="header"><div class="h_right"><b>Pengguna</b> Panitera</div></div><div id="wrapper"><div id="navbar">${MENU}</div><div id="content"></div></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body>${badan}</body></html>`, { url: BERANDA, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const pendengar: Array<(u: any, wilayah: string) => void> = [];
  const latar: Array<Record<string, unknown>> = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.200.2" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: (pesan: Record<string, unknown>, cb?: (h: unknown) => void) => {
        latar.push(polos(pesan));
        if (cb) cb({ ok: true, id: 1 });
      },
      lastError: undefined,
    },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(isi)) simpanan[k] = polos(v);
          setTimeout(() => pendengar.forEach((f) => f({}, "local")), 0);
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: any, wilayah: string) => void) => void pendengar.push(f) },
    },
  };
  const minta: Minta[] = [];
  const abt: Record<string, string> = { "8503": "F", ...(p.abtAwal ?? {}) }; // isian tersimpan di ABT (data_teks/tanggal)
  const tj: Halaman["tj"] = { "5058": [{ no: "1", tanya: "Apakah saudara kenal Penggugat?", jawab: "Kenal, saya kakaknya;" }, { no: "2", tanya: "Apa yang saudara tahu?", jawab: "Mereka sering bertengkar;\nBahwa cukup sekian;" }], "5059": [] };
  const pdfRtf: string[] = [];
  const pdfTtd: Array<Array<{ nama: string; pngBase64: string }>> = [];
  const orang = ORANG[p.orang ?? "hakim"];
  const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  const html = (isi: string) => new Response(isi, { status: 200, headers: { "content-type": "text/html" } });
  const nilaiDari = (kode: string[], tjKode: Set<string>) => {
    const n: Record<string, unknown> = {};
    for (const k of kode) {
      // Tanya-jawab: bot menilai "terisi" bila ABT punya barisnya (teksnya sendiri kosong, nilainya tabel).
      const v = tjKode.has(k)
        ? tj[k]?.length
          ? { status: "terisi", teks: "", nama: "", sebab: "" }
          : { status: "kosong", teks: "", nama: "", sebab: "tanya-jawab belum diisi di ABT" }
        : abt[k] !== undefined && abt[k] !== "" ? { status: "terisi", teks: abt[k], nama: "", sebab: "" } : k === "0001" ? { status: "terisi", teks: "581/Pdt.G/2026/PA.Dgl", nama: "", sebab: "" } : k === "0046" ? { status: "terisi", teks: "Yulfiani binti Tasbih", nama: "", sebab: "" } : { status: "kosong", teks: "", nama: "", sebab: "" };
      n[k] = statusNilaiLayar(v, tjKode.has(k));
    }
    return n;
  };
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown; redirect?: string }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    let badan = "";
    if (typeof opsi?.body === "string") badan = opsi.body;
    else if (opsi?.body && typeof (opsi.body as FormData).get === "function") badan = JSON.stringify(Object.fromEntries([...(opsi.body as FormData).entries()].map(([k, v]) => [k, typeof v === "string" ? v : `<berkas ${(v as File).name || ""} ${(v as File).size || 0}>`])));
    else if (opsi?.body && typeof (opsi.body as URLSearchParams).toString === "function") badan = String(opsi.body);
    minta.push({ url, cara, badan });
    if (url.startsWith("data:")) {
      const b = Buffer.from(url.split(",")[1], "base64");
      return new Response(new Uint8Array(b), { status: 200, headers: { "content-type": "image/png" } });
    }
    // Portal ALETA
    if (url.includes("/ekstensi/siapa")) return json({ ok: true, data: { ...orang, kapabilitas: {}, peranTambahan: [], bolehKasir: false } });
    if (url.includes("/aleta-ecourt/perkara-saya")) {
      const admin = p.orang === "admin";
      return json({ ok: true, data: { hariIni: HARI_INI, mode: "hari", dari: HARI_INI, sampai: HARI_INI, lihatSemua: admin, nama: orang.nama, sebagaiNama: "", sebagaiPeran: null, terpotong: false, jumlahSemua: 1, adaYangCocok: true, akun: admin ? AKUN : null, perkara: polos(DAFTAR) } });
    }
    if (url.includes("/aleta-ecourt/sidang?nomor=")) return json({ ok: true, data: { sipp: { jadwalPerkara: [{ sidangId: "s2026-10-01", tanggalSidang: "2026-10-01", jamSidang: "09:00:00", agenda: "Sidang Pertama", alasanDitunda: "Panggil Tergugat", urutanSidang: 1 }, { sidangId: "s2026-10-15", tanggalSidang: "2026-10-15", jamSidang: "09:00:00", agenda: "Pemeriksaan pokok perkara", alasanDitunda: "putus DIKABULKAN (verstek)", urutanSidang: 2 }] } } });
    if (url.includes("/aleta-ecourt/sidang/skors?")) {
      // F3.1: riwayat skors satu sidang + usulan kalimat BAS (rute sungguhan: lib/skors-sidang).
      const q = new URL(url, ASAL).searchParams;
      if (q.get("perkaraId") === "10154" && q.get("tanggal") === "2026-10-15") {
        return json({
          ok: true,
          data: {
            available: true,
            ok: true,
            riwayat: [{ perkaraId: "10154", tanggalSidang: "2026-10-15", diskorsPada: "2026-10-15 09:40:00", dilanjutkanPada: "2026-10-15 10:05:00", alasanKode: "saksi", alasan: "Menunggu saksi", ringkas: "09.40-10.05 (25 menit) · Menunggu saksi" }],
            kalimatBas: "Pada pukul 09.40 WITA sidang diskors untuk menunggu kehadiran saksi, dan pada pukul 10.05 WITA skors dicabut dan sidang dibuka kembali.",
          },
        });
      }
      return json({ ok: true, data: { available: true, ok: true, riwayat: [], kalimatBas: "" } });
    }
    if (url.includes("/aleta-ecourt/blangko-derry/set-saksi")) {
      // F3.3: set pertanyaan saksi ALETA (rute sungguhan memanggil fungsi murni yang sama).
      const q = new URL(url, ASAL).searchParams;
      return json({ ok: true, data: { ...tawarkanSetSaksi({ namaJenis: q.get("jenis") || "", nomor: q.get("nomor") || "", folder: q.get("folder") || "", huruf: q.get("huruf") || "", sebutanP: q.get("sebutanP") || undefined, sebutanT: q.get("sebutanT") || undefined, jumlahP: Number(q.get("jumlahP")) || 1 }), sumberHuruf: "" } });
    }
    if (url.includes("/aleta-ecourt/blangko-derry")) {
      const q = new URL(url, ASAL).searchParams;
      if (q.get("indeks") === "1") return json({ ok: true, data: { ada: true, akar: "derry_briantono", folder: [{ nama: "1 Perceraian CG", jenis: "put", berkas: [`${BLANGKO_PUT}.rtf`, "[02] [Kabul] CG - F.rtf"] }, { nama: "ALUR 02 Cerai Verstek 2 Sidang", jenis: "bas", berkas: [`${BLANGKO_BAS}.rtf`] }], sumber: "pohon", sebab: "" } });
      const berkas = q.get("berkas") || "";
      const put = berkas.startsWith("[01]");
      const s = susunIsian(put ? PENANDA_PUT : PENANDA_BAS, KATALOG, { P: q.get("sebutanP") || "Penggugat", T: q.get("sebutanT") || "Tergugat" });
      const kode = kodeUntukNilai(s, q.get("semua") === "1");
      return json({ ok: true, data: { ada: true, folder: `derry_briantono/${q.get("folder")}`, berkas: `${berkas}.rtf`, jumlahPenanda: s.penanda.length, sumberKatalog: "abt", katalogTersedia: true, ...s, nilai: q.get("perkaraId") && !p.botMati ? nilaiDari(kode, kodeTanyaJawab(s)) : undefined, nilaiAda: Boolean(q.get("perkaraId")) && !p.botMati, nilaiSebab: "" } });
    }
    if (url.includes("/aleta-bot/abt/pdf")) {
      const b = JSON.parse(badan || "{}");
      pdfRtf.push(Buffer.from(String(b.rtfBase64 || ""), "base64").toString("latin1"));
      pdfTtd.push(Array.isArray(b.ttd) ? b.ttd : []);
      return json({ ok: true, data: { available: true, message: "", pdfBase64: Buffer.from("%PDF-1.4 uji").toString("base64"), byte: 12, ...(Array.isArray(b.ttd) && b.ttd.length ? { ttdPdf: { dipasang: b.ttd.map((x: { nama: string }) => x.nama), tidakDitemukan: [] } } : {}), ...(b.salinan ? { salinan: { namaPanitera: "PP Satu", gambarTtdPanitera: false, ttdTerdaftar: false } } : {}) } });
    }
    if (url.includes("/aleta-ecourt/tanda-tangan")) return json({ ok: false, alasan: "tidak berwenang" }, 403);
    if (url.includes("/aleta-ecourt/putusan/unggah-sipp")) return json({ ok: true, data: { ok: true } });
    // ABT
    if (url === BERANDA || url === `${ABT}/main/beranda`) return html(`<div id="navbar">${MENU}</div>`);
    if (url.startsWith(`${BERANDA}?a=D1`)) return html(HAL_KELOMPOK("Putusan Cerai Gugat", [[BLANGKO_PUT, "A01", "B01"], ["[02] [Kabul] CG - F", "A02", "B02"]]));
    if (url.startsWith(`${BERANDA}?a=D2`)) return html(HAL_KELOMPOK("BAS Alur 02", [[BLANGKO_BAS, "A11", "B11"], ["BAS ALUR 02 [1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T", "A12", "B12"]]));
    if (url === `${ABT}/main/cari` && cara === "POST") {
      if (p.hakTolak) return html(`<h5 style='color:red;text-align:center'>JENIS PERKARA CERAI GUGAT TIDAK DAPAT MENGGUNAKAN BLANGKO INI</h5>`);
      return { type: "opaqueredirect", status: 0, headers: { get: () => "" }, text: async () => "" };
    }
    if (url.startsWith(`${ABT}/edit_data?`)) {
      const q = new URL(url).searchParams;
      const kode = q.get("no_var") || "";
      if (cara === "POST") {
        const f = new URLSearchParams(badan);
        abt[kode] = String(f.get("value") || "");
        return html(`<font color='green' size='2'>DATA DISIMPAN</font>`);
      }
      const def = KATALOG.get(kode);
      const tipe = def ? def.jenis : "";
      if (kode === "0050") return html(POPUP(kode, "multi_sidang", String(q.get("d") || "1") === "9" ? "" : String(q.get("d") || "1")));
      if (kode === "0007" && !abt[kode]) return html(POPUP(kode, "data_teks", "belum dikaruniai anak"));
      if (kode === "1214" && !abt[kode]) return html(POPUP(kode, "data_teks", BAWAAN_1214));
      if (tipe === "data_tanggal") return html(POPUP(kode, tipe, abt[kode] ? abt[kode] : ""));
      return html(POPUP(kode, tipe || "data_teks", abt[kode] || ""));
    }
    if (url.startsWith(`${ABT}/tanyajawab_perkara_edit?`)) {
      const q = new URL(url).searchParams;
      const kode = q.get("no_var") || "";
      const f = new URLSearchParams(badan);
      if (q.get("aksi") === "simpan") {
        tj[kode] = JSON.parse(String(f.get("data") || "[]"));
        return html("Tanya Jawab Disimpan");
      }
      if (p.tjGagal && cara === "GET" && kode === "5058") return new Response("galat", { status: 500 });
      const rows = f.get("load_template") ? { "0": { urutan_pertanyaan: "1", pertanyaan: "Apakah saudara kenal Penggugat?", jawaban: "" }, "1": { urutan_pertanyaan: "2", pertanyaan: "Bagaimana rumah tangganya?", jawaban: "" } } : (tj[kode] || []).map((r) => ({ urutan_pertanyaan: r.no, pertanyaan: r.tanya, jawaban: r.jawab }));
      return html(`<div class="panel-heading"><b><big>581/Pdt.G/2026/PA.Dgl</big></b> - TanyaJwb Saksi : <b>Nama Saksi</b></div><select><option value='A1a'>(A1a) Pertanyaan Saksi P CG</option></select><script>var ajax_data = ${JSON.stringify(rows)}\n</script>`);
    }
    if (url.startsWith(`${ABT}/preview?`)) {
      if (p.rtfBytes) return new Response(new Blob([p.rtfBytes as BlobPart]), { status: 200, headers: { "content-type": "application/vnd.ms-word", "content-disposition": `attachment; filename="581/Pdt.G/2026/PA.Dgl - ${BLANGKO_PUT}.rtf"` } });
      return new Response(RTF_PUT(abt["0007"] || "..."), { status: 200, headers: { "content-type": "application/vnd.ms-word", "content-disposition": `attachment; filename="581/Pdt.G/2026/PA.Dgl - ${BLANGKO_PUT}.rtf"` } });
    }
    if (url === `${ABT}/main/anonim`) return new Response(RTF_PUT("ANONIM"), { status: 200, headers: { "content-disposition": 'attachment; filename="anonim_581.rtf"' } });
    return json({ ok: false }, 404);
  };
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.focus = function () {};
  w.eval(SUMBER);
  return { dom, w, simpanan, minta, latar, abt, tj, pdfRtf, pdfTtd, opsi: p };
}

const D_ = (h: Halaman) => h.w.document as Document;
const akar = (h: Halaman) => D_(h).getElementById("aleta-bd-akar") as HTMLElement;
const q = (h: Halaman, s: string) => akar(h).querySelector(s) as HTMLElement | null;
const qq = (h: Halaman, s: string) => Array.from(akar(h).querySelectorAll(s)) as HTMLElement[];
const klik = (h: Halaman, s: string) => {
  const el = q(h, s);
  if (!el) throw new Error(`tidak ada: ${s}`);
  el.click();
};
const ketik = (h: Halaman, el: HTMLInputElement, nilai: string, blur = true) => {
  el.value = nilai;
  el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
  if (blur) el.dispatchEvent(new h.w.FocusEvent("focusout", { bubbles: true }));
};
const tombol = (h: Halaman, el: Element, key: string) => el.dispatchEvent(new h.w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
const isian = (h: Halaman) => h.w.aletaBlangkoDerryIsian;
const mintaKe = (h: Halaman, pola: RegExp, cara?: string) => h.minta.filter((m) => pola.test(m.url) && (!cara || m.cara === cara));

async function sampaiPerkara(h: Halaman) {
  await sampai(() => D_(h).getElementById("aleta-bd-tawar") || h.w.aletaBlangkoDerry.keadaan().peran.length, "siap");
  (Array.from(D_(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]"), "daftar");
  klik(h, '[data-pk="581/Pdt.G/2026/PA.Dgl"]');
  await sampai(() => q(h, '[data-bd2="bukamodal"]'), "tombol pilih blangko");
}
// 19 Okt (tahap 2): tanya jawab saksi hanya DISUNTING pada berita acara (BAS) oleh panitera pengganti; putusan dan peran
// hakim hanya membaca. Uji penyuntingan membuka BAS sebagai PP.
async function pilihBas(h: Halaman) {
  await sampaiPerkara(h);
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => q(h, `[data-bl="${BLANGKO_BAS}"]`), "berkas bas");
  klik(h, `[data-bl="${BLANGKO_BAS}"]`);
  await sampai(() => q(h, "#bd-perlu .bd-f") || q(h, "[data-tj]"), "perlu diisi");
}
async function pilihPutusan(h: Halaman) {
  await sampaiPerkara(h);
  klik(h, '[data-bd2="bukamodal"]');
  await sampai(() => q(h, `[data-bl="${BLANGKO_PUT}"]`), "berkas putusan termuat");
  klik(h, `[data-bl="${BLANGKO_PUT}"]`);
  await sampai(() => q(h, "#bd-perlu .bd-f"), "perlu diisi tergambar");
}

// ----------------------------------------------------------------------------
// Pembantu khusus berkas ini
// ----------------------------------------------------------------------------
async function bukaTampilan(h: Halaman) {
  await sampai(() => D_(h).getElementById("aleta-bd-tawar") || h.w.aletaBlangkoDerry.keadaan().peran.length, "siap");
  (Array.from(D_(h).querySelectorAll("#navbar .accordion")).find((b) => /Blangko Derry/.test(b.textContent || "")) as HTMLElement).click();
  await sampai(() => q(h, "[data-pk]"), "daftar");
}
const ikonKet = (h: Halaman, id: string) => q(h, `[data-infoket="${id}"]`) as HTMLButtonElement | null;
const pop = (h: Halaman) => q(h, "#bd-ketpop");
const klikDua = (h: Halaman, el: Element) => el.dispatchEvent(new h.w.MouseEvent("dblclick", { bubbles: true, cancelable: true, detail: 2 }));
const klikTetikus = (h: Halaman, el: Element) => el.dispatchEvent(new h.w.MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
function ubahCek(h: Halaman, el: HTMLInputElement, nilai: boolean) {
  el.checked = nilai;
  el.dispatchEvent(new h.w.Event("change", { bubbles: true }));
}
function ketik8503(h: Halaman, nilai: string) {
  const el = q(h, "#bd-i8503") as HTMLInputElement;
  el.value = nilai;
  el.dispatchEvent(new h.w.Event("input", { bubbles: true }));
  el.dispatchEvent(new h.w.FocusEvent("focusout", { bubbles: true }));
}

// ============================================================================
describe("A. ikon (i) keterangan fitur", () => {
  it("kepala lima langkah dan tombol kepala berikon (i); title = keterangan singkat + petunjuk klik dua kali", async () => {
    const h = buka();
    await bukaTampilan(h);
    for (const id of ["langkah-1", "langkah-2", "langkah-3", "langkah-4", "langkah-5", "alat-saya", "abt-lama", "tampilan-daftar"]) {
      const ik = ikonKet(h, id);
      expect(ik, id).not.toBeNull();
      expect(ik!.textContent).toBe("ⓘ");
      expect(ik!.getAttribute("title"), id).toMatch(/\(Klik dua kali: penjelasan lengkap\.\)$/);
      expect(ik!.getAttribute("aria-label"), id).toMatch(/^Keterangan: /);
      // Ikon tidak pernah bersarang di tombol lain atau label (klik ikon tidak boleh menekan tombolnya / mencentang kotaknya).
      expect(ik!.parentElement!.closest("button, label"), id).toBeNull();
    }
    expect(q(h, '[data-bd="keabt"]')!.getAttribute("title")).toContain("grup Blangko Derry");
    // Hakim: Lihat sebagai dan Tes putusan tidak tampil, begitu juga ikonnya.
    expect(ikonKet(h, "lihat-sebagai")!.closest("[hidden]")).not.toBeNull();
    expect(ikonKet(h, "tes-putusan")!.closest("[hidden]")).not.toBeNull();
  });

  it("Super Admin: ikon Lihat sebagai dan Tes putusan tampil bersama pilihannya", async () => {
    const h = buka({ orang: "admin" });
    await bukaTampilan(h);
    await sampai(() => !q(h, "#bd-lihatwrap")!.hidden, "Lihat sebagai tampil");
    expect(ikonKet(h, "lihat-sebagai")!.closest("[hidden]")).toBeNull();
    expect(ikonKet(h, "tes-putusan")!.closest("[hidden]")).toBeNull();
  });

  it("klik dua kali = pop-up penjelasan (judul + butir); Esc, Tutup, dan klik di luar kotak menutupnya; fokus kembali ke ikon", async () => {
    const h = buka();
    await bukaTampilan(h);
    const ik = ikonKet(h, "langkah-1")!;
    let fokus: Element | null = null;
    h.w.HTMLElement.prototype.focus = function (this: Element) {
      fokus = this;
    };
    klikDua(h, ik);
    expect(pop(h)).not.toBeNull();
    expect(pop(h)!.getAttribute("role")).toBe("dialog");
    expect(pop(h)!.querySelector(".bd-ketjudul")!.textContent).toBe("Langkah 1 - Perkara");
    const butir = Array.from(pop(h)!.querySelectorAll(".bd-ketbutir li")).map((x) => x.textContent || "");
    expect(butir.length).toBeGreaterThanOrEqual(5);
    expect(butir.join(" ")).toContain("1 Perkara -> 2 Blangko -> 3 Perlu diisi -> 4 Pratinjau -> 5 Cetak");
    expect(butir.join(" ")).toContain("90 hari lalu sampai 45 hari ke depan");
    // Esc menutup pop-up dan fokus kembali ke ikon.
    akar(h).dispatchEvent(new h.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(pop(h)).toBeNull();
    expect(fokus).toBe(ik);
    // Tutup
    klikDua(h, ik);
    (q(h, '[data-bd="tutupket"]') as HTMLElement).click();
    expect(pop(h)).toBeNull();
    // Klik di luar kotak (tirai) menutup; klik di dalam kotak tidak.
    klikDua(h, ik);
    (pop(h)!.querySelector(".bd-ketbutir") as HTMLElement).click();
    expect(pop(h)).not.toBeNull();
    pop(h)!.click();
    expect(pop(h)).toBeNull();
  });

  it("klik sekali dengan tetikus = keterangan singkat di kabar bawah; Enter/Spasi (klik tanpa tetikus) = pop-up", async () => {
    const h = buka();
    await bukaTampilan(h);
    klikTetikus(h, ikonKet(h, "tampilan-daftar")!);
    expect(pop(h)).toBeNull();
    expect(q(h, "#bd-toast")!.textContent).toContain("Kartu, Daftar ringkas, Tabel detail, atau Per tanggal sidang");
    expect(q(h, "#bd-toast")!.textContent).toContain("Klik dua kali");
    ikonKet(h, "tampilan-daftar")!.click(); // papan ketik: detail 0
    expect(pop(h)!.querySelector(".bd-ketjudul")!.textContent).toBe("Tampilan dan urutan daftar");
  });

  it("ikon tidak mengubah keadaan daftar: tampilan, urutan, dan perkara terpilih tetap", async () => {
    const h = buka();
    await bukaTampilan(h);
    const sebelum = polos(h.w.aletaBlangkoDerry.keadaan());
    klikTetikus(h, ikonKet(h, "tampilan-daftar")!);
    klikDua(h, ikonKet(h, "tampilan-daftar")!);
    klikTetikus(h, ikonKet(h, "langkah-1")!);
    const sesudah = polos(h.w.aletaBlangkoDerry.keadaan());
    expect([sesudah.lihat, sesudah.urut, sesudah.arah, sesudah.pk, sesudah.mode]).toEqual([sebelum.lihat, sebelum.urut, sebelum.arah, sebelum.pk, sebelum.mode]);
    // Tidak ada ikon (i) di dalam tombol perkara (tombol bersarang tidak sah dan klik ikon akan memilih perkara).
    expect(qq(h, "[data-pk] [data-infoket]")).toEqual([]);
  });

  it("langkah 5: tiap pilihan cetak yang tidak jelas berikon (i) dari daftar keterangan yang sama", async () => {
    const h = buka();
    await pilihPutusan(h);
    for (const id of ["fmt-pdf", "fmt-ttd", "fmt-salinan", "fmt-anon", "fmt-edoc"]) {
      const ik = q(h, `[data-wadah="cetak"] [data-infoket="${id}"]`);
      expect(ik, id).not.toBeNull();
      expect(ik!.closest("label"), id).toBeNull();
    }
    klikDua(h, q(h, '[data-wadah="cetak"] [data-infoket="fmt-salinan"]')!);
    expect(pop(h)!.textContent).toContain('"Tambah tanda tangan" tidak berlaku di salinan');
    // Pop-up tidak mencentang/menghapus centang pilihan apa pun.
    expect((q(h, '[data-fmt="salinan"]') as HTMLInputElement).checked).toBe(false);
    // Keterangan dapat dibaca modul lain lewat api (salinan, bukan rujukan ke daftar asli).
    const k = h.w.aletaBlangkoDerry.keterangan("langkah-3");
    k.isi.push("ubah");
    expect(h.w.aletaBlangkoDerry.keterangan("langkah-3").isi).not.toContain("ubah");
    expect(h.w.aletaBlangkoDerry.ikonKeterangan("tidak-ada")).toBe("");
  });

  it("isi keterangan tanpa istilah teknis (peladen, borang, galat, endpoint, bot, tahap E-G)", async () => {
    const h = buka();
    await bukaTampilan(h);
    const ids = Array.from(baca("blangko-derry.js").matchAll(/^ {4}"([a-z0-9-]+)": \{\n {6}judul:/gm)).map((m) => m[1]);
    expect(ids.length).toBeGreaterThanOrEqual(15);
    for (const id of ids) {
      const k = h.w.aletaBlangkoDerry.keterangan(id);
      expect(k, id).not.toBeNull();
      const teks = [k.judul, k.singkat, ...k.isi].join(" ");
      expect(teks, id).not.toMatch(/\b(peladen|borang|galat|endpoint|bot|api)\b|\btahap [A-H]\b/i);
    }
  });
});

describe("B. Alat saya", () => {
  it("BAS massal hari ini tidak lagi 'menyusul': membuka Cetak massal jenis BAS (Super Admin, bawaannya putusan)", async () => {
    const h = buka({ orang: "admin" });
    await bukaTampilan(h);
    klik(h, "#bd-alat-btn");
    const bas = q(h, '[data-alat="massal:bas"]')!;
    expect(bas.textContent).not.toContain("menyusul");
    bas.click();
    await sampai(() => h.w.aletaBlangkoDerryMassal.keadaan().terbuka, "Cetak massal terbuka");
    expect(h.w.aletaBlangkoDerryMassal.keadaan().jenis).toBe("bas");
  });

  it("tombol Cetak massal langkah 1 tanpa jenis memakai jenis bawaan peran (putusan bagi Super Admin)", async () => {
    const h = buka({ orang: "admin" });
    await bukaTampilan(h);
    klik(h, "#bd-massal");
    await sampai(() => h.w.aletaBlangkoDerryMassal.keadaan().terbuka, "Cetak massal terbuka");
    expect(h.w.aletaBlangkoDerryMassal.keadaan().jenis).toBe("put");
  });

  it("Relaas massal membuka jenis relaas; jenis yang tidak boleh untuk akun diabaikan (hakim tetap putusan)", async () => {
    const h = buka({ orang: "admin" });
    await bukaTampilan(h);
    klik(h, "#bd-alat-btn");
    klik(h, '[data-alat="massal:rel"]');
    await sampai(() => h.w.aletaBlangkoDerryMassal.keadaan().terbuka, "Cetak massal terbuka");
    expect(h.w.aletaBlangkoDerryMassal.keadaan().jenis).toBe("rel");
    const hk = buka();
    await bukaTampilan(hk);
    hk.w.aletaBlangkoDerry.bukaMassal("bas");
    await sampai(() => hk.w.aletaBlangkoDerryMassal.keadaan().terbuka, "Cetak massal hakim terbuka");
    expect(hk.w.aletaBlangkoDerryMassal.keadaan().jenis).toBe("put");
  });

  it("alat kasir/PTSP menyebut tempatnya di SIPP, tanpa 'tahap berikutnya'", async () => {
    const h = buka({ orang: "admin" });
    await bukaTampilan(h);
    klik(h, "#bd-alat-btn");
    const kasir = q(h, '[data-alat="kasir:rekap"]')!;
    expect(kasir.textContent).toContain("di SIPP");
    expect(kasir.getAttribute("title")).toContain("halaman daftar perkara SIPP");
    kasir.click();
    const kabar = q(h, "#bd-toast")!.textContent || "";
    expect(kabar).toContain("Rekap kasir hari ini belum ada di tampilan ini");
    expect(kabar).toContain("panel ALETA halaman daftar perkara SIPP");
    expect(kabar).not.toMatch(/tahap berikutnya/);
    klik(h, "#bd-alat-btn");
    klik(h, '[data-alat="ptsp:ktp"]');
    expect(q(h, "#bd-toast")!.textContent).toContain("tab PTSP panel ALETA halaman perkara SIPP");
  });

  it("Tes putusan menyala: BAS massal tetap dimatikan (alat yang menulis)", async () => {
    const h = buka({ orang: "admin" });
    await bukaTampilan(h);
    ubahCek(h, q(h, "#bd-tes") as HTMLInputElement, true);
    klik(h, "#bd-alat-btn");
    klik(h, '[data-alat="massal:bas"]');
    expect(q(h, "#bd-toast")!.textContent).toContain("dimatikan pada mode Tes putusan");
    expect(h.w.aletaBlangkoDerryMassal.keadaan().terbuka).toBe(false);
  });
});

describe("C. lencana daftar perkara", () => {
  it("lencana prioritas dan dokumen menyebut alasannya saat kursor (saklar 'Alasan prioritas' mati pun tetap terbaca)", async () => {
    const h = buka();
    await bukaTampilan(h);
    const kartu = q(h, '[data-pk="581/Pdt.G/2026/PA.Dgl"]')!;
    const prio = kartu.querySelector(".bd-prio")!;
    expect(prio.getAttribute("title")).toMatch(/^Prioritas: Perlu segera - .*Sidang hari ini/);
    const dok = Array.from(kartu.querySelectorAll(".bd-chip")).find((c) => /SIPP/.test(c.textContent || ""))!;
    expect(dok.textContent).toBe("Belum diunggah ke SIPP");
    expect(dok.getAttribute("title")).toContain("belum ada di SIPP");
    // Tampilan lain memakai lencana yang sama.
    klik(h, '[data-lihat="tabel"]');
    expect(q(h, ".bd-tabelperkara .bd-prio")!.getAttribute("title")).toMatch(/^Prioritas: /);
    expect(baca("blangko-derry.js")).not.toContain("bot membatasi");
  });
});

describe("D. langkah 2 menyebut tombol yang benar", () => {
  it("Super Admin (Semua akun) sesudah memilih blangko: 'Ganti blangko', bukan 'Pilih blangko'", async () => {
    const h = buka({ orang: "admin" });
    await pilihPutusan(h);
    expect(q(h, '[data-bd2="bukamodal"]')!.textContent).toBe("Ganti blangko");
    expect(q(h, "#bd-saranblangko")!.textContent).toBe("Untuk mengganti, tekan Ganti blangko; saran per jenis ada di bagian Disarankan jendela itu.");
  });
});

describe("E. langkah 3 tanpa label ganda dan istilah teknis", () => {
  it("ikon sumber 'Anak dari pernikahan ini' tidak berbunyi 'ini ini'; bagian otomatis tanpa 'tabel ABT'", async () => {
    const h = buka();
    await pilihPutusan(h);
    expect(q(h, '[data-sumber="0007"]')!.getAttribute("aria-label")).toBe("Dari mana isian Anak dari pernikahan ini?");
    const ringkas = q(h, '[data-bd2="lanjutan"]')!.textContent || "";
    expect(ringkas).toContain("Isian di dalam bagian otomatis (1)");
    expect(ringkas).toContain("tidak tertulis langsung di blangko, dibaca kalimat otomatis (mis. amar)");
    expect(ringkas).not.toContain("tabel ABT");
  });
});

describe("F. langkah 5 runut", () => {
  it("urutan pilihan: RTF, PDF, Tambah tanda tangan, PDF SALINAN, PDF anonim, e-Doc (tanda tangan hanya berlaku pada PDF)", async () => {
    const h = buka();
    await pilihPutusan(h);
    const grup = q(h, '[data-wadah="cetak"] [aria-label="Pilihan cetak"]')!;
    const urut = Array.from(grup.querySelectorAll("[data-fmt], #bd-btnttd")).map((e) => e.getAttribute("data-fmt") || "ttd");
    expect(urut).toEqual(["rtf", "pdf", "ttd", "salinan", "anon", "edoc"]);
    expect(q(h, "#bd-btnttd")!.getAttribute("title")).toBe("Tanda tangan hanya dibubuhkan pada PDF");
  });

  it("tanda tangan dipilih tanpa PDF: status mengingatkan 'centang PDF'; PDF dicentang = catatan hilang", async () => {
    const h = buka();
    await pilihPutusan(h);
    klik(h, '[data-bd2="popttd"]');
    const kotak = await sampai(() => D_(h).querySelector('[data-ttd="ketua"]') as HTMLInputElement | null, "pilihan tanda tangan");
    ubahCek(h, kotak, true);
    expect(q(h, "#bd-statuscetak")!.textContent).toContain("Tanda tangan hanya dibubuhkan pada PDF: centang PDF.");
    ubahCek(h, q(h, '[data-fmt="pdf"]') as HTMLInputElement, true);
    const st = q(h, "#bd-statuscetak")!.textContent || "";
    expect(st).toContain("PDF (1 tanda tangan)");
    expect(st).not.toContain("centang PDF");
  });

  it("BAS: unggahan sendiri berlabel 'Unggah BAS sendiri', putusan tetap 'Unggah putusan sendiri'", async () => {
    const pp = buka({ orang: "pp" });
    await pilihBas(pp);
    await sampai(() => q(pp, '[data-wadah="cetak"] .bd-unggah'), "baris unggah");
    const cetakPp = q(pp, '[data-wadah="cetak"]')!.textContent || "";
    expect(cetakPp).toContain("Unggah BAS sendiri (RTF/DOCX/DOC)");
    expect(cetakPp).toContain("BAS yang sudah Anda sunting sendiri");
    expect(cetakPp).not.toContain("Unggah putusan sendiri");
    const hk = buka();
    await pilihPutusan(hk);
    expect(q(hk, '[data-wadah="cetak"]')!.textContent).toContain("Unggah putusan sendiri (RTF/DOCX/DOC)");
  });
});

describe("G. putusan dan BAS perkara yang sama memakai isian yang sama", () => {
  it("PP menulis alasan perceraian di BAS -> tersimpan ke ABT; hakim membuka putusan perkara yang sama dan membaca nilai itu", async () => {
    const pp = buka({ orang: "pp" });
    await pilihBas(pp);
    await sampai(() => q(pp, "#bd-i8503"), "isian alasan di BAS");
    ketik8503(pp, "B");
    await sampai(() => pp.abt["8503"] === "B", "8503 tersimpan ke ABT dari BAS");
    expect(mintaKe(pp, /edit_data\?.*no_var=8503/, "POST").length).toBe(1);
    // Hakim (akun lain) membuka putusan perkara yang sama: ABT yang sama -> nilai yang sama.
    const hk = buka({ abtAwal: { ...pp.abt } });
    await pilihPutusan(hk);
    await sampai(() => (q(hk, "#bd-i8503") as HTMLInputElement | null)?.value === "B", "putusan membaca 8503 dari ABT");
    // Membaca tidak menulis apa pun ke ABT.
    expect(mintaKe(hk, /edit_data\?.*no_var=8503/, "POST")).toEqual([]);
  });

  it("Super Admin: BAS lalu Ganti blangko ke putusan pada perkara yang sama - isian yang baru ditulis tetap terbaca", async () => {
    const h = buka({ orang: "admin" });
    await sampaiPerkara(h);
    klik(h, '[data-bd2="bukamodal"]');
    await sampai(() => q(h, `[data-bl="${BLANGKO_PUT}"]`), "jendela termuat (tab putusan)");
    klik(h, '[data-jenismodal="bas"]');
    (await sampai(() => q(h, '[data-kelmodal="k:BAS CG"]'), "kelompok BAS")).click();
    await sampai(() => q(h, `[data-bl="${BLANGKO_BAS}"]`), "berkas bas");
    klik(h, `[data-bl="${BLANGKO_BAS}"]`);
    await sampai(() => q(h, "#bd-i8503"), "isian alasan di BAS");
    ketik8503(h, "B");
    await sampai(() => h.abt["8503"] === "B", "tersimpan");
    klik(h, '[data-bd2="bukamodal"]');
    await sampai(() => q(h, "#bd-modal:not([hidden])") && q(h, `[data-bl="${BLANGKO_BAS}"]`), "jendela termuat (tab BAS)");
    klik(h, '[data-jenismodal="put"]');
    (await sampai(() => q(h, '[data-kelmodal="k:Putusan CG"]'), "kelompok putusan")).click();
    await sampai(() => q(h, `[data-bl="${BLANGKO_PUT}"]`), "berkas putusan");
    klik(h, `[data-bl="${BLANGKO_PUT}"]`);
    await sampai(() => q(h, "#bd-i0007") && (q(h, "#bd-i8503") as HTMLInputElement | null)?.value === "B", "putusan membaca 8503");
  });
});

describe("H. Widget ALETA dan kartu tawaran", () => {
  it("saklar Gembok dan Ukuran tampilan tersimpan di ekstensi; keterangan saklar tawaran menyebut isinya", async () => {
    const h = buka();
    await bukaTampilan(h);
    klik(h, "#bd-widget-btn");
    const gembok = q(h, '#bd-widget [data-cfg="gembok"]') as HTMLInputElement;
    const baru = !gembok.checked;
    ubahCek(h, gembok, baru);
    await sampai(() => h.simpanan.gembokKepalaAbt === baru, "gembok tersimpan");
    const ukuran = q(h, '#bd-widget [data-cfgukuran="1"]') as HTMLSelectElement;
    ukuran.value = "besar";
    ukuran.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => h.simpanan.blangkoDerryUkuran === "besar", "ukuran tersimpan");
    expect(q(h, '#bd-widget [data-cfg="tawar"]')!.closest("label")!.textContent).toContain("Aktifkan, Nanti saja, atau Jangan tawarkan lagi");
  });

  it("kartu tawaran di ABT biasa: 'Jangan tawarkan lagi' mematikan saklar tawaran dan kartunya hilang", async () => {
    const h = buka({ simpanan: { blangkoDerryTawar: true } });
    const kartu = await sampai(() => D_(h).getElementById("aleta-bd-tawar"), "kartu tawaran");
    (kartu.querySelector('[data-bd="tawar-jangan"]') as HTMLElement).click();
    await sampai(() => h.simpanan.blangkoDerryTawar === false, "tawaran dimatikan");
    expect(D_(h).getElementById("aleta-bd-tawar")).toBeNull();
  });
});
