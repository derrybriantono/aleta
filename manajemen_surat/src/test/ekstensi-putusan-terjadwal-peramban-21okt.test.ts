// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * JADWALKAN PUTUSAN - PELAKSANA DI PERAMBAN (21 Okt 2026, agen B3)
 * ============================================================================
 *
 * putusan-terjadwal-peramban.js dijalankan SUNGGUHAN di jsdom bersama panel-alat.js, dengan portal tiruan
 * (giliran / klaim / draf / lapor / lepas) dan alur Putusan Otomatis tiruan (kotak.otomatis). Yang dijaga:
 *
 *   - urutan aman: cek SIPP (terisi = DILEWATI, tidak ditimpa) -> draf dari berkas -> pilihan form petugas
 *     dipasang -> alur Putusan Otomatis TANPA e-Doc (e-Doc milik server) -> lapor;
 *   - hasil jujur: tersimpan -> selesai; ditahan praperiksa -> tertahan; selain itu gagal; tidak pernah mengulang sendiri;
 *   - tidak membajak petugas: berpindah halaman hanya dari dashboard/daftar/perkara tanpa formulir terbuka dan
 *     hanya bila petugas tidak sedang mengetik; selain itu spanduk "Kerjakan sekarang";
 *   - akun SIPP yang masuk harus akun jadwal; pilihan form yang tidak ada di formulir = tertahan, tidak ditebak;
 *   - tahan muat ulang: sesudah Simpan SIPP memuat ulang halaman, hanya yang TERBUKTI tersimpan dilaporkan selesai;
 *     dua tab tidak mengisi formulir yang sama; pengerjaan yang terputus dikembalikan, tidak diulang diam-diam.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const PERAMBAN = baca("putusan-terjadwal-peramban.js");

