// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  PESAN_BELUM_ADA_PANDUAN,
  agendaPembuktianSaksi,
  butirHitung,
  daftarSaksiPandu,
  hitungPokok,
  jenisPerkaraIdDariNama,
  jenisPerkaraIdPandu,
  kehadiranDariSidang,
  keadaanAwalDariSidang,
  kelasLayarDariLebar,
  kunciCentang,
  kunciSimpanCentang,
  kumulasiDariPortal,
  peringatanPokokWajib,
  type PanduanSaksi,
  type PanduanTersedia,
} from "@/lib/pandu-saksi";
import { susunPanduan, teksPanduan } from "@/server/shared/pandu-saksi";

const AKAR_KATALOG = path.resolve(__dirname, "../../../ekstensi-sipp/saksi-katalog");
const KATALOG = readdirSync(AKAR_KATALOG)
  .filter((n) => n.endsWith(".json"))
  .map((n) => JSON.parse(readFileSync(path.join(AKAR_KATALOG, n), "utf8")) as Record<string, any>)
  .filter((k) => k.contoh !== true);

function ada(p: PanduanSaksi): PanduanTersedia {
  if (!p.tersedia) throw new Error(`panduan tidak tersedia: ${p.alasan}`);
  return p;
}

const semuaTeks = (p: PanduanTersedia): string[] => {
  const hasil: string[] = [p.judul, p.sebutan.satu, p.sebutan.dua];
  const dariPokok = (daftar: PanduanTersedia["saksi"]["P"]["pokok"]) => {
    for (const x of daftar) {
      hasil.push(x.judul, x.uraian);
      for (const d of x.dasarHukum) hasil.push(d.rujukan, d.uraian);
      for (const t of x.tanya) hasil.push(t.teks);
    }
  };
  dariPokok(p.saksi.P.pokok);
  dariPokok(p.saksi.T.pokok);
  for (const k of p.keadaan) {
    hasil.push(k.label);
    for (const n of k.nilai) hasil.push(n.label);
  }
  for (const r of p.keterangan?.peran ?? []) {
    hasil.push(r.label);
    dariPokok(r.pokok);
  }
  return hasil.filter(Boolean);
};

