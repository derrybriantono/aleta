// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Isian popup blangko Derry yang datanya ada di SIPP (agen Z1, 18 Okt 2026) - aleta_bot/services/abtIsianSippLanjutan.js.
 * Baris SIPP di bawah disalin dari bentuk data sipp_donggala (nama diganti); aturan 1183 dan 0303 diukur atas isian petugas:
 * 1183 = sidang ikrar pertama + 6 bulan cocok persis pada 8 dari 12 isian; 0303 jatuh 0-1 hari dari pendaftaran pada 384 dari 416.
 */

type Usulan = { kode: string; nama: string; nilai: string; keyakinan: string; sumber: Array<{ asal: string; kalimat: string }>; catatan: string; jagaIsianLama?: boolean };
type Modul = {
  isoKeTampil: (s: string) => string;
  tambahBulanIso: (s: string, n: number) => string;
  htmlKeBaris: (s: string) => string;
  usulanKesepakatan: (m: unknown) => Usulan[];
  usulanAlasanCabut: (m: unknown) => Usulan[];
  usulanBatasIkrar: (m: unknown) => Usulan[];
  usulanPengumumanItsbat: (m: unknown) => Usulan[];
  usulanKuasaTergugat: (m: unknown) => Usulan[];
  usulanLanjutanSipp: (id: number, q: (sql: string, p?: unknown[]) => Promise<unknown>) => Promise<Usulan[]>;
};

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot", "package.json"));
const M = require_(path.join(akar, "aleta_bot", "services", "abtIsianSippLanjutan.js")) as Modul;

const ISI_HB = `<p>Sehubungan dengan hal tersebut, para pihak telah menyepakati kesepakatan sebagian sebagai berikut:</p>

<p><strong>Pasal 1</strong></p>

<p>Para Pihak sepakat untuk mengakhiri konflik terkait harta bersama dengan musyawarah mufakat.</p>

<p><strong>Pasal 2</strong></p>

<ol>
 <li>Bahwa Penggugat dan Tergugat sepakat telah putus karena perceraian;</li>
 <li>Bahwa rumah di Desa Porame sepenuhnya menjadi milik Penggugat.</li>
</ol>

<p>&nbsp;</p>
<p>Demikian kesepakatan ini dibuat dengan sukarela &amp; tanpa tekanan;</p>`;

describe("htmlKeBaris", () => {
  it("paragraf, tebal, dan daftar bernomor menjadi baris yang disambung <br>", () => {
    expect(M.htmlKeBaris(ISI_HB)).toBe(
      [
        "Sehubungan dengan hal tersebut, para pihak telah menyepakati kesepakatan sebagian sebagai berikut:",
        "Pasal 1",
        "Para Pihak sepakat untuk mengakhiri konflik terkait harta bersama dengan musyawarah mufakat.",
        "Pasal 2",
        "1. Bahwa Penggugat dan Tergugat sepakat telah putus karena perceraian;",
        "2. Bahwa rumah di Desa Porame sepenuhnya menjadi milik Penggugat.",
        "Demikian kesepakatan ini dibuat dengan sukarela & tanpa tekanan;",
      ].join("<br>")
    );
  });
  it("kosong dan tag saja menghasilkan kosong", () => {
    expect(M.htmlKeBaris("")).toBe("");
    expect(M.htmlKeBaris("<p>&nbsp;</p><div> </div>")).toBe("");
    expect(M.htmlKeBaris(null as unknown as string)).toBe("");
  });
});

describe("tanggal", () => {
  it("tambahBulanIso seperti DATE_ADD MySQL (hari dijepit ke akhir bulan)", () => {
    expect(M.tambahBulanIso("2026-06-22", 6)).toBe("2026-12-22");
    expect(M.tambahBulanIso("2026-08-31", 6)).toBe("2027-02-28");
    expect(M.tambahBulanIso("2023-08-31", 6)).toBe("2024-02-29");
    expect(M.tambahBulanIso("2026-09-09", 6)).toBe("2027-03-09");
    expect(M.tambahBulanIso("0000-00-00", 6)).toBe("");
  });
  it("isoKeTampil menolak tanggal nol", () => {
    expect(M.isoKeTampil("2026-10-06")).toBe("06/10/2026");
    expect(M.isoKeTampil("0000-00-00")).toBe("");
    expect(M.isoKeTampil("")).toBe("");
  });
});