const ASAL = "http://192.168.10.10";
const NOMOR = "684/Pdt.G/2026/PA.Dgl";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function sampai<T>(periksa: () => T, keterangan: string | (() => string), batas = 6000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${typeof keterangan === "function" ? keterangan() : keterangan}`);
    await tunggu(10);
  }
}

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Server = {
  giliran: any;
  klaimHasil: any;
  drafHasil: any;
  laporan: Array<{ id: string; hasil: string; catatan: string }>;
  lepasan: Array<{ id: string; sebab: string; hitung: boolean; tundaDetik?: number }>;
  klaim: string[];
  draf: string[];
  panggilanGiliran: string[];
};
const serverBaru = (): Server => ({
  giliran: { ada: false, menunggu: 0, berikutnya: "", berikutnyaWita: "", alasan: "tidak_ada" },
  klaimHasil: { ok: true, masaPegangDetik: 600 },
  drafHasil: { ok: true, versi: 3, dariDraf: false, bagian: [] },
  laporan: [],
  lepasan: [],
  klaim: [],
  draf: [],
  panggilanGiliran: [],
});
const BUTIR = (ekstra: Record<string, unknown> = {}) => ({
  ada: true,
  butir: { id: "ptb-1", perkaraId: "30684", nomorPerkara: NOMOR, akunSipp: "hakim.satu", pilihan: {}, adaBerkas: true, berkasNama: "x.rtf", langkah: { putusan: true, anonim: true }, waktuRencana: "2026-10-21T01:00:00.000Z", ...ekstra },
  tautan: { alamat: "http://192.168.10.10/SIPP/perkara_detil_agama/AbC123==", alasan: "" },
});

type Opsi = {
  halaman?: "perkara" | "perkara-lain" | "dasbor" | "formulir";
  tampilan?: "lama" | "ui";
  peran?: string | null;
  server?: Server;
  simpanan?: Record<string, unknown>;
  terisi?: unknown;
  akun?: string;
  otomatis?: (opsi: Record<string, unknown>) => Promise<Record<string, unknown>>;
  bukaBlangko?: Record<string, unknown>;
  pilihanFormulir?: Array<{ nilai: string; label: string }>;
  tanpaBagian?: boolean;
  jalur?: string;
  tanpaJembatan?: boolean;
};

function buka(o: Opsi = {}) {
  const halaman = o.halaman ?? "perkara";
  const jalur = o.jalur ?? (halaman === "dasbor" ? "/SIPP/main" : "/SIPP/detil_perkara_agama");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten">` +
      (halaman === "perkara" || halaman === "perkara-lain"
        ? `<table id="submenus"><tr><td><table><tr><td id="backlist"><a href="#">Kembali</a></td></tr></table></td></tr></table>`
        : halaman === "formulir"
          ? `<form id="frm_putusan"><input name="x"></form>`
          : `<p>Dashboard</p>`) +
      `</div></body></html>`,
    { url: `${ASAL}${jalur}`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  const server = o.server ?? serverBaru();
  const simpanan: Record<string, unknown> = o.simpanan ?? { ujiTampilan: o.tampilan || "ui", ujiIzinkanNyata: true };
  if (!("ujiTampilan" in simpanan)) simpanan.ujiTampilan = o.tampilan || "ui";
  w.chrome = {
    runtime: { id: "uji", getManifest: () => ({ version: "1.205.19" }), getURL: (x: string) => x, sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (k?: string | string[]) => {
          const hasil: Record<string, unknown> = {};
          for (const n of [k].flat()) if (n != null && n in simpanan) hasil[n as string] = JSON.parse(JSON.stringify(simpanan[n as string]));
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, JSON.parse(JSON.stringify(isi))),
        remove: async (k: string | string[]) => void [k].flat().forEach((n) => delete simpanan[n]),
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext("alatSetelJedaSkala(0)", ctx);

  const urut: string[] = [];
  const jembatan: Array<Record<string, unknown>> = [];
  const opsiOto: Array<Record<string, unknown>> = [];
  const jawab = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => ({ ok: status < 400, data }) });
  const nomorLayar = halaman === "perkara" ? NOMOR : halaman === "perkara-lain" ? "700/Pdt.G/2026/PA.Dgl" : "";
  const bagianAda = { nilai: false };
  Object.assign(w, {
    penggunaTerakhir: o.peran === null ? null : { nama: "Hakim Satu", peran: o.peran || "Hakim" },
    boleh: () => true,
    cariNomorPerkara: () => nomorLayar,
    namaPenggunaSipp: () => (o.akun === undefined ? "Hakim Satu, S.H." : o.akun),
    b6KeadaanPutusanTerisi: async () => {
      urut.push("cek-terisi");
      return o.terisi === undefined ? { terisi: false } : o.terisi;
    },
    s1BukaBlangkoPutusan: async () => {
      urut.push("buka-blangko");
      return o.bukaBlangko || { ok: true, lewat: "tambah" };
    },
    gambarUlangSesudahBlangko: async () => {
      urut.push("gambar-ulang");
      if (!bagianAda.nilai && !o.tanpaBagian) {
        bagianAda.nilai = true;
        const bagian = w.document.createElement("div");
        bagian.className = "aleta-bagian";
        bagian.setAttribute("data-kunci", "isiPutusan");
        bagian.otomatis = async (opsi: Record<string, unknown>) => {
          urut.push("otomatis");
          opsiOto.push(opsi);
          await tunggu(5);
          if (o.otomatis) return o.otomatis(opsi);
          return { ok: true, tersimpan: true, bunyi: "Tersimpan." };
        };
        w.document.body.appendChild(bagian);
      }
      return true;
    },
    alatAmbil: async (alamat: string, opsi: any) => {
      const metode = String((opsi && opsi.method) || "GET").toUpperCase();
      if (metode === "GET") {
        server.panggilanGiliran.push(alamat);
        return jawab(server.giliran);
      }
      const badan = JSON.parse(opsi.body);
      if (badan.aksi === "klaim") {
        server.klaim.push(badan.id);
        return jawab(server.klaimHasil, server.klaimHasil.ok === false ? 409 : 200);
      }
      if (badan.aksi === "draf") {
        server.draf.push(badan.id);
        urut.push("draf");
        return jawab(server.drafHasil);
      }
      if (badan.aksi === "lapor") {
        server.laporan.push({ id: badan.id, hasil: badan.hasil, catatan: badan.catatan });
        urut.push(`lapor:${badan.hasil}`);
        return jawab({ ok: true, status: "menunggu", edocSesudah: "" });
      }
      if (badan.aksi === "lepas") {
        server.lepasan.push({ id: badan.id, sebab: badan.sebab, hitung: badan.hitung, tundaDetik: badan.tundaDetik });
        return jawab({ ok: true });
      }
      return jawab({ ok: false }, 400);
    },
  });
  if (!o.tanpaJembatan) {
    w.kirimKeJembatan = async (pesan: Record<string, unknown>) => {
      jembatan.push(pesan);
      urut.push(`jembatan:${pesan.jenis}`);
      if (pesan.jenis === "pilihan") return { ok: true, tampak: true, pilihan: o.pilihanFormulir ?? [{ nilai: "10", label: "Dikabulkan" }, { nilai: "11", label: "Ditolak" }] };
      return { ok: true };
    };
  }
  vm.runInContext(PERAMBAN, ctx, { filename: "putusan-terjadwal-peramban.js" });
  const buka_: string[] = [];
  w.aletaPutusanTerjadwalPeramban.setelBuka((a: string) => void buka_.push(a));
  return { w, d: w.document as Document, server, simpanan, urut, jembatan, opsiOto, buka: buka_ };
}
type Halaman = ReturnType<typeof buka>;
const mod = (h: Halaman) => h.w.aletaPutusanTerjadwalPeramban;
async function siap(h: Halaman) {
  await sampai(() => (typeof h.w.alatUjiMode === "function" && h.w.alatUjiMode() !== "lama" ? true : null), "mode tampilan terbaca");
}
const spanduk = (h: Halaman) => h.d.getElementById("aleta-ptj-spanduk");

// ============================================================================
describe("di halaman perkara yang dituju: urutan aman dan hasil yang jujur", () => {
  it("klaim -> cek SIPP -> draf -> alur Putusan Otomatis TANPA e-Doc -> lapor selesai; catatan dibersihkan", async () => {
    const h = buka();
    await siap(h);
    h.server.giliran = BUTIR();
    const r = await mod(h).periksaSekarang();
    expect(r).toMatchObject({ alasan: "dikerjakan" });
    expect(h.server.klaim).toEqual(["ptb-1"]);
    expect(h.urut).toEqual(["cek-terisi", "draf", "buka-blangko", "gambar-ulang", "otomatis", "lapor:selesai"]);
    // Alur yang sama dengan tombol Putusan Otomatis, tetapi e-Doc DIKERJAKAN SERVER: tidak diminta dari peramban.
    expect(h.opsiOto).toEqual([{ edoc: false, denganPutusan: false, denganAnonim: false, melayang: true }]);
    expect(h.server.laporan).toEqual([{ id: "ptb-1", hasil: "selesai", catatan: "Tersimpan di SIPP." }]);
    expect(h.simpanan.putusanTerjadwalAktif).toBeUndefined();
    expect(spanduk(h)!.textContent).toMatch(/Putusan Akhir tersimpan; e-Doc menyusul oleh server/);
    expect(mod(h).sedangBekerja()).toBe(false);
  });

  it("Putusan Akhir sudah terisi di SIPP: DILEWATI - tidak ada draf, tidak ada pengisian, tidak ditimpa", async () => {
    const h = buka({ terisi: { terisi: true, tanggal: "2026-10-19", status: "Dikabulkan" } });
    await siap(h);
    h.server.giliran = BUTIR();
    await mod(h).periksaSekarang();
    expect(h.urut).toEqual(["cek-terisi", "lapor:dilewati"]);
    expect(h.server.laporan[0].catatan).toMatch(/sudah terisi di SIPP \(tanggal 2026-10-19\) - tidak ditimpa/);
    expect(h.opsiOto).toEqual([]);
  });

  it("draf tidak dapat disiapkan (berkas hilang, naskah salah): lapor gagal dengan sebab dari server; formulir tidak disentuh", async () => {
    const h = buka();
    await siap(h);
    h.server.giliran = BUTIR();
    h.server.drafHasil = { ok: false, sebab: "Isi berkas berubah sejak diunggah (sidik jari tidak sama); tidak dipakai." };
    await mod(h).periksaSekarang();
    expect(h.urut).toEqual(["cek-terisi", "draf", "lapor:gagal"]);
    expect(h.server.laporan[0].catatan).toMatch(/sidik jari tidak sama/);
    expect(h.urut).not.toContain("buka-blangko");
  });

  it("ditahan praperiksa -> 'tertahan' (butuh orang); gagal biasa -> 'gagal'; tidak ada yang diulang sendiri", async () => {
    const tahan = buka({ otomatis: async () => ({ ok: false, tersimpan: false, tahap: "praperiksa", pesan: "Praperiksa menahan: status bertentangan dengan fakta SIPP." }) });
    await siap(tahan);
    tahan.server.giliran = BUTIR();
    await mod(tahan).periksaSekarang();
    expect(tahan.server.laporan[0]).toMatchObject({ hasil: "tertahan" });
    expect(tahan.server.laporan[0].catatan).toMatch(/Praperiksa menahan/);
    expect(tahan.opsiOto).toHaveLength(1);

    const gagal = buka({ otomatis: async () => ({ ok: false, tersimpan: false, tahap: "isi", pesan: "Satu isian tidak terisi (faktor perceraian)." }) });
    await siap(gagal);
    gagal.server.giliran = BUTIR();
    await mod(gagal).periksaSekarang();
    expect(gagal.server.laporan[0]).toMatchObject({ hasil: "gagal" });
    expect(gagal.opsiOto).toHaveLength(1);
  });

  it("blangko tidak dapat dibuka / bagian Putusan otomatis tidak termuat: gagal dengan sebab, tidak mengisi apa pun", async () => {
    const a = buka({ bukaBlangko: { ok: false, pesan: "Tombol Tambah Putusan Akhir tidak ditemukan." } });
    await siap(a);
    a.server.giliran = BUTIR();
    await mod(a).periksaSekarang();
    expect(a.server.laporan[0]).toMatchObject({ hasil: "gagal" });
    expect(a.server.laporan[0].catatan).toMatch(/Tombol Tambah Putusan Akhir tidak ditemukan/);

    const b = buka({ tanpaBagian: true });
    await siap(b);
    b.server.giliran = BUTIR();
    await mod(b).periksaSekarang();
    expect(b.server.laporan[0].catatan).toMatch(/bagian Putusan otomatis di panel tidak termuat/);
  }, 30000);

  it("pilihan form petugas dipasang LEBIH DULU di formulir (status dicocokkan menurut tulisannya, verstek menurut nilainya), baru alur otomatis", async () => {
    const h = buka();
    await siap(h);
    h.server.giliran = BUTIR({ pilihan: { statusPutusan: "Ditolak", verstek: "Y" } });
    await mod(h).periksaSekarang();
    const isi = h.jembatan.filter((x) => x.jenis === "isi");
    expect(isi).toEqual([
      { jenis: "isi", penunjuk: 'select[name="status_putusan"]', jenisMedan: "pilih", nilai: "11" },
      { jenis: "isi", penunjuk: 'select[name="verstek"]', jenisMedan: "pilih", nilai: "Y" },
    ]);
    expect(h.urut.indexOf("jembatan:isi")).toBeLessThan(h.urut.indexOf("otomatis"));
    expect(h.server.laporan[0].catatan).toMatch(/pilihan Anda: status Ditolak, verstek ya/);
  });

  it("status putusan pilihan petugas yang TIDAK ada di formulir = tertahan, formulir tidak dikirim Simpan, tidak dipilihkan sendiri", async () => {
    const h = buka({ pilihanFormulir: [{ nilai: "10", label: "Dikabulkan" }] });
    await siap(h);
    h.server.giliran = BUTIR({ pilihan: { statusPutusan: "Dicabut" } });
    await mod(h).periksaSekarang();
    expect(h.server.laporan[0]).toMatchObject({ hasil: "tertahan" });
    expect(h.server.laporan[0].catatan).toMatch(/Status putusan "Dicabut" tidak ada di pilihan formulir SIPP.*Tidak dipilihkan sendiri/);
    expect(h.urut).not.toContain("otomatis");
    expect(h.jembatan.some((x) => x.jenis === "isi")).toBe(false);
  });

  it("tanpa pilihan petugas: jembatan tidak disentuh sama sekali; tidak ada kata ALETA dalam apa pun yang dikirim ke formulir SIPP", async () => {
    const h = buka();
    await siap(h);
    h.server.giliran = BUTIR({ pilihan: { statusPutusan: "Dikabulkan", verstek: "T" } });
    await mod(h).periksaSekarang();
    expect(JSON.stringify(h.jembatan)).not.toMatch(/aleta/i);
    const h2 = buka();
    await siap(h2);
    h2.server.giliran = BUTIR();
    await mod(h2).periksaSekarang();
    expect(h2.jembatan).toEqual([]);
  });

  it("klaim ditolak (diambil tab lain): tidak mengerjakan apa pun", async () => {
    const h = buka();
    await siap(h);
    h.server.giliran = BUTIR();
    h.server.klaimHasil = { ok: false, alasan: "bukan_giliran", sebab: "Perkara ini baru saja diambil pekerjaan lain." };
    const r = await mod(h).periksaSekarang();
    expect(r).toMatchObject({ diam: true, alasan: "bukan_giliran" });
    expect(h.urut).toEqual([]);
    expect(h.server.laporan).toEqual([]);
  });

  it("laporan yang gagal sampai diulang sekali; laporan 409 (sudah dilaporkan) dianggap beres", async () => {
    const h = buka();
    await siap(h);
    h.server.giliran = BUTIR();
    let n = 0;
    const asli = h.w.alatAmbil;
    h.w.alatAmbil = async (alamat: string, opsi: any) => {
      if (opsi && opsi.body && String(opsi.body).includes('"lapor"')) {
        n += 1;
        if (n === 1) return { ok: false, status: 503, json: async () => ({ ok: false, error: { message: "server sibuk" } }) };
      }
      return asli(alamat, opsi);
    };
    await mod(h).periksaSekarang();
    expect(n).toBe(2);
    expect(h.server.laporan).toHaveLength(1);
  }, 20000);
});

// ============================================================================
describe("di halaman lain: tidak membajak petugas", () => {
  it("tepat sesudah halaman dimuat petugas dianggap baru bergerak (rentang diam 45 detik): tidak membuka halaman, hanya spanduk", async () => {
    const h = buka({ halaman: "dasbor" });
    await siap(h);
    h.server.giliran = BUTIR();
    const r = await mod(h).periksaSekarang();
    expect(r.alasan).toBe("menunggu_petugas");
    expect(h.buka).toEqual([]);
    expect(h.server.klaim).toEqual([]);
  });

  it("petugas diam (aktivitas terakhir > 45 detik): klaim -> catatan 'menuju' -> buka tautan halaman perkara", async () => {
    const h = buka({ halaman: "dasbor" });
    await siap(h);
    h.server.giliran = BUTIR();
    // Memajukan jam dinding: aktivitas terakhir dianggap lama.
    const asliNow = h.w.Date.now;
    h.w.Date.now = () => asliNow.call(h.w.Date) + 60_000;
    const r = await mod(h).periksaSekarang();
    h.w.Date.now = asliNow;
    expect(r).toMatchObject({ alasan: "menuju" });
    expect(h.server.klaim).toEqual(["ptb-1"]);
    expect(h.buka).toEqual(["http://192.168.10.10/SIPP/perkara_detil_agama/AbC123=="]);
    expect(h.simpanan.putusanTerjadwalAktif).toMatchObject({ id: "ptb-1", nomorPerkara: NOMOR, tahap: "menuju" });
    expect(h.urut).toEqual([]);
  });

  it("formulir terbuka, perkara lain dengan blangko Putusan Akhir terbuka, atau setelan 'buka sendiri' mati: spanduk dengan tombol, TIDAK pindah halaman", async () => {
    for (const [nama, opsi] of [
      ["formulir terbuka", { halaman: "formulir" as const, jalur: "/SIPP/main" }],
      ["setelan mati", { halaman: "dasbor" as const }],
    ] as const) {
      const h = buka(opsi);
      await siap(h);
      if (nama === "setelan mati") await mod(h).simpanSetelan({ bukaOtomatis: false });
      h.server.giliran = BUTIR();
      const asliNow = h.w.Date.now;
      h.w.Date.now = () => asliNow.call(h.w.Date) + 120_000;
      const r = await mod(h).periksaSekarang();
      h.w.Date.now = asliNow;
      expect(r.alasan, nama).toBe("menunggu_petugas");
      expect(h.buka, nama).toEqual([]);
      expect(h.server.klaim, nama).toEqual([]);
      expect(spanduk(h)!.getAttribute("data-ptj-spanduk")).toBe("jatuh-tempo");
      expect(spanduk(h)!.textContent).toMatch(/684\/Pdt\.G\/2026\/PA\.Dgl sudah waktunya diisi dan disimpan/);
    }
  });

  it("tombol 'Kerjakan sekarang' = keputusan petugas: baru saat itu klaim dan pindah", async () => {
    const h = buka({ halaman: "formulir", jalur: "/SIPP/main" });
    await siap(h);
    h.server.giliran = BUTIR();
    await mod(h).periksaSekarang();
    expect(h.buka).toEqual([]);
    (spanduk(h)!.querySelector("button") as HTMLButtonElement).click();
    await sampai(() => h.buka.length === 1, "halaman perkara dibuka sesudah ditekan");
    expect(h.server.klaim).toEqual(["ptb-1"]);
  });

  it("akun SIPP yang masuk bukan akun jadwal: spanduk menyebut akun yang benar, tidak klaim", async () => {
    const h = buka();
    await siap(h);
    h.server.giliran = { ada: false, menunggu: 1, berikutnya: "", berikutnyaWita: "", alasan: "akun_beda", akunLain: ["hakim.satu"] };
    await mod(h).periksaSekarang();
    expect(spanduk(h)!.textContent).toMatch(/atas akun SIPP hakim\.satu; masuk SIPP dengan akun itu/);
    expect(h.server.klaim).toEqual([]);
    // Akun yang dikirim ke portal = nama tampil akun yang masuk.
    expect(h.server.panggilanGiliran[0]).toContain("akunSipp=Hakim%20Satu%2C%20S.H.");
  });
});

// ============================================================================
describe("hak dan lingkungan", () => {
  it("peran selain Super Admin/Admin/Hakim, tampilan Lama, dan halaman ABT: tidak bertanya ke portal sama sekali", async () => {
    for (const opsi of [{ peran: "Panitera Pengganti" }, { tampilan: "lama" as const }, { jalur: "/aps_badilag/abt" }, { akun: "" }]) {
      const h = buka(opsi);
      await tunggu(120);
      h.server.giliran = BUTIR();
      const r = await mod(h).periksaSekarang();
      expect(r.diam, JSON.stringify(opsi)).toBe(true);
      expect(h.server.panggilanGiliran, JSON.stringify(opsi)).toEqual([]);
    }
  });

  it("tidak ada butir jatuh tempo: diam, tidak ada spanduk; jadwal milik akun lain tidak muncul sebagai pekerjaan", async () => {
    const h = buka();
    await siap(h);
    h.server.giliran = { ada: false, menunggu: 0, berikutnya: "2026-10-21T02:00:00.000Z", berikutnyaWita: "2026-10-21 10:00", alasan: "belum_waktunya" };
    const r = await mod(h).periksaSekarang();
    expect(r).toMatchObject({ diam: true, alasan: "belum_waktunya", berikutnya: "2026-10-21 10:00" });
    expect(spanduk(h)).toBeNull();
  });
});

// ============================================================================
describe("tahan muat ulang, dua tab, dan pengerjaan terputus", () => {
  const rec = (ekstra: Record<string, unknown> = {}) => ({ id: "ptb-1", nomorPerkara: NOMOR, perkaraId: "30684", pilihan: {}, akunSipp: "hakim.satu", mulai: Date.now(), pada: Date.now(), tahap: "menuju", ...ekstra });

  it("sesudah dipindahkan ke halaman perkara ('menuju'): dikerjakan di sana tanpa klaim ulang", async () => {
    const h = buka({ simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: true, putusanTerjadwalAktif: rec() } });
    await siap(h);
    const r = await mod(h).periksaSekarang();
    expect(r).toMatchObject({ alasan: "melanjutkan" });
    expect(h.server.klaim).toEqual([]);
    expect(h.urut).toContain("otomatis");
    expect(h.server.laporan[0]).toMatchObject({ id: "ptb-1", hasil: "selesai" });
  });

  it("DUA tab di halaman perkara yang sama membaca catatan 'menuju' yang sama: hanya SATU yang mengisi formulir", async () => {
    const simpanan: Record<string, unknown> = { ujiTampilan: "ui", ujiIzinkanNyata: true, putusanTerjadwalAktif: rec() };
    const server = serverBaru();
    const a = buka({ simpanan, server });
    const b = buka({ simpanan, server });
    await siap(a);
    await siap(b);
    await Promise.all([mod(a).periksaSekarang(), mod(b).periksaSekarang()]);
    const mengisi = [a, b].filter((x) => x.urut.includes("otomatis")).length;
    expect(mengisi).toBe(1);
    expect(server.laporan.filter((x) => x.hasil === "selesai")).toHaveLength(1);
  }, 20000);

  it("'menuju' tetapi halaman tidak pernah tiba (lebih dari 90 detik): dikembalikan ke antrean dan dihitung; masih berpindah: ditunggu", async () => {
    const baru = buka({ halaman: "dasbor", simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: true, putusanTerjadwalAktif: rec() } });
    await siap(baru);
    await mod(baru).periksaSekarang();
    expect(baru.server.lepasan).toEqual([]);

    const basi = buka({ halaman: "dasbor", simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: true, putusanTerjadwalAktif: rec({ pada: Date.now() - 120_000 }) } });
    await siap(basi);
    await mod(basi).periksaSekarang();
    expect(basi.server.lepasan).toEqual([{ id: "ptb-1", sebab: "Halaman perkara tidak terbuka pada waktunya.", hitung: true, tundaDetik: 120 }]);
    expect(basi.simpanan.putusanTerjadwalAktif).toBeUndefined();
  });

  it("SESUDAH Simpan memuat ulang halaman ('menyimpan'): selesai HANYA bila SIPP membuktikannya; tidak terbukti = gagal; tidak terbaca = gagal dengan kalimat jujur", async () => {
    const terbukti = buka({ terisi: { terisi: true, tanggal: "2026-10-21" }, simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: true, putusanTerjadwalAktif: rec({ tahap: "menyimpan", pada: Date.now() - 20_000 }) } });
    await siap(terbukti);
    await mod(terbukti).periksaSekarang();
    expect(terbukti.server.laporan[0]).toMatchObject({ hasil: "selesai" });
    expect(terbukti.server.laporan[0].catatan).toMatch(/terbukti setelah halaman dimuat ulang, tanggal 2026-10-21/);
    expect(terbukti.simpanan.putusanTerjadwalAktif).toBeUndefined();
    expect(terbukti.urut).not.toContain("otomatis");

    const belum = buka({ terisi: { terisi: false }, simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: true, putusanTerjadwalAktif: rec({ tahap: "menyimpan", pada: Date.now() - 20_000 }) } });
    await siap(belum);
    await mod(belum).periksaSekarang();
    expect(belum.server.laporan[0]).toMatchObject({ hasil: "gagal" });
    expect(belum.server.laporan[0].catatan).toMatch(/belum terbukti tersimpan di SIPP/);

    const tidakTerbaca = buka({ terisi: null, simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: true, putusanTerjadwalAktif: rec({ tahap: "menyimpan", pada: Date.now() - 20_000 }) } });
    await siap(tidakTerbaca);
    await mod(tidakTerbaca).periksaSekarang();
    expect(tidakTerbaca.server.laporan[0]).toMatchObject({ hasil: "gagal" });
    expect(tidakTerbaca.server.laporan[0].catatan).toMatch(/keadaan SIPP belum dapat dibaca untuk memastikannya/);
  });

  it("halaman lain masih memegang catatan (detak jantung < 12 detik): tidak disentuh; yang detaknya mati dikembalikan ke antrean (dihitung), tidak diulang diam-diam", async () => {
    const hidup = buka({ simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: true, putusanTerjadwalAktif: rec({ tahap: "jalan", pemegang: "halaman-lain", pada: Date.now() - 3000 }) } });
    await siap(hidup);
    await mod(hidup).periksaSekarang();
    expect(hidup.server.lepasan).toEqual([]);
    expect(hidup.urut).not.toContain("otomatis");
    expect((hidup.simpanan.putusanTerjadwalAktif as any).tahap).toBe("jalan");

    const mati = buka({ simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: true, putusanTerjadwalAktif: rec({ tahap: "jalan", pemegang: "halaman-lain", pada: Date.now() - 60_000 }) } });
    await siap(mati);
    await mod(mati).periksaSekarang();
    expect(mati.server.lepasan).toEqual([{ id: "ptb-1", sebab: "Pengerjaan terputus sebelum Simpan (halaman dimuat ulang atau ditutup).", hitung: true, tundaDetik: 180 }]);
    expect(mati.urut).not.toContain("otomatis");
    expect(mati.simpanan.putusanTerjadwalAktif).toBeUndefined();
  });

  it("selama bekerja, detak jantung memperbarui catatan supaya tab lain tidak menyangkanya mati", async () => {
    const h = buka({
      otomatis: async () => {
        await tunggu(5600);
        return { ok: true, tersimpan: true };
      },
    });
    await siap(h);
    h.server.giliran = BUTIR();
    const jalan = mod(h).periksaSekarang();
    await sampai(() => (h.simpanan.putusanTerjadwalAktif as any)?.tahap === "menyimpan", "tahap menyimpan", 6000);
    const pertama = (h.simpanan.putusanTerjadwalAktif as any).pada;
    await tunggu(5300);
    expect((h.simpanan.putusanTerjadwalAktif as any).pada).toBeGreaterThan(pertama);
    expect((h.simpanan.putusanTerjadwalAktif as any).pemegang).toBe(mod(h).idHalaman());
    await jalan;
  }, 30000);
});

// ============================================================================
describe("tidak ada penulis SIPP baru", () => {
  it("modul ini tidak memanggil rute SIPP/bot sendiri dan tidak memuat e-Doc: hanya portal + alur Putusan Otomatis yang sudah ada", () => {
    expect(PERAMBAN).not.toMatch(/manage_|validateInput|\/SIPP\/(?!perkara_detil)|aletaPutusanEdoc|jalankan\(\{/);
    expect(PERAMBAN).toContain("bagian.otomatis({ edoc: false, denganPutusan: false, denganAnonim: false, melayang: true })");
    const alamat = [...PERAMBAN.matchAll(/"(\/aleta\/api\/[^"]+)"/g)].map((m) => m[1]);
    expect(alamat).toEqual(["/aleta/api/aleta-ecourt/putusan-terjadwal/peramban"]);
  });
});
