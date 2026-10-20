/**
 * 20 Okt 2026 - Cetak relaas (Jadwal Sidang) memakai aturan pihak yang SAMA dengan
 * panel juru sita / pengumuman itsbat: lib/relaas-pihak.ts. Permohonan (Pdt.P)
 * tanpa Termohon TIDAK dipanggil dengan format gugatan ("Pihak Kedua (T)").
 *
 * Data bentuk bot sungguhan (247/Pdt.P/2026/PA.Dgl: itsbat, alur 16, jenis 360,
 * dua Pemohon, e-Court, "keduanya", sebutan bot "Pemohon"/"Termohon").
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { nilaiCetakDokumen } from "@/app/api/aleta-ecourt/relaas-massal/cetak/nilai-cetak";
import {
  pecahDokumenPerPihak,
  permintaanUntukDokumen,
} from "@/app/api/aleta-ecourt/relaas-massal/cetak/pemetaan-cetak";
import { tambahPengumumanItsbat } from "@/lib/pengumuman-itsbat";
import {
  catatanPihakRelaas,
  kunciKhususSisiRelaas,
  labelPihakRelaas,
  labelPilihanPihakRelaas,
  pilihanPihakRelaas,
  selaraskanPihakRelaas,
  strukturPihakRelaas,
} from "@/lib/relaas-pihak";
import { bawaanPemetaan } from "@/lib/pemetaan-blangko";

const keadaan = vi.hoisted(() => ({ gateway: null as null | (() => unknown) }));
vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => ({ name: "Penguji", roleId: "jurusita" }) }));
vi.mock("@/server/modules/akses/hak-peran", async (asli) => {
  const mod = await asli<typeof import("@/server/modules/akses/hak-peran")>();
  return { ...mod, pastikanAksiAktor: () => undefined };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => {
  const mod = await asli<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>();
  return {
    ...mod,
    getGatewayRelaasCetak: async () => (keadaan.gateway ? keadaan.gateway() : { ok: false, error: "belum disiapkan" }),
  };
});

const PETA = {
  relaas: Object.fromEntries(bawaanPemetaan("relaas").map((b) => [b.kunci, b.namaBerkas])),
  pbt: Object.fromEntries(bawaanPemetaan("pbt").map((b) => [b.kunci, b.namaBerkas])),
};

type Bot = Record<string, any>;
function bot(x: Bot): any {
  const golongan = String(x.golongan || "sidang-pertama");
  return {
    kunci: `${golongan}:${x.perkaraId}:${x.d ?? 0}:${x.pihakKe ?? 0}`,
    nomorPerkara: `${x.perkaraId}/Pdt.P/2026/PA.Dgl`,
    jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah",
    alurPerkaraId: 16,
    jenisPerkaraId: 360,
    golongan,
    sebabMasuk: "didaftarkan",
    d: 1,
    sidangId: null,
    tanggalSidangTujuan: "2026-10-28",
    sidangAsalId: null,
    dihadiriOleh: null,
    pihakDipanggil: "keduanya",
    pihakKe: null,
    jurusita: { nama: "Juru Sita Uji", nip: "", dariPenunjukan: true },
    sudahAdaRelaas: false,
    prosesTerakhirId: 81,
    lewatEcourt: true,
    verstekPutusan: false,
    jumlahPihak: { pertama: 2, kedua: 0, lain: 0 },
    sebutanPihak: { pertama: "Pemohon", kedua: "Termohon" },
    ...x,
  };
}

/** Yang dilakukan dialog Cetak relaas: selaraskan lalu pecah per pihak, lalu nilai tiap baris. */
function barisDialog(mentah: any) {
  return [mentah]
    .map(selaraskanPihakRelaas)
    .flatMap((d) => pecahDokumenPerPihak(d, PETA.relaas, PETA.pbt))
    .map((d) => {
      const n = nilaiCetakDokumen(d, null, PETA);
      return { dok: d, nilai: n, pihak: labelPihakRelaas(n.pihak, d, d.golongan === "pemberitahuan-putusan") };
    });
}

const terlarang = /\(T\)|Termohon|Pihak Kedua/;