describe("usulan per isian", () => {
  it("8705 dan 8704 hanya bila hasil mediasi Y1 (akta perdamaian)", () => {
    const y1 = M.usulanKesepakatan({ hasil: "Y1", tgl: "2026-09-22", isi: ISI_HB });
    expect(y1.map((u) => u.kode)).toEqual(["8705", "8704"]);
    expect(y1[0]).toMatchObject({ nilai: "22/09/2026", keyakinan: "pasti", jagaIsianLama: true });
    expect(y1[1].nilai.startsWith("Sehubungan dengan hal tersebut")).toBe(true);
    expect(y1[1].keyakinan).toBe("cukup");
    for (const h of ["S", "T", "D", "Y2", "", null]) expect(M.usulanKesepakatan({ hasil: h, tgl: "2026-09-22", isi: ISI_HB })).toEqual([]);
    expect(M.usulanKesepakatan(null)).toEqual([]);
  });
  it("isi kesepakatan yang terlalu panjang tidak disalin, hanya disebut", () => {
    const panjang = `<p>${"kalimat kesepakatan yang sangat panjang ".repeat(300)}</p>`;
    const [t, isi] = M.usulanKesepakatan({ hasil: "Y1", tgl: "2026-09-22", isi: panjang });
    expect(t.kode).toBe("8705");
    expect(isi).toMatchObject({ kode: "8704", nilai: "", keyakinan: "kosong" });
  });
  it("8433 hanya pada hasil mediasi Y2 (berhasil dengan pencabutan)", () => {
    expect(M.usulanAlasanCabut({ hasil: "Y2" })).toMatchObject([{ kode: "8433", nilai: "mediasi berhasil dan para pihak telah berdamai", keyakinan: "cukup" }]);
    for (const h of ["Y1", "S", "T", "D", "", undefined]) expect(M.usulanAlasanCabut({ hasil: h })).toEqual([]);
  });
  it("1183 = sidang ikrar pertama + 6 bulan, selalu ragu", () => {
    const [u] = M.usulanBatasIkrar({ sidangPertama: "2026-06-22" });
    expect(u).toMatchObject({ kode: "1183", nilai: "22/12/2026", keyakinan: "ragu" });
    expect(M.usulanBatasIkrar({ sidangPertama: "" })).toEqual([]);
    expect(M.usulanBatasIkrar(null)).toEqual([]);
  });
  it("0303 hanya itsbat nikah (jenis 360), selalu ragu", () => {
    expect(M.usulanPengumumanItsbat({ jenisPerkaraId: 360, tanggalDaftar: "2026-10-01" })).toMatchObject([{ kode: "0303", nilai: "01/10/2026", keyakinan: "ragu" }]);
    expect(M.usulanPengumumanItsbat({ jenisPerkaraId: 347, tanggalDaftar: "2026-10-01" })).toEqual([]);
    expect(M.usulanPengumumanItsbat({ jenisPerkaraId: 360, tanggalDaftar: "" })).toEqual([]);
  });
  it("0185 dari kuasa Tergugat pertama yang bertanggal, ragu", () => {
    const [u] = M.usulanKuasaTergugat([
      { nama: "A", nomorKuasa: "", tanggalKuasa: "" },
      { nama: "Budi, S.H.", nomorKuasa: "12/SK/IV/2026", tanggalKuasa: "2026-04-10" },
    ]);
    expect(u).toMatchObject({ kode: "0185", nilai: "10/04/2026", keyakinan: "ragu" });
    expect(M.usulanKuasaTergugat([])).toEqual([]);
  });
  it("nilai yang ditulis ke ABT hanya data (tidak memuat kata Aleta)", () => {
    const semua = [
      ...M.usulanKesepakatan({ hasil: "Y1", tgl: "2026-09-22", isi: ISI_HB }),
      ...M.usulanAlasanCabut({ hasil: "Y2" }),
      ...M.usulanBatasIkrar({ sidangPertama: "2026-06-22" }),
      ...M.usulanPengumumanItsbat({ jenisPerkaraId: 360, tanggalDaftar: "2026-10-01" }),
      ...M.usulanKuasaTergugat([{ nama: "B", tanggalKuasa: "2026-04-10" }]),
    ];
    expect(semua.length).toBe(6);
    for (const u of semua) expect(u.nilai).not.toMatch(/aleta/i);
  });
});

describe("usulanLanjutanSipp", () => {
  const baris = (sql: string): unknown => {
    if (/FROM perkara p WHERE/.test(sql)) return [{ jenisPerkaraId: 360, tanggalDaftar: "2026-10-01" }];
    if (/FROM perkara_mediasi/.test(sql)) return [{ hasil: "Y1", tgl: "2026-09-22", isi: "<p>Pasal 1</p><p>Sepakat rukun.</p>" }];
    if (/FROM perkara_ikrar_talak/.test(sql)) return [{ sidangPertama: "2026-06-22" }];
    if (/FROM perkara_pengacara/.test(sql)) return [{ nama: "Budi", nomorKuasa: "", tanggalKuasa: "2026-04-10" }];
    return [];
  };
  it("menggabungkan semua sumber SIPP (hanya SELECT)", async () => {
    const sql: string[] = [];
    const u = await M.usulanLanjutanSipp(10, async (s) => {
      sql.push(s);
      return baris(s);
    });
    expect(u.map((x) => x.kode).sort()).toEqual(["0185", "0303", "1183", "8704", "8705"]);
    expect(sql.length).toBe(4);
    for (const s of sql) expect(s.trim()).toMatch(/^SELECT/i);
  });
  it("satu pembacaan gagal (tabel tidak ada) tidak menggagalkan yang lain", async () => {
    const u = await M.usulanLanjutanSipp(10, async (s) => {
      if (/perkara_mediasi/.test(s)) throw new Error("Table doesn't exist");
      return baris(s);
    });
    expect(u.map((x) => x.kode).sort()).toEqual(["0185", "0303", "1183"]);
  });
  it("perkara tak sah atau tanpa pembaca menghasilkan kosong", async () => {
    expect(await M.usulanLanjutanSipp(0, async () => [])).toEqual([]);
    expect(await M.usulanLanjutanSipp(5, undefined as never)).toEqual([]);
  });
});