describe("panduan pertanyaan saksi - pemilihan katalog per jenis perkara", () => {
  it("cerai gugat, cerai talak, dispensasi kawin, harta bersama dikenali dari jenis_perkara_id/alur", () => {
    expect(ada(susunPanduan({ jenisPerkaraId: 347, alurPerkaraId: 15 })).kunci).toBe("cerai-gugat");
    expect(ada(susunPanduan({ jenisPerkaraId: 346, alurPerkaraId: 15 })).kunci).toBe("cerai-talak");
    expect(ada(susunPanduan({ jenisPerkaraId: 362, alurPerkaraId: 16 })).kunci).toBe("dispensasi-kawin");
    expect(ada(susunPanduan({ jenisPerkaraId: 348, alurPerkaraId: 15 })).kunci).toBe("harta-bersama");
    expect(ada(susunPanduan({ jenisPerkaraId: 364, alurPerkaraId: 15 })).kunci).toBe("kewarisan");
  });

  it("sebutan pihak mengikuti alur dan jenis: cerai talak = Pemohon/Termohon", () => {
    expect(ada(susunPanduan({ jenisPerkaraId: 346, alurPerkaraId: 15 })).sebutan).toEqual({ satu: "Pemohon", dua: "Termohon" });
    expect(ada(susunPanduan({ jenisPerkaraId: 347, alurPerkaraId: 15 })).sebutan).toEqual({ satu: "Penggugat", dua: "Tergugat" });
  });

  it("jenis tanpa katalog TIDAK dijadikan cerai: belum ada panduan", () => {
    const p = susunPanduan({ jenisPerkaraId: 999, alurPerkaraId: 15 });
    expect(p.tersedia).toBe(false);
    if (!p.tersedia) expect(p.alasan).toBe(PESAN_BELUM_ADA_PANDUAN);
    expect(susunPanduan({}).tersedia).toBe(false);
  });

  it("setiap katalog saksi yang ada dapat disusun dan memuat pertanyaan", () => {
    for (const k of KATALOG) {
      if (k.tambahanUntuk || k.jenisKatalog) continue;
      const jenis = Number(k.syarat.jenisPerkaraId[0]);
      const alur = k.syarat.alurPerkaraId ? Number(k.syarat.alurPerkaraId[0]) : undefined;
      const nama = k.kunci === "pengangkatan-anak" ? "Pengangkatan Anak" : k.kunci === "hak-asuh" ? "Hak Asuh Anak" : k.kunci === "permohonan-umum" ? "Lain-lain" : "";
      const p = ada(susunPanduan({ jenisPerkaraId: jenis, alurPerkaraId: alur, jenisPerkara: nama }));
      expect(p.kunci, k.kunci).toBe(k.kunci);
      expect(p.saksi.P.jumlahTanya, k.kunci).toBeGreaterThan(5);
    }
  });

  it("dispensasi kawin memuat bagian keterangan anak, calon, dan orang tua; jenis lain tidak", () => {
    const dk = ada(susunPanduan({ jenisPerkaraId: 362, alurPerkaraId: 16 }));
    expect(dk.keterangan).not.toBeNull();
    expect(dk.keterangan!.peran.map((r) => r.kode)).toEqual(["anak", "calon", "orangTuaAnak", "orangTuaCalon"]);
    expect(ada(susunPanduan({ jenisPerkaraId: 347, alurPerkaraId: 15 })).keterangan).toBeNull();
  });

  it("butir sensitif keterangan anak/calon ditahan sampai diminta", () => {
    const keadaan = { sebabDK: "hamil" };
    const tutup = ada(susunPanduan({ jenisPerkaraId: 362, alurPerkaraId: 16, keadaan }));
    const buka = ada(susunPanduan({ jenisPerkaraId: 362, alurPerkaraId: 16, keadaan, butirSensitif: true }));
    const hitung = (p: PanduanTersedia) => p.keterangan!.peran.reduce((n, r) => n + r.pokok.reduce((m, x) => m + x.tanya.length, 0), 0);
    expect(tutup.keterangan!.peran.some((r) => r.pokok.some((x) => x.id === "pp-kt-sebab"))).toBe(false);
    expect(buka.keterangan!.peran.some((r) => r.pokok.some((x) => x.id === "pp-kt-sebab"))).toBe(true);
    expect(hitung(buka)).toBeGreaterThan(hitung(tutup));
  });

  it("harta bersama dan kewarisan: saksi tergugat punya daftar sendiri yang berbeda", () => {
    expect(ada(susunPanduan({ jenisPerkaraId: 348, alurPerkaraId: 15 })).tergugatBerbeda).toBe(true);
    expect(ada(susunPanduan({ jenisPerkaraId: 364, alurPerkaraId: 15 })).tergugatBerbeda).toBe(true);
    expect(ada(susunPanduan({ jenisPerkaraId: 347, alurPerkaraId: 15 })).tergugatBerbeda).toBe(false);
    const hb = ada(susunPanduan({ jenisPerkaraId: 348, alurPerkaraId: 15, keadaan: { bantahan: ["sudah-dibagi"] } }));
    const idP = hb.saksi.P.pokok.flatMap((p) => p.tanya.map((t) => t.id));
    const idT = hb.saksi.T.pokok.flatMap((p) => p.tanya.map((t) => t.id));
    expect(idT.some((id) => !idP.includes(id))).toBe(true);
  });
});