describe("Pdt.P dua Pemohon tanpa Termohon (247/Pdt.P - itsbat)", () => {
  it("dua baris Pemohon I dan Pemohon II; tidak ada 'Pihak Kedua (T)' maupun Termohon", () => {
    const baris = barisDialog(bot({ perkaraId: 10253 }));
    expect(baris.map((b) => b.dok.pihakDipanggil)).toEqual(["pertama", "kedua"]);
    expect(baris.map((b) => b.pihak)).toEqual(["Pemohon I", "Pemohon II"]);
    for (const b of baris) {
      expect(b.pihak).not.toMatch(terlarang);
      expect(b.nilai.bisaDicetak).toBe(true);
      expect(b.dok.sebutanPihak).toEqual({ pertama: "Pemohon I", kedua: "Pemohon II" });
    }
    // Pemohon I memakai blangko P, Pemohon II blangko pihak kedua (#7109# = Pemohon II pada alur 16) - e-Court 5.1 / 5.2.
    expect(baris[0].nilai.blangko?.berkas).toMatch(/5\.1/);
    expect(baris[1].nilai.blangko?.berkas).toMatch(/5\.2/);
  });

  it("kunci blangko sisi kedua tetap 'termohon' (blangko T) walau sebutannya Pemohon II", () => {
    const d = selaraskanPihakRelaas(bot({ perkaraId: 1 }));
    expect(kunciKhususSisiRelaas(d, "pertama")).toBe("pemohon");
    expect(kunciKhususSisiRelaas(d, "kedua")).toBe("termohon");
    const minta = permintaanUntukDokumen({ ...d, pihakDipanggil: "kedua" });
    expect(minta?.khusus).toBe("termohon");
  });

  it("pilihan juru sita menyebut Pemohon I / Pemohon II, bukan P / T", () => {
    const d = selaraskanPihakRelaas(bot({ perkaraId: 1, pihakDipanggil: "tidak-diketahui" }));
    expect(pilihanPihakRelaas(d)).toEqual(["pertama", "kedua", "keduanya"]);
    expect(pilihanPihakRelaas(d).map((p) => labelPilihanPihakRelaas(p, d))).toEqual([
      "Pemohon I saja",
      "Pemohon II saja",
      "Pemohon I dan Pemohon II",
    ]);
  });
});

describe("Pdt.P satu Pemohon tanpa Termohon", () => {
  it("keduanya menjadi pertama: satu baris 'Pemohon', blangko P, tanpa blangko T", () => {
    const baris = barisDialog(bot({ perkaraId: 2, jenisPerkaraId: 345, jenisPerkara: "Dispensasi Kawin", jumlahPihak: { pertama: 1, kedua: 0, lain: 0 } }));
    expect(baris).toHaveLength(1);
    expect(baris[0].dok.pihakDipanggil).toBe("pertama");
    expect(baris[0].pihak).toBe("Pemohon");
    expect(baris[0].nilai.blangko?.berkas).toMatch(/5\.1/);
    expect(baris[0].dok.keterangan?.join(" ")).toMatch(/tanpa Termohon/);
  });

  it("pihak kedua tidak ditawarkan; 'kedua' dari bot dikembalikan ke pilihan juru sita; idempoten", () => {
    const mentah = bot({ perkaraId: 3, pihakDipanggil: "kedua", jumlahPihak: { pertama: 1, kedua: 0, lain: 0 } });
    const d = selaraskanPihakRelaas(mentah);
    expect(d.pihakDipanggil).toBe("tidak-diketahui");
    expect(pilihanPihakRelaas(d)).toEqual(["pertama"]);
    expect(selaraskanPihakRelaas(d)).toEqual(d);
    // Dipaksa lewat penilaian pun ditolak.
    const n = nilaiCetakDokumen({ ...d, pihakDipanggil: "tidak-diketahui" }, "kedua", PETA);
    expect(n.bisaDicetak).toBe(false);
    expect(n.sebabTidakBisa).toMatch(/tidak punya Termohon/);
  });
});

describe("Pdt.P kontensius dengan Termohon", () => {
  it("tetap dua pihak: Pemohon dan Termohon, blangko T", () => {
    const baris = barisDialog(
      bot({ perkaraId: 4, jenisPerkaraId: 343, jenisPerkara: "Wali Adhol", jumlahPihak: { pertama: 1, kedua: 1, lain: 0 } })
    );
    expect(baris.map((b) => b.pihak)).toEqual(["Pemohon", "Termohon"]);
    expect(baris.map((b) => b.dok.pihakDipanggil)).toEqual(["pertama", "kedua"]);
    expect(baris[1].nilai.blangko?.berkas).toMatch(/5\.2/);
    expect(strukturPihakRelaas(baris[0].dok).kedua).toBe("lawan");
  });
});

