// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { susunPenyatu, type FaktaBot, type FaktaPortal, type MasukanSusun } from "@/server/modules/aleta-ecourt/penyatu";

/**
 * ============================================================================
 * SIPP DENGAN IDE ALETA - GELOMBANG 2: PENYATU & DOBEL (Tahap M2, 16 Okt 2026)
 * ============================================================================
 *
 *   A. Penimbang portal (susunPenyatu) - aturan yang diukur atas data server
 *   B. Layanan bot (penyatuPerkaraService) - dijalankan dengan basis data tiruan:
 *      hanya SELECT, galat disebut (bukan dijawab kosong)
 *   C. Ekstensi (sipp-ide-m2.js) dijalankan SUNGGUHAN di jsdom atas replika
 *      halaman perkara SIPP 7.0.4: kotak penyatu, klik selisih, tombol tab,
 *      lencana Jadwal, Tampilan Lama, saklar
 *   D. Dobel: hanya yang dobel penuh disembunyikan, dapat dimunculkan lagi
 *   E. Manifest & penyusun
 */

const AKAR = path.resolve(__dirname, "../../..");
const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(EKSTENSI, n), "utf8").replace(/\r\n/g, "\n");
const SUMBER = baca("sipp-ide-m2.js");
const NOMOR = "445/Pdt.G/2026/PA.Dgl";
const HARI_INI = "2026-10-16";

// ─────────────────────────────────────────────────────────────────────────────
// Fakta tiruan
// ─────────────────────────────────────────────────────────────────────────────
function fakta(ubah: (f: FaktaBot) => void = () => {}): FaktaBot {
  const f: FaktaBot = {
    ok: true,
    perkara: { perkaraId: 9956, nomorPerkara: NOMOR, jenisPerkara: "Cerai Gugat", alurPerkaraId: 15, tanggalDaftar: "2026-08-03", tahapan: "Persidangan", proses: "Sidang", ecourt: true },
    sipp: {
      terbaca: true,
      sidang: [
        { id: 501, urutan: 1, tanggal: "2026-08-20", agenda: "Sidang pertama", ditunda: true, alasanDitunda: "", dihadiriOleh: "1", ikrar: false, verzet: false, adaBas: true },
        { id: 502, urutan: 2, tanggal: "2026-09-10", agenda: "Pembuktian", ditunda: true, alasanDitunda: "", dihadiriOleh: "2", ikrar: false, verzet: false, adaBas: true },
        { id: 503, urutan: 3, tanggal: "2026-10-06", agenda: "Putusan", ditunda: false, alasanDitunda: "", dihadiriOleh: "2", ikrar: false, verzet: false, adaBas: true },
      ],
      hakim: [{ nama: "Dra. Hakimah, M.H.", jabatan: "Hakim Ketua", urutan: 1 }],
      pp: [{ nama: "Panji Pengganti, S.H.", jabatan: "", urutan: 1 }],
      js: [{ nama: "Juru Sitanto", jabatan: "", urutan: 1 }],
      penetapan: { pmh: "2026-08-04", ppp: "2026-08-04", pjs: "2026-08-04", phs: "2026-08-05", sidangPertama: "2026-08-20" },
      edocPenetapan: { pmh: true, ppp: true, pjs: true, phs: true },
      putusan: { ada: true, tanggal: "2026-10-06", statusNama: "Dikabulkan", adaEdoc: true, adaAnonim: true, minutasi: "2026-10-06", bht: "" },
      relaas: [{ sidangId: 501, jumlah: 1, berdokumen: 1 }],
      mediasi: ["2026-08-27"],
    },
    abt: { terbaca: true, saksi: [{ sidangId: 502, tanyaJawab: 24, saksi: 2, terakhir: "2026-09-10" }], validasiBas: [], isian: [] },
    aleta: {
      terbaca: true,
      ecourtPutusan: { adaTab: true, adaPutusan: true, dokumenAda: true, tanggalPutusan: "2026-10-06", tanggalBht: "", diperiksa: "2026-10-14 08:00" },
      tandaSidang: { selesai: ["2026-10-06"], berjalan: [], kehadiran: ["2026-08-27"] },
      jejakPenetapan: [{ aksi: "tulis", jenis: "pmh", tanggal: "2026-08-04", waktu: "2026-08-04 09:00" }],
    },
    galat: [],
  };
  ubah(f);
  return f;
}
const PORTAL: FaktaPortal = { lembar: [], terbit: { jumlah: 0, terakhir: "" }, isianAbt: [], galat: [] };
const susun = (o: Partial<MasukanSusun> & { f?: FaktaBot } = {}) =>
  susunPenyatu({ fakta: o.f || fakta(), portal: o.portal || PORTAL, peran: o.peran || ["panitera-pengganti"], namaAkun: o.namaAkun ?? "Panji Pengganti", hariIni: HARI_INI });