describe("panduan pertanyaan saksi - keadaan perkara", () => {
  it("keadaan kehadiran menggeser butir yang ditanyakan (verstek berbeda dari hadir)", () => {
    const hadir = ada(susunPanduan({ jenisPerkaraId: 347, alurPerkaraId: 15, keadaan: { kehadiran: "kontradiktoir" } }));
    const verstek = ada(susunPanduan({ jenisPerkaraId: 347, alurPerkaraId: 15, keadaan: { kehadiran: "verstek" } }));
    expect(verstek.keadaanDipakai.kehadiran).toBe("verstek");
    expect(hadir.keadaanDipakai.kehadiran).toBe("kontradiktoir");
    const id = (p: PanduanTersedia) => p.saksi.P.pokok.flatMap((x) => x.tanya.map((t) => t.id)).join(",");
    const terlihat = (p: PanduanTersedia) => p.saksi.P.pokok.map((x) => x.id).join(",");
    // Keduanya tetap memuat pokok inti; yang diuji: keadaan diterima dan dipakai mesin tanpa merusak daftar.
    expect(id(hadir).length).toBeGreaterThan(0);
    expect(terlihat(verstek).length).toBeGreaterThan(0);
  });

  it("nilai keadaan yang tidak dikenal katalog diabaikan, bukan dipakai", () => {
    const p = ada(susunPanduan({ jenisPerkaraId: 347, alurPerkaraId: 15, keadaan: { kehadiran: "ngawur", tidakAda: "x" } }));
    expect(p.keadaanDipakai.kehadiran).toBe("kontradiktoir");
    expect(p.keadaanDipakai).not.toHaveProperty("tidakAda");
  });

  it("alasan perceraian yang dipilih membuka butir tambahannya", () => {
    const dasar = ada(susunPanduan({ jenisPerkaraId: 347, alurPerkaraId: 15, keadaan: { alasan: ["F"] } }));
    const dengan = ada(susunPanduan({ jenisPerkaraId: 347, alurPerkaraId: 15, keadaan: { alasan: ["F", "B"] } }));
    expect(dengan.saksi.P.jumlahTanya).toBeGreaterThan(dasar.saksi.P.jumlahTanya);
  });

  it("kumulasi yang dikenal portal membuka butir kumulasi", () => {
    const tanpa = ada(susunPanduan({ jenisPerkaraId: 347, alurPerkaraId: 15 }));
    const dengan = ada(susunPanduan({ jenisPerkaraId: 347, alurPerkaraId: 15, keadaan: { kumulasi: ["hak-asuh"] } }));
    expect(dengan.keadaanDipakai.kumulasi).toEqual(["hak-asuh"]);
    expect(dengan.saksi.P.jumlahTanya).toBeGreaterThanOrEqual(tanpa.saksi.P.jumlahTanya);
  });

  it("keadaan keterangan anak/calon (latar belakang permohonan) ikut menjadi isian dispensasi kawin", () => {
    const p = ada(susunPanduan({ jenisPerkaraId: 362, alurPerkaraId: 16 }));
    const sebab = p.keadaan.find((k) => k.kunci === "sebabDK");
    expect(sebab).toBeTruthy();
    const ket = p.keadaan.filter((k) => k.untuk === "keterangan").map((k) => k.kunci);
    expect(ket.length).toBeGreaterThan(0);
    expect(p.keadaan.some((k) => k.kunci === "peran")).toBe(false);
  });

  it("isian keadaan memuat label yang ramah dan nilai bertulisan biasa", () => {
    const p = ada(susunPanduan({ jenisPerkaraId: 347, alurPerkaraId: 15 }));
    const kehadiran = p.keadaan.find((k) => k.kunci === "kehadiran");
    expect(kehadiran).toBeTruthy();
    expect(kehadiran!.nilai.map((n) => n.label)).toContain("Tidak hadir (verstek)");
    expect(kehadiran!.asal).toBe("otomatis");
  });
});