describe("Pdt.G biasa - tidak berubah", () => {
  const g = bot({
    perkaraId: 10250,
    nomorPerkara: "679/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 15,
    jenisPerkaraId: 347,
    jumlahPihak: { pertama: 1, kedua: 1, lain: 0 },
    sebutanPihak: { pertama: "Penggugat", kedua: "Tergugat" },
  });
  it("dua baris Penggugat/Tergugat dengan kalimat lama; dokumen tidak diubah selain sebutan", () => {
    const d = selaraskanPihakRelaas(g);
    expect(d.pihakDipanggil).toBe("keduanya");
    expect(d.keterangan).toBeUndefined();
    const baris = barisDialog(g);
    expect(baris.map((b) => b.dok.pihakDipanggil)).toEqual(["pertama", "kedua"]);
    expect(baris.map((b) => b.pihak)).toEqual(["Pihak Pertama (P)", "Pihak Kedua (T)"]);
    expect(labelPihakRelaas("keduanya", d, false)).toBe("Kedua pihak");
  });
  it("bot lama tanpa jumlahPihak: tidak diubah sama sekali", () => {
    const lama = { ...g };
    delete lama.jumlahPihak;
    expect(selaraskanPihakRelaas(lama)).toBe(lama);
  });
});

describe("Itsbat dengan pengumuman", () => {
  it("dua Pemohon: panggilan keduanya + SATU pengumuman 2 Pemohon; satu Pemohon: pertama + pengumuman 1 Pemohon", () => {
    const hasil = tambahPengumumanItsbat([bot({ perkaraId: 10 }), bot({ perkaraId: 11, jumlahPihak: { pertama: 1, kedua: 0, lain: 0 } })]);
    expect(hasil.map((x: any) => `${x.perkaraId}|${x.golongan}|${x.pihakDipanggil}`)).toEqual([
      "10|sidang-pertama|keduanya",
      "10|pengumuman-itsbat|keduanya",
      "11|sidang-pertama|pertama",
      "11|pengumuman-itsbat|pertama",
    ]);
    // Keterangan itsbat satu Pemohon tetap kalimat 14 Okt, tanpa penggandaan.
    expect(hasil[2].keterangan).toEqual(["Itsbat nikah dengan satu Pemohon - hanya Pemohon yang dipanggil."]);
  });
});

describe("Pemberitahuan putusan", () => {
  it("permohonan satu Pemohon: hanya pihak pertama; dua Pemohon: Pemohon I dan II", () => {
    const satu = barisDialog(bot({ perkaraId: 20, golongan: "pemberitahuan-putusan", d: 0, jumlahPihak: { pertama: 1, kedua: 0, lain: 0 } }));
    expect(satu).toHaveLength(1);
    expect(satu[0].pihak).toBe("Pemohon");
    expect(satu[0].nilai.blangko?.berkas).toMatch(/Pemberitahuan Putusan/);
    expect(satu[0].nilai.blangko?.berkas).not.toMatch(/ T[ .]/);
    const dua = barisDialog(bot({ perkaraId: 21, golongan: "pemberitahuan-putusan", d: 0 }));
    expect(dua.map((b) => b.pihak)).toEqual(["Pemohon I", "Pemohon II"]);
  });
});