// ─────────────────────────────────────────────────────────────────────────────
describe("A. penimbang portal: status blangko, BAS, tugas, selisih", () => {
  it("perkara yang lengkap: tidak ada tugas, tidak ada selisih, blangko 4 dari 4 lengkap", () => {
    const h = susun();
    expect(h.ringkasBlangko).toBe("4 dari 4 lengkap");
    expect(h.tugas).toEqual([]);
    expect(h.selisih).toEqual([]);
    expect(h.basBelum).toEqual([]);
    // Tanggal ALETA 27 Agu = mediasi (bukan jadwal sidang) - tidak dianggap selisih.
    expect(h.selisih.find((s) => s.kode === "sidang-tanggal")).toBeUndefined();
  });

  it("BAS sidang lewat tanpa e-Doc: masuk daftar beserta bukti ABT; tugas Unggah BAS untuk PP perkara itu", () => {
    const f = fakta((x) => {
      x.sipp.sidang![1].adaBas = false;
    });
    const h = susun({ f });
    expect(h.basBelum).toHaveLength(1);
    expect(h.basBelum[0]).toMatchObject({ tanggal: "2026-09-10", urutan: 2 });
    expect(h.basBelum[0].bukti.join(" ")).toMatch(/ABT: keterangan 2 saksi \(24 tanya-jawab\)/);
    const t = h.tugas.find((x) => x.kode === "unggah-bas")!;
    expect(t).toMatchObject({ peran: "panitera-pengganti", untukAnda: true });
    expect(t.tempat.map((x) => x.jenis)).toEqual(["tab", "abt"]);
    expect(h.blangko.find((b) => b.jenis === "bas")!.keadaan).toBe("kurang");
    // PP lain (nama tidak tertulis di perkara) = tugas tetap ada, bukan "untuk Anda".
    expect(susun({ f, namaAkun: "Orang Lain" }).tugas.find((x) => x.kode === "unggah-bas")!.untukAnda).toBe(false);
    // Hakim melihatnya sebagai tugas peran lain.
    expect(susun({ f, peran: ["hakim"], namaAkun: "Hakimah" }).tugas.find((x) => x.kode === "unggah-bas")!.untukAnda).toBe(false);
  });

  it("sidang lama (> 120 hari) tanpa BAS hanya dihitung, bukan tugas (BAS SIPP 99,5% terunggah tiap tahun)", () => {
    const f = fakta((x) => {
      x.sipp.sidang!.unshift({ id: 400, urutan: 0, tanggal: "2026-03-01", agenda: "", ditunda: true, alasanDitunda: "", dihadiriOleh: "", ikrar: false, verzet: false, adaBas: false });
    });
    const h = susun({ f });
    expect(h.basBelum).toEqual([]);
    expect(h.basLama).toBe(1);
    expect(h.tugas.find((x) => x.kode === "unggah-bas")).toBeUndefined();
    expect(h.blangko.find((b) => b.jenis === "bas")!.keadaan).toBe("selesai-lama");
  });

  it("e-Doc penetapan: perkara berjalan tanpa e-Doc PMH = tugas Ketua; perkara lama yang sudah putus tanpa e-Doc sama sekali = bukan tugas", () => {
    const berjalan = fakta((x) => {
      x.sipp.putusan = { ada: false, tanggal: "", statusNama: "", adaEdoc: false, adaAnonim: false, minutasi: "", bht: "" };
      x.sipp.edocPenetapan!.pmh = false;
    });
    const h = susun({ f: berjalan, peran: ["ketua"] });
    expect(h.tugas.find((t) => t.kode === "edoc-pmh")).toMatchObject({ peran: "ketua", untukAnda: true });

    const lama = fakta((x) => {
      x.sipp.edocPenetapan = { pmh: false, ppp: false, pjs: false, phs: false };
    });
    const h2 = susun({ f: lama, peran: ["ketua"] });
    expect(h2.tugas.filter((t) => t.kode.startsWith("edoc-"))).toEqual([]);
    expect(h2.blangko.find((b) => b.jenis === "penetapan")!.keadaan).toBe("selesai-lama");
  });

  it("e-Court vs SIPP: tanggal putusan beda = merah; BHT hanya di SIPP = catatan, bukan selisih", () => {
    const f = fakta((x) => {
      x.aleta.ecourtPutusan!.tanggalPutusan = "2026-10-07";
      x.sipp.putusan!.bht = "2026-10-21";
    });
    const h = susun({ f });
    const s = h.selisih.find((x) => x.kode === "putusan-tanggal")!;
    expect(s.tingkat).toBe("merah");
    expect(s.nilai).toEqual({ sipp: "6 Oktober 2026", ecourt: "7 Oktober 2026" });
    expect(s.perbaiki.map((p) => p.jenis)).toEqual(["tab", "aleta"]);
    expect(h.selisih.find((x) => x.kode === "bht-tanggal")).toBeUndefined();
    expect(h.catatan.join(" ")).toMatch(/BHT 21 Oktober 2026 sudah ada di SIPP; e-Court belum menampilkannya/);
  });

  it("e-Court sudah putus, SIPP belum: selisih status + tugas Isi Putusan Akhir untuk hakim", () => {
    const f = fakta((x) => {
      x.sipp.putusan = { ada: false, tanggal: "", statusNama: "", adaEdoc: false, adaAnonim: false, minutasi: "", bht: "" };
    });
    const h = susun({ f, peran: ["hakim"], namaAkun: "Hakimah" });
    expect(h.selisih.map((s) => s.kode)).toContain("putusan-belum-sipp");
    expect(h.tugas.find((t) => t.kode === "isi-putusan")).toMatchObject({ peran: "hakim", untukAnda: true });
  });

  it("SIPP putus, e-Court belum: kuning HANYA bila e-Court dibaca sesudah tanggal putusan (11 perkara server dibaca sebelumnya)", () => {
    const sebelum = fakta((x) => {
      x.aleta.ecourtPutusan = { adaTab: true, adaPutusan: false, dokumenAda: false, tanggalPutusan: "", tanggalBht: "", diperiksa: "2026-10-05 10:00" };
    });
    expect(susun({ f: sebelum }).selisih.find((s) => s.kode === "putusan-belum-ecourt")).toBeUndefined();
    expect(susun({ f: sebelum }).catatan.join(" ")).toMatch(/sebelum tanggal putusan/);
    const sesudah = fakta((x) => {
      x.aleta.ecourtPutusan = { adaTab: true, adaPutusan: false, dokumenAda: false, tanggalPutusan: "", tanggalBht: "", diperiksa: "2026-10-12 10:00" };
    });
    expect(susun({ f: sesudah }).selisih.find((s) => s.kode === "putusan-belum-ecourt")!.tingkat).toBe("kuning");
  });

  it("tanggal sidang: ALETA mencatat sidang pada hari yang tidak ada di jadwal SIPP = merah, tombolnya ke tab Jadwal", () => {
    const f = fakta((x) => {
      x.aleta.tandaSidang.berjalan = ["2026-10-13"];
    });
    const s = susun({ f }).selisih.find((x) => x.kode === "sidang-tanggal")!;
    expect(s.tingkat).toBe("merah");
    expect(s.nilai.aleta).toBe("13 Oktober 2026");
    expect(s.perbaiki).toEqual([{ jenis: "tab", tab: "tabs4", label: "Buka tab Jadwal Sidang" }]);
  });

  it("ABT: keterangan saksi pada sidang yang tidak ada di jadwal perkara ini (18 dari 2.516 pasangan di server)", () => {
    const f = fakta((x) => {
      x.abt.saksi!.push({ sidangId: 99999, tanyaJawab: 7, saksi: 1, terakhir: "2026-09-01" });
    });
    const s = susun({ f }).selisih.find((x) => x.kode === "abt-saksi-sidang")!;
    expect(s.nilai.abt).toBe("1 sidang (7 tanya-jawab)");
    expect(s.perbaiki[0].jenis).toBe("abt");
  });

  it("penetapan yang ditulis ALETA lalu diubah di SIPP = kuning; isian tangan ABT yang berbeda dari SIPP = kuning", () => {
    const f = fakta((x) => {
      x.aleta.jejakPenetapan = [{ aksi: "tulis", jenis: "pmh", tanggal: "2026-08-03", waktu: "2026-08-03 09:00" }];
    });
    const portal: FaktaPortal = { ...PORTAL, isianAbt: [{ kode: "8537", label: "Kuasa Penggugat/Pemohon", nilaiAbt: "Budi, S.H.", nilaiSipp: "Budiman, S.H." }] };
    const h = susun({ f, portal });
    expect(h.selisih.find((s) => s.kode === "penetapan-pmh-tanggal")!.nilai).toEqual({ sipp: "4 Agustus 2026", aleta: "3 Agustus 2026" });
    expect(h.selisih.find((s) => s.kode === "abt-isian-8537")!.nilai).toEqual({ abt: "Budi, S.H.", sipp: "Budiman, S.H." });
  });

  it("sumber yang gagal dibaca DISEBUT (catatan + lampu), bagian itu 'tidak terbaca' - bukan 'tidak ada selisih'", () => {
    const f = fakta((x) => {
      x.abt.terbaca = false;
      x.abt.saksi = null;
      x.sipp.relaas = null;
      x.galat = [{ sumber: "abt", langkah: "keterangan saksi", sebab: "ER_ACCESS_DENIED" }];
    });
    const h = susun({ f });
    expect(h.sumber.abt).toBe(false);
    expect(h.catatan.join(" ")).toMatch(/ABT: data keterangan saksi belum dapat dibaca saat ini/);
    // Sebab teknis tidak tampil di layar petugas, tetapi tetap ada untuk penelusuran.
    expect(h.catatan.join(" ")).not.toMatch(/ER_ACCESS_DENIED/);
    expect(h.galatTeknis).toEqual(["abt/keterangan saksi: ER_ACCESS_DENIED"]);
    expect(h.blangko.find((b) => b.jenis === "relaas")!.keadaan).toBe("tidak-terbaca");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("B. layanan bot: hanya SELECT, galat disebut", () => {
  const req = createRequire(__filename);
  const layanan = req(path.join(AKAR, "aleta_bot/services/penyatuPerkaraService.js"));

  function deps(o: { gagalAbt?: boolean; tanpaTabelTanda?: boolean } = {}) {
    const sql: string[] = [];
    const catat = (s: string) => {
      sql.push(s.trim());
    };
    return {
      sql,
      d: {
        tabelAda: async () => true,
        kolomAda: async () => true,
        kueriSipp: async (s: string, p: unknown[]) => {
          catat(s);
          if (/FROM perkara WHERE/.test(s)) return p[0] === 9956 || p[0] === NOMOR ? [{ perkara_id: 9956, nomor_perkara: NOMOR, jenis_perkara_nama: "Cerai Gugat", alur_perkara_id: 15, tanggal_daftar: "2026-08-03" }] : [];
          if (/FROM perkara_jadwal_sidang/.test(s)) return [{ id: 501, urutan: 1, tanggal: "2026-08-20", agenda: "Sidang", ditunda: "Y", ada_bas: 1 }, { id: 502, urutan: 2, tanggal: "0000-00-00", ada_bas: 0 }];
          if (/FROM perkara_hakim_pn/.test(s)) return [{ nama: "Dra. Hakimah", jabatan: "Hakim Ketua", urutan: 1 }];
          if (/FROM perkara_putusan/.test(s)) return [{ tanggal: "2026-10-06", status_nama: "Dikabulkan", ada_edoc: 1, ada_anonim: 0, minutasi: "2026-10-06", bht: null }];
          if (/FROM perkara_dokumen_penetapan/.test(s)) return [{ j: 1, n: 1 }, { j: 4, n: 2 }];
          if (/FROM perkara_efiling_id/.test(s)) return [{ n: 1 }];
          return [];
        },
        kueriAbt: async (s: string) => {
          catat(s);
          if (o.gagalAbt) throw Object.assign(new Error("Access denied"), { code: "ER_ACCESS_DENIED_ERROR" });
          if (/abt_keterangan_saksi/.test(s)) return [{ sidang_id: 502, n: 24, saksi: 2, terakhir: "2026-09-10" }];
          return [];
        },
        kueriBot: async (s: string) => {
          catat(s);
          if (o.tanpaTabelTanda && /aleta_bot_sidang_berjalan/.test(s)) throw Object.assign(new Error("no table"), { code: "ER_NO_SUCH_TABLE", errno: 1146 });
          if (/aleta_bot_ecourt_putusan/.test(s)) return [{ ada_tab: 1, ada_baris: 1, dokumen_ada: 1, tanggal_putusan_teks: "Selasa, 06 Oktober 2026", tanggal_bht_teks: "", diperiksa: "2026-10-14 08:00" }];
          return [];
        },
      },
    };
  }

  it("fakta tiga sumber tersusun; tanggal nol SIPP = kosong; teks tanggal e-Court diurai; semua kueri SELECT berparameter", async () => {
    const { d, sql } = deps();
    const h = await layanan.buatLayanan(d).ringkas({ nomorPerkara: NOMOR });
    expect(h.ok).toBe(true);
    expect(h.perkara).toMatchObject({ perkaraId: 9956, nomorPerkara: NOMOR, ecourt: true });
    expect(h.sipp.sidang[1].tanggal).toBe("");
    expect(h.sipp.sidang[0]).toMatchObject({ ditunda: true, adaBas: true });
    expect(h.sipp.edocPenetapan).toEqual({ pmh: true, ppp: false, pjs: false, phs: true });
    expect(h.sipp.putusan).toMatchObject({ ada: true, adaEdoc: true, adaAnonim: false, bht: "" });
    expect(h.abt.saksi).toEqual([{ sidangId: 502, tanyaJawab: 24, saksi: 2, terakhir: "2026-09-10" }]);
    expect(h.aleta.ecourtPutusan).toMatchObject({ tanggalPutusan: "2026-10-06", adaPutusan: true });
    expect(h.galat).toEqual([]);
    expect(sql.length).toBeGreaterThan(10);
    for (const s of sql) {
      expect(s, s.slice(0, 60)).toMatch(/^SELECT\b/i);
      expect(s).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|CALL|CREATE)\b/i);
      expect(s).not.toContain(NOMOR);
    }
  });

  it("ABT yang gagal dibaca: disebut di galat, sumbernya tidak terbaca, bagiannya null (bukan [])", async () => {
    const { d } = deps({ gagalAbt: true });
    const h = await layanan.buatLayanan(d).ringkas({ perkaraId: "9956" });
    expect(h.abt.terbaca).toBe(false);
    expect(h.abt.saksi).toBeNull();
    expect(h.galat.map((g: { sumber: string; langkah: string }) => `${g.sumber}:${g.langkah}`)).toEqual(["abt:keterangan saksi", "abt:validasi BAS", "abt:isian tangan"]);
    expect(h.sipp.terbaca).toBe(true);
  });

  it("tabel tanda sidang ALETA yang belum pernah dibuat = belum dipakai (kosong), bukan galat; perkara tak dikenal = perkara_tidak_ditemukan", async () => {
    const { d } = deps({ tanpaTabelTanda: true });
    const h = await layanan.buatLayanan(d).ringkas({ perkaraId: "9956" });
    expect(h.aleta.tandaSidang.berjalan).toEqual([]);
    expect(h.galat).toEqual([]);
    expect(await layanan.buatLayanan(deps().d).ringkas({ nomorPerkara: "1/Pdt.G/2020/PA.Dgl" })).toEqual({ ok: false, alasan: "perkara_tidak_ditemukan" });
    expect(layanan.murni.tanggalTeks("Senin, 18 Mei 2026")).toBe("2026-05-18");
    expect(layanan.murni.tanggalTeks("-")).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C-D. Ekstensi di jsdom
// ─────────────────────────────────────────────────────────────────────────────
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 30));
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Jendela = any;
const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(f: () => T, pesan: string, ms = 2000): Promise<T> {
  const batas = Date.now() + ms;
  for (;;) {
    const v = f();
    if (v) return v;
    if (Date.now() > batas) throw new Error(`tidak tercapai: ${pesan}`);
    await tunggu(15);
  }
}

/** Halaman perkara SIPP 7.0.4 (detil_perkara_agama.php + tab Jadwal Sidang jadwal_sidang_p.php) - bentuk dari HTML setempat 16 Okt. */
function halaman(o: { panel?: string; l1?: boolean; jadwalBelum?: boolean } = {}) {
  const l1 = o.l1
    ? `<td class="aleta-sisip aleta-l1 aleta-l1-submenu"><a data-l1="aleta" href="http://127.0.0.1:8056/aleta/aleta-ecourt?perkara=x">Buka di ALETA</a></td>`
    : "";
  return `<!doctype html><html><head></head><body>
${o.panel || ""}
<div id="konten"><table width="100%" id="submenus"><tr><td><table><tr>
  <td id="backlist"><a class="btn btn-default btn-sm" href="#">Kembali</a></td>${l1}
</tr></table></td></tr></table>
<div id='content'><div id="usual2" class="usual"><ul>
  <li class='tab'><a href="#tabs1" id='tabInfo' class="selected">Data Umum</a></li><li class='tab'><a class='tabs2' href="#tabs2" id='tabInfo'>Penetapan</a></li>
  <li class='tab'><a class='tabs4' href="#tabs4" id='tabInfo'>Jadwal Sidang</a></li><li class='tab'><a class='tabs10' href="#tabs10" id='tabInfo'>Putusan Akhir</a></li>
</ul>
<div id="tabs1"><div id="infoPerkara"><table id="tableinfo"><tr><td id="first-child">Nomor Perkara</td><td>${NOMOR}</td></tr></table></div></div>
<div id="tabs4"><div class="cssTable"><table id="tableinfo"><tbody>
<tr><td>No</td><td>Tanggal</td><td>Jam Sidang</td><td>Agenda Sidang</td><td>Sidang Keliling</td><td>Ruang &amp; Data Persidangan</td><td>Cetak Dokumen</td><td>Tindakan</td></tr>
<tr><td align="center">2</td><td align="center"> Kamis, 10 Sep. 2026 </td><td>09:00</td><td>Pembuktian</td><td>Tidak</td><td>Ruang Sidang 1<br>${o.jadwalBelum ? "<span style='color:red;font-weight:bold'>Dokumen Belum Ada</span><br><a class='btn btn-default btn-sm'>Unggah BAS</a>" : "<a>Unduh BAS</a>"}</td><td></td><td></td></tr>
</tbody></table></div></div>
</div></div></div>
</body></html>`;
}

function jawabanPenyatu(ubah: (f: FaktaBot) => void = () => {}) {
  return susun({ f: fakta(ubah) });
}

function buka(html: string, o: { simpanan?: Record<string, unknown>; mode?: string; jawaban?: unknown; status?: number } = {}) {
  const dom = new JSDOM(html, { url: "http://127.0.0.1:8056/index.php/perkara_detil_agama/abc", runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as Jendela;
  const simpanan: Record<string, unknown> = { ...(o.simpanan || {}) };
  w.__tulisan = [] as Array<Record<string, unknown>>;
  w.__alamat = [] as string[];
  w.__pendengar = [] as Array<(u: unknown, wil: string) => void>;
  w.chrome = {
    storage: {
      local: {
        get: async (k: string[] | string | null) => {
          if (k == null) return { ...simpanan };
          const daftar = Array.isArray(k) ? k : [k];
          return Object.fromEntries(daftar.filter((x) => x in simpanan).map((x) => [x, simpanan[x]]));
        },
        set: async (isi: Record<string, unknown>) => {
          w.__tulisan.push(isi);
          const ubah: Record<string, { newValue: unknown }> = {};
          for (const [k, v] of Object.entries(isi)) ubah[k] = { newValue: v };
          Object.assign(simpanan, isi);
          for (const f of w.__pendengar) f(ubah, "local");
        },
        remove: async () => {},
      },
      onChanged: { addListener: (f: (u: unknown, wil: string) => void) => w.__pendengar.push(f) },
    },
  };
  w.alatUjiMode = () => o.mode || "baru";
  w.fetch = async (alamat: string, opsi?: { method?: string }) => {
    w.__alamat.push(`${(opsi && opsi.method) || "GET"} ${alamat}`);
    const status = o.status || 200;
    return { ok: status < 400, status, json: async () => ({ ok: true, data: o.jawaban === undefined ? jawabanPenyatu() : o.jawaban }) };
  };
  const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(SUMBER, ctx, { filename: "sipp-ide-m2.js" });
  return w;
}

describe("C. kotak penyatu di halaman perkara SIPP", () => {
  it("UI Baru: kotak di atas deretan tab, satu GET ke rute penyatu dengan nomor halaman, ringkasan di kepala", async () => {
    const w = buka(halaman());
    w.aletaSippIdeM2.pasang(w.document);
    const kotak = w.document.querySelector('.aleta-m2-kotak[data-m2="penyatu"]');
    expect(kotak).not.toBeNull();
    expect(kotak.nextElementSibling.id).toBe("usual2");
    await sampai(() => kotak.getAttribute("data-m2-keadaan") === "siap", "kotak siap");
    expect(w.__alamat).toEqual([`GET /aleta/api/aleta-ecourt/penyatu?nomor=${encodeURIComponent(NOMOR)}`]);
    const kepala = kotak.querySelector(".aleta-m2-kepala").textContent;
    expect(kepala).toContain("Blangko 4 dari 4 lengkap");
    expect(kepala).toContain("Data sama");
    expect(kotak.querySelector(".aleta-m2-perlu").hidden).toBe(true);
    // Lencana kepala = gaya bersama lencana ALETA (.aleta-tanda + warna) dengan arti di (i) (title).
    expect(kotak.querySelectorAll(".aleta-m2-kepala .aleta-tanda.aleta-tanda-hijau[title]").length).toBe(4);
    expect(w.document.documentElement.getAttribute("data-aleta-lencana")).toBe("rancangan");
    // Tidak ada yang perlu perhatian -> rincian terlipat; klik kepala membukanya.
    const badan = kotak.querySelector(".aleta-m2-badan");
    expect(badan.hidden).toBe(true);
    kotak.querySelector(".aleta-m2-kepala").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    expect(badan.hidden).toBe(false);
    // Pasang ulang tidak menggandakan kotak maupun permintaan.
    w.aletaSippIdeM2.pasang(w.document);
    expect(w.document.querySelectorAll(".aleta-m2-kotak").length).toBe(1);
    expect(w.__alamat.length).toBe(1);
  });

  it("selisih dapat diklik: penjelasan + nilai per sumber + tombol ke tab SIPP yang benar-benar membuka tab itu", async () => {
    const jawaban = jawabanPenyatu((x) => {
      x.aleta.tandaSidang.berjalan = ["2026-10-13"];
      x.aleta.ecourtPutusan!.tanggalPutusan = "2026-10-07";
    });
    const w = buka(halaman(), { jawaban });
    w.aletaSippIdeM2.pasang(w.document);
    const kotak = w.document.querySelector(".aleta-m2-kotak");
    await sampai(() => kotak.getAttribute("data-m2-keadaan") === "siap", "siap");
    expect(kotak.querySelector(".aleta-m2-badan").hidden).toBe(false); // ada selisih -> terbuka
    expect(kotak.querySelector(".aleta-m2-kepala").textContent).toContain("2 data berbeda");
    const s = kotak.querySelector('[data-m2-selisih="sidang-tanggal"]');
    const urai = s.nextElementSibling;
    expect(urai.hidden).toBe(true);
    s.click();
    expect(urai.hidden).toBe(false);
    expect(s.getAttribute("aria-expanded")).toBe("true");
    expect(urai.querySelector("table").textContent).toContain("13 Oktober 2026");
    let diklik = "";
    w.document.querySelector('#usual2 a[href="#tabs4"]').addEventListener("click", () => (diklik = "tabs4"));
    urai.querySelector('[data-m2-tab="tabs4"]').click();
    expect(diklik).toBe("tabs4");
    // Tombol ALETA pada selisih putusan: alamat portal perkara ini, tab baru.
    const ss = kotak.querySelector('[data-m2-selisih="putusan-tanggal"]').nextElementSibling;
    const a = ss.querySelector('[data-m2-tempat="aleta"]');
    expect(a.getAttribute("href")).toBe(`http://127.0.0.1:8056/aleta/aleta-ecourt?perkara=${encodeURIComponent(NOMOR)}`);
    expect(a.target).toBe("_blank");
  });

  it("BAS belum diunggah: daftar + tugas Anda; lencana di baris Jadwal Sidang yang SIPP-nya 'Dokumen Belum Ada'; cetak Blangko Derry peramban ini disebut", async () => {
    const jawaban = jawabanPenyatu((x) => {
      x.sipp.sidang![1].adaBas = false;
    });
    const w = buka(halaman({ jadwalBelum: true }), { jawaban, simpanan: { [`blangkoDerryCetak:${NOMOR}|bas`]: "09.41" } });
    w.aletaSippIdeM2.pasang(w.document);
    const kotak = w.document.querySelector(".aleta-m2-kotak");
    await sampai(() => kotak.getAttribute("data-m2-keadaan") === "siap", "siap");
    const bas = kotak.querySelector('[data-m2-bagian="bas"]');
    expect(bas.querySelector('[data-m2-sidang="2026-09-10"]').textContent).toContain("Sidang ke-2, 10 September 2026");
    expect(bas.textContent).toContain("ABT: keterangan 2 saksi (24 tanya-jawab)");
    expect(kotak.querySelector('[data-m2-tugas="unggah-bas"]').textContent).toContain("Unggah BAS sidang 10 September 2026");
    expect(kotak.querySelector('[data-m2-jenis="bas"]').textContent).toContain("BAS dicetak 09.41 (di komputer ini)");
    const chip = await sampai(() => w.document.querySelector("#tabs4 .aleta-m2-chip-bas"), "lencana jadwal");
    expect(chip.previousElementSibling.textContent).toBe("Dokumen Belum Ada");
    expect(chip.title).toContain("keterangan 2 saksi");
  });

  it("Tampilan Lama: tidak ada apa pun dan tidak ada permintaan; saklar penyatu mati = kotak hilang; portal galat = disebut", async () => {
    const lama = buka(halaman(), { mode: "lama" });
    expect(lama.aletaSippIdeM2.pasang(lama.document)).toEqual({ penyatu: false, dobel: 0, lencana: 0 });
    expect(lama.document.querySelector(".aleta-m2")).toBeNull();
    await tunggu(400);
    expect(lama.__alamat).toEqual([]);

    const w = buka(halaman(), { simpanan: { sippPenyatu: false } });
    await tunggu(400);
    expect(w.document.querySelector(".aleta-m2-kotak")).toBeNull();
    await w.chrome.storage.local.set({ sippPenyatu: true });
    await sampai(() => w.document.querySelector(".aleta-m2-kotak"), "kotak muncul sesudah saklar menyala", 1500);

    const g = buka(halaman(), { status: 404, jawaban: null });
    g.aletaSippIdeM2.pasang(g.document);
    const k = g.document.querySelector(".aleta-m2-kotak");
    await sampai(() => k.getAttribute("data-m2-keadaan") === "gagal", "gagal");
    expect(k.textContent).toContain("belum tersedia di server");
  });

  it("rupa rancangan: 'Perlu diperiksa hari ini (N)' berisi chip yang membuka butirnya; tanpa kode/istilah teknis di layar; huruf tidak lebih kecil dari SIPP", async () => {
    const jawaban = jawabanPenyatu((x) => {
      x.sipp.sidang![1].adaBas = false;
      x.aleta.tandaSidang.berjalan = ["2026-10-13"];
      x.abt.saksi!.push({ sidangId: 99999, tanyaJawab: 7, saksi: 1, terakhir: "2026-09-01" });
      x.aleta.terbaca = false;
      x.galat = [{ sumber: "aleta", langkah: "jejak penetapan", sebab: "ER_NO_SUCH_TABLE aleta_bot_jejak_penetapan" }];
    });
    jawaban.selisih.push({ ...jawaban.selisih[0], kode: "abt-isian-8537", judul: "Kuasa Penggugat/Pemohon: isian ABT berbeda dari SIPP", penjelasan: "x", nilai: { abt: "A", sipp: "B" } });
    const w = buka(halaman(), { jawaban });
    w.aletaSippIdeM2.pasang(w.document);
    const kotak = w.document.querySelector(".aleta-m2-kotak");
    await sampai(() => kotak.getAttribute("data-m2-keadaan") === "siap", "siap");
    const perlu = kotak.querySelector(".aleta-m2-perlu");
    expect(perlu.hidden).toBe(false);
    expect(perlu.querySelector("b").textContent).toMatch(/^Perlu diperiksa hari ini \(\d+\)$/);
    const chip = Array.from(perlu.querySelectorAll(".aleta-m2-chip")).find((c: any) => /Tanggal sidang berbeda/.test(c.textContent)) as any;
    const s = kotak.querySelector('[data-m2-selisih="sidang-tanggal"]');
    expect(s.getAttribute("aria-expanded")).toBe("false");
    chip.click();
    expect(s.getAttribute("aria-expanded")).toBe("true");
    // Yang tampak di layar: tanpa kode ide, nama tabel/variabel, atau kode galat.
    const tampak = kotak.textContent;
    expect(tampak).not.toMatch(/#\d{3,5}#|\b(perkara|abt|aleta_bot)_[a-z_]+|\bER_[A-Z_]+|\b[A-J]\d{2}\b|\bsipp-\d+\b|8537/);
    expect(tampak).toContain("Sebagian belum terbaca");
    // Huruf: 13px seperti SIPP; tidak ada ukuran di bawah 12px untuk tulisan.
    const gaya = w.document.getElementById("aleta-m2-gaya").textContent;
    for (const m of gaya.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12);
    expect(gaya).toContain(".aleta-m2-kotak{margin:6px 5px 10px;padding:6px 10px;border-left:3px solid #16a34a");
  });

  it("tidak menulis ke mana pun: hanya GET rute penyatu; tidak ada form/input di dalam kotak", async () => {
    const w = buka(halaman({ jadwalBelum: true }), { jawaban: jawabanPenyatu((x) => (x.sipp.sidang![1].adaBas = false)) });
    w.aletaSippIdeM2.pasang(w.document);
    const kotak = w.document.querySelector(".aleta-m2-kotak");
    await sampai(() => kotak.getAttribute("data-m2-keadaan") === "siap", "siap");
    for (const b of Array.from(kotak.querySelectorAll("button"))) (b as HTMLButtonElement).click();
    await tunggu(100);
    expect(w.__alamat.every((a: string) => a.startsWith("GET /aleta/api/aleta-ecourt/penyatu?"))).toBe(true);
    expect(kotak.querySelector("form, input, select, textarea")).toBeNull();
    expect(w.__tulisan).toEqual([]);
  });
});

describe("D. dobel penuh: disembunyikan di UI Baru, dapat dimunculkan lagi, Tampilan Lama utuh", () => {
  const PANEL = `<div id="aleta-panel-sipp" class="aleta-panel"><div class="aleta-bagian" data-s2-fitur="edoc-penetapan"><div class="aleta-bagian-isi">
<button data-s2-edoc="otomatis">Ambil dari ABT &amp; upload</button>
<div class="aleta-s1-lipat" data-s2-fitur="edoc-penetapan-manual"><button data-s2-edoc="manual">Upload manual</button></div>
</div></div>
<div class="aleta-t7-cepat"><a class="aleta-t7-tautan" data-t7-fitur="sipp-16" href="#">Buka di ALETA ↗</a></div></div>`;

  it("unggah manual e-Doc penetapan disembunyikan (CSS, elemen tetap ada) + tautan Tampilkan menulis saklar; otomatis dari ABT tetap tampil", async () => {
    const w = buka(halaman({ panel: PANEL }));
    await tunggu(20); // saklar tersimpan selesai dibaca (mulai), seperti halaman yang sudah termuat
    w.aletaSippIdeM2.pasang(w.document);
    const gaya = w.document.getElementById("aleta-m2-dobel");
    expect(gaya.textContent).toContain('[data-s2-fitur="edoc-penetapan-manual"]{display:none!important}');
    expect(gaya.textContent).not.toContain("otomatis");
    const manual = w.document.querySelector('[data-s2-fitur="edoc-penetapan-manual"]');
    expect(manual).not.toBeNull(); // tidak dihapus
    expect(w.getComputedStyle(manual).display).toBe("none");
    expect(w.getComputedStyle(w.document.querySelector('[data-s2-edoc="otomatis"]')).display).not.toBe("none");
    // L1 tidak ada di halaman ini -> "Buka di ALETA" panel TIDAK disembunyikan (padanannya tidak tampil).
    expect(gaya.textContent).not.toContain("sipp-16");
    const catat = manual.nextElementSibling;
    expect(catat.className).toContain("aleta-m2-dobel-catat");
    catat.querySelector("a").click();
    await sampai(() => w.__tulisan.some((t: Record<string, unknown>) => t.sippTampilDobel === true), "saklar ditulis");
    await sampai(() => !w.document.getElementById("aleta-m2-dobel"), "gaya dobel dilepas", 1500);
    expect(w.getComputedStyle(manual).display).not.toBe("none");
  });

  it("'Buka di ALETA' panel disembunyikan hanya bila tombol L1 yang sama tampil; Tampilan Lama tidak menyembunyikan apa pun", () => {
    const w = buka(halaman({ panel: PANEL, l1: true }));
    w.aletaSippIdeM2.pasang(w.document);
    expect(w.document.getElementById("aleta-m2-dobel").textContent).toContain('a[data-t7-fitur="sipp-16"]{display:none!important}');
    const lama = buka(halaman({ panel: PANEL, l1: true }), { mode: "lama" });
    lama.aletaSippIdeM2.pasang(lama.document);
    expect(lama.document.getElementById("aleta-m2-dobel")).toBeNull();
    expect(lama.getComputedStyle(lama.document.querySelector('[data-s2-fitur="edoc-penetapan-manual"]')).display).not.toBe("none");
  });

  it("inventaris: tiap butir berpilihan sah dan beralasan; yang disembunyikan hanya yang dobel penuh dan berselektor", () => {
    const w = buka(halaman());
    const d = w.aletaSippIdeM2.DOBEL as Array<{ kode: string; pilih: string; selektor?: string; alasan: string }>;
    expect(d.length).toBeGreaterThanOrEqual(8);
    for (const x of d) {
      expect(["sembunyi", "biarkan", "tidak-ada"]).toContain(x.pilih);
      expect(x.alasan.length).toBeGreaterThan(20);
    }
    expect(d.filter((x) => x.pilih === "sembunyi").map((x) => x.kode)).toEqual(["edoc-penetapan-manual", "buka-di-aleta-panel"]);
    expect(d.filter((x) => x.pilih === "sembunyi").every((x) => x.selektor)).toBe(true);
    // Rute/fungsi lama tetap ada di konten.js (disembunyikan, bukan dihapus).
    const konten = baca("konten.js");
    expect(konten).toContain('manual.akar.setAttribute("data-s2-fitur", "edoc-penetapan-manual")');
    expect(konten).toContain('a.setAttribute("data-t7-fitur", "sipp-16")');
  });
});

describe("F. lencana ALETA di SIPP: satu gaya bersama rupa rancangan, UI Baru saja", () => {
  const css = baca("panel.css");
  const blok = css.slice(css.lastIndexOf("/*", css.indexOf("LENCANA ALETA DI SIPP - RUPA RANCANGAN")));

  it("panel.css: tiap aturan rupa rancangan tercakup html[data-aleta-lencana=rancangan]; warna tetap (bukan peubah panel), huruf 13px, (i) dari title", () => {
    const aturan = blok.replace(/\/\*[\s\S]*?\*\//g, "").split("}").map((x) => x.trim()).filter((x) => x.includes("{"));
    expect(aturan.length).toBeGreaterThanOrEqual(20);
    for (const a of aturan) expect(a.startsWith('html[data-aleta-lencana="rancangan"]'), a.slice(0, 80)).toBe(true);
    expect(blok.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/var\(--aleta-garis/);
    expect(blok).toMatch(/\.aleta-tanda-abu\s*\{ background: #6b7a72; color: #fff;/);
    expect(blok).toMatch(/\.aleta-tanda \{[\s\S]*?font-size: calc\(13px/);
    expect(blok).toMatch(/\.aleta-tanda\[title\]::after \{[\s\S]*?content: "i";/);
    for (const w of ["merah", "kuning", "hijau", "abu", "jingga", "fuchsia", "biru", "ungu", "sita"]) {
      expect(blok, w).toContain(`] .aleta-tanda-${w} `);
      expect(blok, `${w} gelap`).toContain(`[data-aleta-tema-sipp="gelap"] .aleta-tanda-${w} `);
    }
  });

  it("tema gelap: lencana tetap berwarna (bukan latar gelap samar) - latar >= 2:1 terhadap baris SIPP gelap, tulisan >= 4,5:1", () => {
    const lum = (h: string) => {
      const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const kontras = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const BARIS_GELAP = ["#0d1512", "#131c18", "#17211c"];
    for (const w of ["merah", "kuning", "hijau", "abu", "jingga", "fuchsia", "biru", "ungu", "sita"]) {
      const m = new RegExp(`\\[data-aleta-tema-sipp="gelap"\\] \\.aleta-tanda-${w}\\s*\\{ background: (#[0-9a-f]{6}); color: (#[0-9a-f]{6});`).exec(blok);
      expect(m, w).not.toBeNull();
      for (const r of BARIS_GELAP) expect(kontras(m![1], r), `${w} vs baris ${r}`).toBeGreaterThanOrEqual(2);
      expect(kontras(m![1], m![2]), `${w} tulisan`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("lencana lama konten.js (prodeo/GHAIB/kuasa...) ikut rupa rancangan di UI Baru tanpa diubah DOM-nya; Tampilan Lama: penandanya dicabut", async () => {
    const lencanaLama = `<div class="aleta-tanda-baris"><span class="aleta-tanda aleta-tanda-abu" data-aleta-tanda="1" title="ALETA: Dibebaskan biaya - tidak boleh ditagih panjar.">prodeo</span></div>`;
    const w = buka(halaman().replace("</body>", `${lencanaLama}</body>`));
    w.aletaSippIdeM2.pasang(w.document);
    expect(w.document.documentElement.getAttribute("data-aleta-lencana")).toBe("rancangan");
    const prodeo = w.document.querySelector('[data-aleta-tanda="1"]');
    expect(prodeo.outerHTML).toBe(lencanaLama.replace('<div class="aleta-tanda-baris">', "").replace("</div>", ""));
    // Beralih ke Tampilan Lama: penanda dicabut, gaya lama berlaku lagi.
    w.alatUjiMode = () => "lama";
    w.aletaSippIdeM2.pasang(w.document);
    expect(w.document.documentElement.hasAttribute("data-aleta-lencana")).toBe(false);
    expect(w.document.querySelector(".aleta-m2")).toBeNull();
    // konten.js tidak diubah: labelTanda tetap menulis kelas yang sama.
    expect(baca("konten.js")).toContain('const span = buatElemen("span", `aleta-tanda aleta-tanda-${warna}`, teks);');
  });
});

describe("E. manifest, penyusun, popup", () => {
  it("dimuat di SIPP sesudah sipp-ide-l1.js, tidak di ABT/portal; penyusun menanamnya; popup punya dua saklarnya", () => {
    const m = JSON.parse(baca("manifest.json")) as { content_scripts: Array<{ js?: string[] }> };
    const sipp = m.content_scripts.find((x) => (x.js || []).includes("konten.js"))!.js!;
    const abt = m.content_scripts.find((x) => (x.js || []).includes("abt.js"))!.js!;
    expect(sipp.indexOf("sipp-ide-m2.js")).toBeGreaterThan(sipp.indexOf("sipp-ide-l1.js"));
    expect(abt).not.toContain("sipp-ide-m2.js");
    const susunEks = readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8");
    expect(susunEks).toContain('"sipp-ide-m2.js",');
    const popup = baca("popup.html");
    expect(popup).toContain('id="sippPenyatu" checked');
    expect(popup).toMatch(/id="sippTampilDobel">/);
  });
});