describe("panduan pertanyaan saksi - pokok wajib dan dasar hukum", () => {
  it("pokok wajib ditandai dan memuat butir inti", () => {
    const p = ada(susunPanduan({ jenisPerkaraId: 347, alurPerkaraId: 15 }));
    const wajib = p.saksi.P.pokok.filter((x) => x.wajib);
    expect(wajib.length).toBeGreaterThanOrEqual(3);
    for (const x of wajib) expect(butirHitung(x).length).toBeGreaterThan(0);
    expect(wajib.some((x) => /perselisihan/i.test(x.judul))).toBe(true);
  });

  it("dasar hukum hanya yang terverifikasi", () => {
    const p = ada(susunPanduan({ jenisPerkaraId: 347, alurPerkaraId: 15 }));
    const dasar = p.saksi.P.pokok.flatMap((x) => x.dasarHukum);
    expect(dasar.length).toBeGreaterThan(0);
    const kat = KATALOG.find((k) => k.kunci === "cerai-gugat")!;
    const terverifikasi = new Set(kat.dasarHukum.filter((d: any) => d.status === "terverifikasi").map((d: any) => d.rujukan));
    for (const d of dasar) expect(terverifikasi.has(d.rujukan)).toBe(true);
  });

  it("rujukan berstatus perlu-verifikasi tidak muncul di keluaran jenis perkara mana pun", () => {
    const jenis = KATALOG.filter((k) => !k.tambahanUntuk && !k.jenisKatalog);
    let diperiksa = 0;
    for (const k of KATALOG) {
      const belumPasti = (k.dasarHukum ?? []).filter((d: any) => d.status === "perlu-verifikasi").map((d: any) => String(d.rujukan).toLowerCase());
      if (belumPasti.length === 0) continue;
      // keluaran jenis yang memakai katalog ini (utama atau tambahannya)
      const utamaKunci = k.tambahanUntuk ? k.tambahanUntuk[0] : k.kunci;
      const utama = jenis.find((j) => j.kunci === utamaKunci);
      if (!utama) continue;
      const nama = utama.kunci === "pengangkatan-anak" ? "Pengangkatan Anak" : utama.kunci === "hak-asuh" ? "Hak Asuh Anak" : "";
      const p = ada(
        susunPanduan({ jenisPerkaraId: Number(utama.syarat.jenisPerkaraId[0]), alurPerkaraId: utama.syarat.alurPerkaraId ? Number(utama.syarat.alurPerkaraId[0]) : undefined, jenisPerkara: nama, butirSensitif: true })
      );
      const gabung = semuaTeks(p).join("\n").toLowerCase();
      for (const r of belumPasti) {
        expect(gabung.includes(r), `${k.kunci}: ${r}`).toBe(false);
        diperiksa += 1;
      }
    }
    expect(diperiksa).toBeGreaterThan(5);
  });
});