describe("peringatan dan catatan daftar", () => {
  it("catatan bot 'tidak punya pihak kedua' diganti hitungan dari aturan yang sama", () => {
    const catatan = catatanPihakRelaas(
      [
        bot({ perkaraId: 1 }),
        bot({ perkaraId: 2 }),
        bot({ perkaraId: 3, jumlahPihak: { pertama: 1, kedua: 0, lain: 0 } }),
        bot({ perkaraId: 4, alurPerkaraId: 15, jumlahPihak: { pertama: 1, kedua: 1, lain: 0 } }),
      ],
      ['3 dokumen "keduanya" perkaranya tidak punya pihak kedua (permohonan voluntair) - yang sesungguhnya dipanggil hanya pihak pertama.', "catatan lain"]
    );
    expect(catatan[0]).toBe("catatan lain");
    expect(catatan.join("\n")).not.toMatch(/tidak punya pihak kedua/);
    expect(catatan.join("\n")).toMatch(/1 dokumen "keduanya" perkaranya permohonan tanpa Termohon dan hanya satu Pemohon/);
    expect(catatan.join("\n")).toMatch(/2 dokumen permohonan tanpa Termohon dengan dua Pemohon/);
  });

  it("peringatan jumlah pihak memakai sebutan yang sudah diselaraskan (Pemohon I, bukan Termohon)", () => {
    const d = selaraskanPihakRelaas(bot({ perkaraId: 5, jumlahPihak: { pertama: 3, kedua: 0, lain: 0 } }));
    const n = nilaiCetakDokumen(d, null, PETA);
    const teks = n.peringatan.map((p) => p.teks).join(" ");
    expect(teks).not.toMatch(/Termohon/);
  });
});

describe("rute GET relaas-massal/cetak memakai fungsi yang sama dengan dialog", () => {
  it("keluaran rute: sebutan Pemohon I/II, satu Pemohon menjadi pertama, catatan bot digantikan", async () => {
    keadaan.gateway = () => ({
      ok: true,
      data: {
        tanggal: "2026-10-19",
        dokumen: [bot({ perkaraId: 10253 }), bot({ perkaraId: 10260, jumlahPihak: { pertama: 1, kedua: 0, lain: 0 }, jenisPerkaraId: 345 })],
        tidakPerlu: [],
        tertunda: [],
        ringkas: { dokumen: 2, perGolongan: {}, perJurusita: {}, tidakPerlu: 0, tertunda: 0, sudahAdaRelaas: 0 },
        catatan: ['2 dokumen "keduanya" perkaranya tidak punya pihak kedua (permohonan voluntair) - yang sesungguhnya dipanggil hanya pihak pertama.'],
      },
    });
    const mod = await import("@/app/api/aleta-ecourt/relaas-massal/cetak/route");
    const r = await mod.GET({ nextUrl: new URL("http://uji.local/api/aleta-ecourt/relaas-massal/cetak?tanggal=2026-10-19") } as any);
    const isi = (await r.json()) as any;
    const data = isi.data ?? isi;
    const sidang = data.dokumen.filter((d: any) => d.golongan === "sidang-pertama");
    expect(sidang.map((d: any) => `${d.perkaraId}|${d.pihakDipanggil}|${d.sebutanPihak.pertama}|${d.sebutanPihak.kedua}`)).toEqual([
      "10253|keduanya|Pemohon I|Pemohon II",
      "10260|pertama|Pemohon|",
    ]);
    expect(data.catatan.join(" ")).not.toMatch(/tidak punya pihak kedua/);
    expect(data.catatan.join(" ")).toMatch(/dipanggil Pemohon I dan Pemohon II/);
  });

  it("satu fungsi: rute, penilaian, pemilih kunci, pengumuman, dan dialog mengimpor lib/relaas-pihak", () => {
    const akar = path.resolve(__dirname, "..");
    const baca = (rel: string) => readFileSync(path.join(akar, rel), "utf8");
    for (const rel of [
      "app/api/aleta-ecourt/relaas-massal/cetak/route.ts",
      "app/api/aleta-ecourt/relaas-massal/cetak/nilai-cetak.ts",
      "app/api/aleta-ecourt/relaas-massal/cetak/pemetaan-cetak.ts",
      "lib/pengumuman-itsbat.ts",
      "components/portal/aleta-ecourt-cetak-relaas.tsx",
    ]) {
      expect(baca(rel), rel).toMatch(/@\/lib\/relaas-pihak/);
    }
    // Dialog tidak lagi menulis "Pihak Kedua (T)" sendiri.
    expect(baca("components/portal/aleta-ecourt-cetak-relaas.tsx")).not.toMatch(/Pihak Kedua \(T\)/);
    // Sebutan sama dengan panel juru sita ekstensi (jurusitaSebutanItsbat).
    const ekstensi = readFileSync(path.resolve(akar, "../../ekstensi-sipp/jurusita.js"), "utf8");
    // (kesamaan keluarannya dijaga cetak-relaas-sinkron-ekstensi-20okt.test.ts).
    expect(ekstensi).toMatch(/function jurusitaStrukturPihak/);
  });
});