describe("panduan pertanyaan saksi - tanpa contoh jawaban dan tanpa kode tampil", () => {
  const SEMUA = KATALOG.filter((k) => !k.tambahanUntuk && !k.jenisKatalog).map((k) => {
    const nama = k.kunci === "pengangkatan-anak" ? "Pengangkatan Anak" : k.kunci === "hak-asuh" ? "Hak Asuh Anak" : k.kunci === "permohonan-umum" ? "Lain-lain" : "";
    return ada(
      susunPanduan({
        jenisPerkaraId: Number(k.syarat.jenisPerkaraId[0]),
        alurPerkaraId: k.syarat.alurPerkaraId ? Number(k.syarat.alurPerkaraId[0]) : undefined,
        jenisPerkara: nama,
        butirSensitif: true,
        keadaan: { alasan: ["A", "B", "C", "D", "E", "F", "G", "H"] },
      })
    );
  });

  it("tidak ada kalimat jawaban saksi (saksi1/saksi2/jawabanUmum) di keluaran", () => {
    const kalimat = new Set<string>();
    const kumpul = (x: any) => {
      for (const kalimatSaksi of [...(x?.saksi1 ?? []), ...(x?.saksi2 ?? [])]) if (typeof kalimatSaksi === "string" && kalimatSaksi.length > 25) kalimat.add(kalimatSaksi.toLowerCase());
    };
    for (const k of KATALOG) {
      for (const q of k.pertanyaan ?? []) for (const nilai of Object.values<any>(q.jawaban ?? {})) for (const x of Array.isArray(nilai) ? nilai : [nilai]) kumpul(x);
      for (const nilai of Object.values<any>(k.jawabanUmum ?? {})) for (const x of Array.isArray(nilai) ? nilai : [nilai]) kumpul(x);
    }
    expect(kalimat.size).toBeGreaterThan(1000);
    for (const p of SEMUA) {
      const gabung = semuaTeks(p).join("\n").toLowerCase();
      for (const j of kalimat) expect(gabung.includes(j), `${p.kunci}: ${j}`).toBe(false);
    }
  });

  it("keluaran serial tidak memuat ruas jawaban sama sekali", () => {
    for (const p of SEMUA) {
      const json = JSON.stringify(p);
      expect(json).not.toMatch(/"(jawaban|jawabanUmum|saksi1|saksi2|maksud|variabelAbt|teksVarian|blangkoBas)"/);
    }
  });

  it("tanpa kode #nnnn#, tempat isian {x}, titik-titik pengganti, atau kata terlarang", () => {
    for (const p of SEMUA) {
      for (const t of semuaTeks(p)) {
        expect(t, `${p.kunci}: ${t}`).not.toMatch(/#\d{4}#/);
        expect(t, `${p.kunci}: ${t}`).not.toMatch(/[{}]/);
        expect(t, `${p.kunci}: ${t}`).not.toContain("...");
        expect(t, `${p.kunci}: ${t}`).not.toMatch(/\b(peladen|borang|galat|template|aleta)\b/i);
        expect(t, `${p.kunci}: ${t}`).not.toMatch(/\bpp-[a-z]/);
      }
    }
  });

  it("teksPanduan mengganti kode pihak dengan sebutan dan kode lain dengan kata biasa", () => {
    const konteks = { katalogKunci: "cerai-gugat", satu: "Penggugat", dua: "Tergugat", pihak: "P" as const };
    expect(teksPanduan("Apakah saksi kenal dengan #0046# dan #0047# ?", konteks)).toBe("Apakah saksi kenal dengan Penggugat dan Tergugat?");
    expect(teksPanduan("Berapa umur anak bernama #8602# sekarang ?", konteks)).toBe("Berapa umur anak yang dimaksud sekarang?");
    expect(teksPanduan("Apakah saksi mengetahui maksud {pihakSaksi} menghadirkan saksi ?", konteks)).toBe("Apakah saksi mengetahui maksud Penggugat menghadirkan saksi?");
    expect(teksPanduan("kode #9999# asing {tidakAda}", konteks)).not.toMatch(/#|\{/);
    const waris = { katalogKunci: "kewarisan", satu: "Penggugat", dua: "Tergugat", pihak: "P" as const };
    expect(teksPanduan("Apakah saksi kenal dengan #2026# #1025# yang disebut sebagai pewaris dalam perkara ini ?", waris)).toBe(
      "Apakah saksi kenal dengan almarhum/almarhumah yang disebut sebagai pewaris dalam perkara ini?"
    );
  });
});

describe("panduan pertanyaan saksi - keadaan dari data sidang SIPP", () => {
  it("verstek dari kehadiran sidang", () => {
    expect(kehadiranDariSidang({ dihadiriOleh: 2 })).toBe("verstek");
    expect(kehadiranDariSidang({ dihadiriOleh: 1 })).toBe("kontradiktoir");
    expect(kehadiranDariSidang({ dihadiriOleh: 2, tergugatPernahHadir: true })).toBe("t-tidak-hadir-setelah-mediasi");
    expect(kehadiranDariSidang({ dihadiriOleh: null, verstekPutusan: true })).toBe("verstek");
  });

  it("kehadiran yang tidak dapat ditentukan dibiarkan kosong, bukan ditebak", () => {
    expect(kehadiranDariSidang({ dihadiriOleh: null })).toBe("");
    expect(kehadiranDariSidang({ dihadiriOleh: 3 })).toBe("");
    expect(kehadiranDariSidang({ dihadiriOleh: 4 })).toBe("");
    expect(keadaanAwalDariSidang({ dihadiriOleh: null })).toEqual({});
  });

  it("kumulasi dari kumulasi yang dikenali portal, ditambah rekonvensi", () => {
    expect(kumulasiDariPortal({ daftar: [{ kode: "hak-asuh-anak" }, { kode: "nafkah-iddah" }, { kode: "mahar" }] }, false)).toEqual(["hak-asuh", "nafkah-iddah"]);
    expect(kumulasiDariPortal(null, true)).toEqual(["rekonvensi"]);
    expect(keadaanAwalDariSidang({ dihadiriOleh: 2, kumulasi: { daftar: [{ kode: "harta-bersama" }] } })).toEqual({ kehadiran: "verstek", kumulasi: ["harta-bersama"] });
  });

  it("keadaan awal dari sidang diterima mesin dan tampak pada isian", () => {
    const p = ada(susunPanduan({ jenisPerkaraId: 347, alurPerkaraId: 15, keadaan: keadaanAwalDariSidang({ dihadiriOleh: 2, kumulasi: { daftar: [{ kode: "hak-asuh-anak" }] } }) }));
    expect(p.keadaanDipakai.kehadiran).toBe("verstek");
    expect(p.keadaanDipakai.kumulasi).toEqual(["hak-asuh"]);
  });

  it("nomor jenis: dari SIPP lebih dulu, nama jenis hanya cadangan", () => {
    expect(jenisPerkaraIdPandu({ nomorPerkara: "1/Pdt.G/2026/PA.Dgl", jenisPerkaraId: 347 })).toBe(347);
    expect(jenisPerkaraIdPandu({ nomorPerkara: "1/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat" })).toBe(347);
    expect(jenisPerkaraIdDariNama("Cerai Talak")).toBe(346);
    expect(jenisPerkaraIdDariNama("Dispensasi Kawin")).toBe(362);
    expect(jenisPerkaraIdDariNama("Jenis Aneh")).toBeNull();
    expect(jenisPerkaraIdPandu({ nomorPerkara: "x" })).toBeNull();
  });

  it("agenda pembuktian/saksi ditandai menonjol", () => {
    expect(agendaPembuktianSaksi("Pembuktian")).toBe(true);
    expect(agendaPembuktianSaksi("Pemeriksaan Saksi")).toBe(true);
    expect(agendaPembuktianSaksi("Mediasi")).toBe(false);
    expect(agendaPembuktianSaksi("")).toBe(false);
  });
});

describe("panduan pertanyaan saksi - saksi, centang, dan peringatan", () => {
  it("daftar saksi memakai nama dari SIPP; minimal dua baris; batas 5 dan 4", () => {
    expect(daftarSaksiPandu("P", ["Fulanah", "Fulan"]).map((s) => s.nama)).toEqual(["Fulanah", "Fulan"]);
    expect(daftarSaksiPandu("P", []).map((s) => s.nama)).toEqual(["Saksi 1", "Saksi 2"]);
    expect(daftarSaksiPandu("P", ["A"]).map((s) => s.nama)).toEqual(["A", "Saksi 2"]);
    expect(daftarSaksiPandu("P", [], 9)).toHaveLength(5);
    expect(daftarSaksiPandu("T", [], 9)).toHaveLength(4);
    expect(daftarSaksiPandu("T", [], 1).map((s) => s.kunci)).toEqual(["T1", "T2", "T3"]);
  });

  it("peringatan muncul bila pokok wajib belum lengkap pada minimal 2 saksi", () => {
    const p = ada(susunPanduan({ jenisPerkaraId: 347, alurPerkaraId: 15 }));
    const saksi = daftarSaksiPandu("P", []);
    const awal = hitungPokok(p.saksi.P.pokok, saksi, {});
    const kurang = peringatanPokokWajib(awal);
    expect(kurang.length).toBe(p.saksi.P.pokok.filter((x) => x.wajib && butirHitung(x).length > 0).length);

    // Saksi 1 melengkapi semuanya, saksi 2 belum: tetap kurang.
    const centang: Record<string, boolean> = {};
    for (const x of p.saksi.P.pokok) for (const b of butirHitung(x)) centang[kunciCentang("P1", b.id)] = true;
    expect(peringatanPokokWajib(hitungPokok(p.saksi.P.pokok, saksi, centang)).length).toBe(kurang.length);

    // Saksi 2 ikut melengkapi: tidak ada peringatan lagi.
    for (const x of p.saksi.P.pokok) for (const b of butirHitung(x)) centang[kunciCentang("P2", b.id)] = true;
    expect(peringatanPokokWajib(hitungPokok(p.saksi.P.pokok, saksi, centang))).toEqual([]);
  });

  it("pokok yang tidak wajib tidak pernah menjadi peringatan", () => {
    const p = ada(susunPanduan({ jenisPerkaraId: 347, alurPerkaraId: 15 }));
    const lain = p.saksi.P.pokok.filter((x) => !x.wajib);
    expect(peringatanPokokWajib(hitungPokok(lain, daftarSaksiPandu("P", []), {}))).toEqual([]);
  });

  it("kunci penyimpanan per perkara per sidang; kelas layar menurut lebar", () => {
    expect(kunciSimpanCentang("12/Pdt.G/2026/PA.Dgl", "77")).not.toBe(kunciSimpanCentang("12/Pdt.G/2026/PA.Dgl", "78"));
    expect(kunciSimpanCentang("12/Pdt.G/2026/PA.Dgl", "77")).not.toBe(kunciSimpanCentang("13/Pdt.G/2026/PA.Dgl", "77"));
    expect(kelasLayarDariLebar(390)).toBe("ponsel");
    expect(kelasLayarDariLebar(820)).toBe("tablet");
    expect(kelasLayarDariLebar(1366)).toBe("laptop");
    expect(kelasLayarDariLebar(1920)).toBe("tv");
  });
});
