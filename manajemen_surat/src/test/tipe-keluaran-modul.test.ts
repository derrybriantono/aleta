// @vitest-environment node
import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { jsonKanonik, sha1Hex, sidik, versiDari } from "@/lib/tipe-keluaran/gabung";
import { BUNYI_KEHADIRAN } from "@/server/modules/aleta-ecourt/bas-kehadiran";
import { cerminDaftar, daftarBercermin } from "@/lib/tipe-keluaran/bawaan";
import { DAFTAR_BOT, DAFTAR_EKSTENSI, type EntriCermin, type EntriTipe, type KunciDaftar } from "@/lib/tipe-keluaran/kontrak";
import { GalatDaftarTakTerdaftar, validasiEntri } from "@/lib/tipe-keluaran/validasi";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import * as modul from "@/server/modules/aleta-ecourt/tipe-keluaran";
import {
  bacaAdmin,
  ganti,
  jalankanTindakan,
  matikan,
  nyalakan,
  pastikanBenih,
  sahkan,
  tolak,
  untukBot,
  untukEkstensi,
  untukPortal,
  usul,
} from "@/server/modules/aleta-ecourt/tipe-keluaran";

/**
 * ============================================================================
 * MODUL TIPE KELUARAN - DIJALANKAN SUNGGUHAN DI pg-mem
 * ============================================================================
 *
 * Yang dijaga adalah janji-janji yang, bila patah, patahnya DIAM:
 *   - tabel kosong atau tak terbaca = keluaran hari ini (cermin kode);
 *   - benih idempoten, baris yatim diabaikan dan dicatat sekali;
 *   - validasi menolak kalimat rusak dan daftar tak terdaftar adalah GALAT;
 *   - sahkan butuh Super Admin + atas perintah (hakim untuk kalimat BAS),
 *     daftar deteksi butuh ukur yang lulus;
 *   - setiap tindakan: TEPAT satu riwayat dan satu audit - dihitung;
 *   - tidak ada jalur DELETE - diperiksa pada SQL yang sungguh dijalankan.
 */

let db: AletaDatabase | null = null;

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
});

afterEach(async () => {
  await db?.close();
  db = null;
});

const d = () => db as AletaDatabase;

function inti(e: EntriTipe | EntriCermin) {
  return { kunci: e.kunci, nilai: e.nilai, data: e.data ?? {}, urutan: e.urutan };
}

async function hitung(sql: string, params: string[] = []) {
  const baris = await d().queryOne<{ n: string | number }>(sql, params);
  return Number(baris?.n ?? 0);
}

async function jejak() {
  return {
    riwayat: await hitung("SELECT COUNT(*) AS n FROM aleta_tipe_keluaran_riwayat"),
    audit: await hitung("SELECT COUNT(*) AS n FROM audit_logs"),
    auditTipe: await hitung("SELECT COUNT(*) AS n FROM audit_logs WHERE action LIKE 'TIPE_KELUARAN_%'"),
  };
}

async function selisihJejak<T>(kerja: () => Promise<T>) {
  const sebelum = await jejak();
  const hasil = await kerja();
  const sesudah = await jejak();
  return {
    hasil,
    riwayat: sesudah.riwayat - sebelum.riwayat,
    audit: sesudah.audit - sebelum.audit,
    auditTipe: sesudah.auditTipe - sebelum.auditTipe,
  };
}

/** Menangkap SELURUH SQL yang dijalankan lewat pool, termasuk di dalam transaksi. */
function pasangMataSql(basis: AletaDatabase): string[] {
  const catatan: string[] = [];
  type Kueri = { query: (...a: unknown[]) => unknown };
  const catat = (q: unknown) =>
    catatan.push(typeof q === "string" ? q : String((q as { text?: string } | null)?.text ?? ""));
  const pool = basis.getQueryable() as unknown as Kueri & { connect: (...a: unknown[]) => Promise<unknown> };
  const kueriAsli = pool.query.bind(pool);
  pool.query = (...a: unknown[]) => {
    catat(a[0]);
    return kueriAsli(...a);
  };
  const sambungAsli = pool.connect.bind(pool);
  pool.connect = async (...a: unknown[]) => {
    const klien = (await sambungAsli(...a)) as Kueri & { __dimata?: boolean };
    if (!klien.__dimata) {
      const q = klien.query.bind(klien);
      klien.query = (...b: unknown[]) => {
        catat(b[0]);
        return q(...b);
      };
      klien.__dimata = true;
    }
    return klien;
  };
  return catatan;
}

async function idBawaan(daftar: KunciDaftar, nilai: string) {
  const baris = await d().queryOne<{ id: string }>(
    "SELECT id FROM aleta_tipe_keluaran WHERE daftar = ? AND asal = 'bawaan' AND nilai = ?",
    [daftar, nilai]
  );
  expect(baris?.id).toBeTruthy();
  return baris!.id;
}

// ============================================================================
describe("sidik dan versi (K3)", () => {
  const sha1Node = (t: string) => createHash("sha1").update(t, "utf8").digest("hex");

  it("sha1Hex (tanpa node:crypto, dapat jalan di peramban) = node:crypto, termasuk huruf beraksen dan batas blok", () => {
    const contoh = ["", "a", "abc", "é ñ 中文 😀", "x".repeat(55), "x".repeat(56), "x".repeat(64), "y".repeat(1000)];
    for (const t of contoh) expect(sha1Hex(t), JSON.stringify(t.slice(0, 20))).toBe(sha1Node(t));
  });

  it("sidik = sha1(daftar \\0 kunci \\0 nilai \\0 JSON data kanonik); urutan kunci data tidak berpengaruh", () => {
    const a = sidik("putusan.peta-blangko", "x", "y", { b: 1, a: [2, { d: 1, c: 2 }] });
    const b = sidik("putusan.peta-blangko", "x", "y", { a: [2, { c: 2, d: 1 }], b: 1 });
    expect(a).toBe(b);
    expect(a).toBe(sha1Node('putusan.peta-blangko\u0000x\u0000y\u0000{"a":[2,{"c":2,"d":1}],"b":1}'));
    expect(sidik("bas.kehadiran.bunyi", "", "z", undefined)).toBe(sha1Node("bas.kehadiran.bunyi\u0000\u0000z\u0000{}"));
  });

  it("versi = 16 hex pertama sha1 JSON kanonik seluruh daftar yang dikirim", () => {
    const isi = { "bas.kehadiran.bunyi": [{ kunci: "", nilai: "z", data: {}, urutan: 0, asal: "bawaan" as const, sidik: "s" }] };
    expect(versiDari(isi)).toBe(sha1Node(jsonKanonik(isi)).slice(0, 16));
  });
});

// ============================================================================
describe("tabel kosong: keluaran = cermin untuk 100% daftar yang bercermin", () => {
  it("untukEkstensi - keempat daftar K5, urutan dan isi sama dengan cermin", async () => {
    const hasil = await untukEkstensi(d());
    expect(hasil.asal).toBe("basis-data");
    expect(hasil.versi).toMatch(/^[0-9a-f]{16}$/);
    expect(Object.keys(hasil.daftar)).toEqual([...DAFTAR_EKSTENSI]);
    for (const daftar of DAFTAR_EKSTENSI) {
      expect(hasil.daftar[daftar]!.map(inti)).toEqual(cerminDaftar(daftar)!.map(inti));
      expect(hasil.daftar[daftar]!.every((e) => e.asal === "bawaan")).toBe(true);
    }
  });

  it("untukBot - daftar bot yang bercermin = cermin; yang cerminnya belum dirangkai TIDAK dikirim", async () => {
    const hasil = await untukBot(d());
    const bercermin = DAFTAR_BOT.filter((k) => cerminDaftar(k) !== null);
    expect(Object.keys(hasil.daftar)).toEqual(bercermin);
    expect(hasil.tanpaCermin).toEqual(DAFTAR_BOT.filter((k) => cerminDaftar(k) === null));
    for (const daftar of bercermin) expect(hasil.daftar[daftar]!.map(inti)).toEqual(cerminDaftar(daftar)!.map(inti));
    // Tanpa daftar yang hilang, bot memakai konstanta tertanamnya (K6).
    for (const daftar of hasil.tanpaCermin) expect(hasil.daftar[daftar]).toBeUndefined();
  });

  it("untukPortal - bunyi kehadiran = BUNYI_KEHADIRAN yang dipakai hari ini", async () => {
    const hasil = await untukPortal(d(), ["bas.kehadiran.bunyi"]);
    expect(hasil.daftar["bas.kehadiran.bunyi"]!.map((e) => e.nilai)).toEqual([...BUNYI_KEHADIRAN]);
  });

  it("seluruh daftar bercermin lewat untukPortal: 100% deep-equal", async () => {
    const semua = daftarBercermin();
    const hasil = await untukPortal(d(), semua);
    const sama = semua.filter(
      (k) => JSON.stringify(hasil.daftar[k]!.map(inti)) === JSON.stringify(cerminDaftar(k)!.map(inti))
    );
    expect(sama.length / semua.length).toBe(1);
  });

  it("daftar tak terdaftar adalah GALAT 400, bukan jawaban kosong", async () => {
    await expect(untukPortal(d(), ["putusan.tidak-ada"])).rejects.toMatchObject({ status: 400 });
    expect(() => validasiEntri("putusan.tidak-ada", { nilai: "x" })).toThrow(GalatDaftarTakTerdaftar);
  });

  it("versi sama untuk isi yang sama", async () => {
    const a = await untukEkstensi(d());
    const b = await untukEkstensi(d());
    expect(b.versi).toBe(a.versi);
  });
});

// ============================================================================
describe("pastikanBenih", () => {
  it("dua kali: baris bawaan = jumlah entri cermin, tidak berubah pada panggilan kedua", async () => {
    const jumlahCermin = daftarBercermin().reduce((n, k) => n + cerminDaftar(k)!.length, 0);
    const pertama = await pastikanBenih(d());
    expect(pertama.jumlahCermin).toBe(jumlahCermin);
    expect(pertama.disisipkan).toBe(jumlahCermin);
    const n1 = await hitung("SELECT COUNT(*) AS n FROM aleta_tipe_keluaran WHERE asal = 'bawaan'");
    const kedua = await pastikanBenih(d());
    const n2 = await hitung("SELECT COUNT(*) AS n FROM aleta_tipe_keluaran WHERE asal = 'bawaan'");
    expect(kedua.disisipkan).toBe(0);
    expect(n1).toBe(jumlahCermin);
    expect(n2).toBe(n1);
    expect(await hitung("SELECT COUNT(*) AS n FROM aleta_tipe_keluaran_riwayat WHERE tindakan = 'benih'")).toBe(jumlahCermin);
  });

  it("INSERT dengan (daftar, sidik) kembar ditolak basis data", async () => {
    await pastikanBenih(d());
    const ada = await d().queryOne<Record<string, unknown>>(
      "SELECT * FROM aleta_tipe_keluaran WHERE daftar = 'bas.kehadiran.bunyi' LIMIT 1"
    );
    await expect(
      d().run(
        `INSERT INTO aleta_tipe_keluaran (id, golongan, daftar, kunci, nilai, data, asal, sidik, aktif, keadaan,
           urutan, versi, dibuat_oleh, dibuat_at, diubah_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ["kembar-1", "bas", "bas.kehadiran.bunyi", "", String(ada?.nilai), "{}", "bawaan", String(ada?.sidik), 1,
          "disahkan", 0, 1, "uji", "2026-09-25T00:00:00.000Z", "2026-09-25T00:00:00.000Z"]
      )
    ).rejects.toThrow();
  });

  it("baris bawaan YATIM diabaikan, dan riwayatnya dicatat sekali saja", async () => {
    await pastikanBenih(d());
    await d().run(
      `INSERT INTO aleta_tipe_keluaran (id, golongan, daftar, kunci, nilai, data, asal, sidik, aktif, keadaan,
         urutan, versi, dibuat_oleh, dibuat_at, diubah_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ["yatim-1", "bas", "bas.kehadiran.bunyi", "", "bunyi lama yang sudah dihapus dari kode", "{}", "bawaan",
        "sidik-yang-tidak-ada-di-cermin", 1, "disahkan", 9, 1, "benih", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"]
    );
    expect((await pastikanBenih(d())).yatimBaru).toBe(1);
    expect((await pastikanBenih(d())).yatimBaru).toBe(0);
    expect(
      await hitung("SELECT COUNT(*) AS n FROM aleta_tipe_keluaran_riwayat WHERE butir_id = 'yatim-1' AND tindakan = 'yatim'")
    ).toBe(1);
    const hasil = await untukPortal(d(), ["bas.kehadiran.bunyi"]);
    expect(hasil.daftar["bas.kehadiran.bunyi"]!.map((e) => e.nilai)).toEqual([...BUNYI_KEHADIRAN]);
    const admin = await bacaAdmin(d(), "bas");
    const butir = admin.daftar.find((x) => x.daftar === "bas.kehadiran.bunyi")!.butir.find((b) => b.id === "yatim-1");
    expect(butir).toMatchObject({ yatim: true, berlaku: false });
  });

  it("tambahan yang KEMUDIAN diadopsi ke kode tidak tampil dua kali, dan barisnya tetap menjadi saklar entri itu", async () => {
    // Keadaan sesudah kode mengadopsi sebuah tambahan: barisnya sudah ada
    // sebelum benih entri cermin yang sama ditanam, sehingga benih itu
    // bertabrakan dengan UNIQUE (daftar, sidik) dan tidak pernah tertanam.
    const nilai = BUNYI_KEHADIRAN[0];
    await d().run(
      `INSERT INTO aleta_tipe_keluaran (id, golongan, daftar, kunci, nilai, data, asal, sidik, aktif, keadaan,
         urutan, versi, dibuat_oleh, dibuat_at, diubah_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ["adopsi-1", "bas", "bas.kehadiran.bunyi", "", nilai, "{}", "tambahan", sidik("bas.kehadiran.bunyi", "", nilai, {}), 1,
        "disahkan", 0, 1, "usr-admin", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"]
    );
    const benih = await pastikanBenih(d());
    expect(benih.disisipkan).toBe(benih.jumlahCermin - 1);
    let hasil = await untukPortal(d(), ["bas.kehadiran.bunyi"]);
    expect(hasil.daftar["bas.kehadiran.bunyi"]!.map((e) => e.nilai)).toEqual([...BUNYI_KEHADIRAN]);
    await matikan(d(), "usr-admin", { id: "adopsi-1", alasan: "uji saklar" });
    hasil = await untukPortal(d(), ["bas.kehadiran.bunyi"]);
    expect(hasil.daftar["bas.kehadiran.bunyi"]!.map((e) => e.nilai)).toEqual(BUNYI_KEHADIRAN.slice(1));
  });
});

// ============================================================================
describe("tabel tak terbaca: jatuh ke cermin dengan asal 'cermin' - tidak diam", () => {
  it("SELECT gagal -> isi = cermin, asal 'cermin', kabar menyebut galatnya", async () => {
    // Basis data tersendiri (tanpa semai, cetakan lain): tabel yang dibuang di
    // sini tidak boleh ikut hilang dari basis data pemeriksaan lain.
    const rusak = await createAletaDatabase({ useInMemory: true, seed: false });
    try {
      await rusak.exec("DROP TABLE aleta_tipe_keluaran");
      await pemeriksaanTakTerbaca(rusak);
    } finally {
      await rusak.close();
    }
  });
});

async function pemeriksaanTakTerbaca(rusak: AletaDatabase) {
  const hasil = await untukEkstensi(rusak);
  expect(hasil.asal).toBe("cermin");
  for (const daftar of DAFTAR_EKSTENSI) {
    expect(hasil.daftar[daftar]!.map(inti)).toEqual(cerminDaftar(daftar)!.map(inti));
    expect(hasil.daftar[daftar]!.every((e) => e.asal === "cermin")).toBe(true);
  }
  expect(hasil.kabar.join(" ")).toMatch(/tidak terbaca/);
  expect(hasil.kabar.join(" ")).toMatch(/Benih/);
}

// ============================================================================
describe("validasi menolak kalimat rusak - {ok:false}, tanpa riwayat dan tanpa audit", () => {
  const RUSAK: [string, KunciDaftar, Record<string, unknown>, RegExp][] = [
    ["sebutan huruf kecil di awal kalimat", "bas.kehadiran.bunyi", { nilai: "penggugat dan Tergugat hadir" }, /huruf kecil/],
    ["'X dan X'", "bas.kehadiran.bunyi", { nilai: "hadir karena perselisihan dan perselisihan" }, /Kata ganda/],
    ["'${'", "bas.kehadiran.bunyi", { nilai: "hadir ${pelaku}" }, /\$\{/],
    ["'<'", "bas.kehadiran.bunyi", { nilai: "hadir <b>secara pribadi</b>" }, /'<'/],
    ["baris baru", "bas.kehadiran.bunyi", { nilai: "hadir\nsecara pribadi" }, /baris baru/],
    [
      "penanda di luar daftar",
      "bas.saksi.jawaban-modus",
      { kunci: "penyebab|sama", nilai: "penyebabnya {daftar} menurut cerita {pelaku}" },
      /Penanda \{pelaku\}/,
    ],
    [
      "penunjuk tombol Simpan",
      "putusan.medan-borang",
      { kunci: "putusan-akhir", nilai: "Simpan", data: { penunjuk: "#simpan" } },
      /Simpan\/submit/,
    ],
    ["regex di ganti kata", "bas.saksi.ragam-kata", { nilai: "\\bkarena\\b", data: { ganti: "sebab" } }, /regex/],
  ];

  for (const [nama, daftar, masukan, pola] of RUSAK) {
    it(nama, async () => {
      const periksa = validasiEntri(daftar, masukan);
      expect(periksa.ok).toBe(false);
      const { hasil, riwayat, audit } = await selisihJejak(() => usul(d(), "usr-admin", { daftar, ...masukan }));
      expect(hasil.ok).toBe(false);
      expect(hasil.ok ? [] : hasil.alasan.join(" ")).toMatch(pola);
      expect({ riwayat, audit }).toEqual({ riwayat: 0, audit: 0 });
    });
  }

  it("daftar tak terdaftar -> galat 400 dari usul, bukan {ok:false} dan bukan jawaban kosong", async () => {
    await expect(usul(d(), "usr-admin", { daftar: "bas.ngawur", nilai: "x" })).rejects.toMatchObject({ status: 400 });
  });

  it("seluruh entri cermin LOLOS validasi - validasi tidak lebih ketat dari keluaran hari ini", () => {
    const gagal: string[] = [];
    for (const daftar of daftarBercermin()) {
      for (const e of cerminDaftar(daftar)!) {
        const periksa = validasiEntri(daftar, e);
        if (!periksa.ok) gagal.push(`${daftar} ${e.kunci} ${e.nilai}: ${periksa.alasan.join("; ")}`);
      }
    }
    expect(gagal).toEqual([]);
  });
});

// ============================================================================
describe("kewenangan dan jejak - setiap tindakan TEPAT 1 riwayat dan 1 audit", () => {
  it("usul: panitera 403; admin -> usulan, +1 riwayat +1 audit", async () => {
    // Benih ditanam lebih dulu: pada basis data yang baru, tindakan pertama
    // ikut menanam benih (117 riwayat 'benih'), dan itu bukan jejak usulnya.
    await pastikanBenih(d());
    await expect(usul(d(), "usr-panitera", { daftar: "bas.kehadiran.bunyi", nilai: "hadir melalui telekonferensi" })).rejects.toMatchObject({
      status: 403,
    });
    const r = await selisihJejak(() => usul(d(), "usr-admin", { daftar: "bas.kehadiran.bunyi", nilai: "hadir melalui telekonferensi" }));
    expect(r.hasil).toMatchObject({ ok: true, butir: { asal: "tambahan", keadaan: "usulan", versi: 1 } });
    expect([r.riwayat, r.audit, r.auditTipe]).toEqual([1, 1, 1]);
    // Usulan belum berlaku.
    const hasil = await untukPortal(d(), ["bas.kehadiran.bunyi"]);
    expect(hasil.daftar["bas.kehadiran.bunyi"]!.map((e) => e.nilai)).toEqual([...BUNYI_KEHADIRAN]);
  });

  it("sahkan: admin 403; tanpa atas perintah 400; perintah panitera untuk BAS 400; perintah hakim -> sah, +1/+1", async () => {
    const u = await usul(d(), "usr-admin", { daftar: "bas.kehadiran.bunyi", nilai: "hadir melalui telekonferensi" });
    if (!u.ok) throw new Error(u.alasan.join("; "));
    const id = u.butir.id;
    await expect(sahkan(d(), "usr-admin", { id, atasPerintah: "usr-hakim" })).rejects.toMatchObject({ status: 403 });
    await expect(sahkan(d(), "usr-super", { id })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/Atas perintah/) });
    // Daftar yang TIDAK menuntut perintah hakim pun menolak sahkan tanpa atas
    // perintah - di sana tidak ada pemeriksaan hakim yang ikut menolaknya.
    const medan = await usul(d(), "usr-admin", {
      daftar: "putusan.medan-borang",
      kunci: "putusan-akhir",
      nilai: "Status Banding",
      data: { penunjuk: 'select[name="status_banding"]' },
    });
    if (!medan.ok) throw new Error(medan.alasan.join("; "));
    await expect(sahkan(d(), "usr-super", { id: medan.butir.id, atasPerintah: "  " })).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/Atas perintah/),
    });
    await expect(sahkan(d(), "usr-super", { id, atasPerintah: "usr-panitera" })).rejects.toMatchObject({ status: 400 });
    const r = await selisihJejak(() => sahkan(d(), "usr-super", { id, atasPerintah: "usr-hakim" }));
    expect(r.hasil).toMatchObject({ ok: true, butir: { keadaan: "disahkan", aktif: true, atasPerintah: "usr-hakim" } });
    expect([r.riwayat, r.audit, r.auditTipe]).toEqual([1, 1, 1]);
    const hasil = await untukPortal(d(), ["bas.kehadiran.bunyi"]);
    expect(hasil.daftar["bas.kehadiran.bunyi"]!.map((e) => e.nilai)).toEqual([...BUNYI_KEHADIRAN, "hadir melalui telekonferensi"]);
    expect(hasil.daftar["bas.kehadiran.bunyi"]!.at(-1)!.asal).toBe("tambahan");
  });

  it("tolak dan matikan tanpa alasan 400; dengan alasan +1/+1; nyalakan +1/+1", async () => {
    const u = await usul(d(), "usr-admin", { daftar: "putusan.medan-borang", kunci: "putusan-akhir", nilai: "Status Banding", data: { penunjuk: 'select[name="status_banding"]' } });
    if (!u.ok) throw new Error(u.alasan.join("; "));
    await expect(tolak(d(), "usr-admin", { id: u.butir.id })).rejects.toMatchObject({ status: 400 });
    const t = await selisihJejak(() => tolak(d(), "usr-admin", { id: u.butir.id, alasan: "medan ini tidak ada di borang SIPP" }));
    expect(t.hasil).toMatchObject({ ok: true, butir: { keadaan: "ditolak" } });
    expect([t.riwayat, t.audit]).toEqual([1, 1]);

    await pastikanBenih(d());
    const idReskom = await idBawaan("putusan.medan-borang", "Hasil Reskom");
    await expect(matikan(d(), "usr-admin", { id: idReskom })).rejects.toMatchObject({ status: 400 });
    const m = await selisihJejak(() => matikan(d(), "usr-admin", { id: idReskom, alasan: "reskom tidak dipakai satker" }));
    expect([m.riwayat, m.audit]).toEqual([1, 1]);
    let ekstensi = await untukEkstensi(d());
    expect(ekstensi.daftar["putusan.medan-borang"]!.map((e) => e.nilai)).not.toContain("Hasil Reskom");

    await expect(nyalakan(d(), "usr-admin", { id: idReskom })).rejects.toMatchObject({ status: 400 });
    const n = await selisihJejak(() => nyalakan(d(), "usr-admin", { id: idReskom, alasan: "dipakai lagi" }));
    expect([n.riwayat, n.audit]).toEqual([1, 1]);
    ekstensi = await untukEkstensi(d());
    // Kembali di URUTAN ASLINYA, dan versi kembali sama dengan cermin murni.
    expect(ekstensi.daftar["putusan.medan-borang"]!.map(inti)).toEqual(cerminDaftar("putusan.medan-borang")!.map(inti));
  });

  it("ganti: pengganti masuk sebagai usulan versi+1; yang lama tetap berlaku sampai pengganti disahkan", async () => {
    await pastikanBenih(d());
    const idReskom = await idBawaan("putusan.medan-borang", "Hasil Reskom");
    const versiAwal = (await untukEkstensi(d())).versi;
    const g = await selisihJejak(() =>
      ganti(d(), "usr-admin", { id: idReskom, nilai: "Hasil Restoratif", data: { penunjuk: 'select[name="status_reskom"]' }, alasan: "istilah baru" })
    );
    expect([g.riwayat, g.audit]).toEqual([1, 1]);
    if (!g.hasil.ok) throw new Error(g.hasil.alasan.join("; "));
    expect(g.hasil.butir).toMatchObject({ keadaan: "usulan", versi: 2, menggantikanId: idReskom });
    expect((await untukEkstensi(d())).versi).toBe(versiAwal);

    const s = await selisihJejak(() => sahkan(d(), "usr-super", { id: g.hasil.ok ? g.hasil.butir.id : "", atasPerintah: "Ketua PA" }));
    expect([s.riwayat, s.audit]).toEqual([1, 1]);
    const ekstensi = await untukEkstensi(d());
    const nilai = ekstensi.daftar["putusan.medan-borang"]!.map((e) => e.nilai);
    expect(nilai).not.toContain("Hasil Reskom");
    expect(nilai.at(-1)).toBe("Hasil Restoratif");
    expect(ekstensi.versi).not.toBe(versiAwal);
    const lama = await d().queryOne<{ keadaan: string; aktif: number }>("SELECT keadaan, aktif FROM aleta_tipe_keluaran WHERE id = ?", [idReskom]);
    expect(lama).toMatchObject({ keadaan: "diganti" });
    expect(Number(lama?.aktif)).toBe(0);

    // Jalan kembali: yang lama tidak dapat dinyalakan selama penggantinya berlaku.
    await expect(nyalakan(d(), "usr-admin", { id: idReskom, alasan: "kembali" })).rejects.toMatchObject({ status: 409 });
    await matikan(d(), "usr-admin", { id: g.hasil.butir.id, alasan: "istilah baru dibatalkan" });
    const kembali = await nyalakan(d(), "usr-admin", { id: idReskom, alasan: "kembali ke istilah lama" });
    expect(kembali).toMatchObject({ ok: true, butir: { keadaan: "disahkan", aktif: true } });
    expect((await untukEkstensi(d())).versi).toBe(versiAwal);
  });

  it("daftar DETEKSI: sahkan tanpa hasil ukur 400, hasil tidak lulus 400, hasil lulus diterima", async () => {
    const u = await usul(d(), "usr-admin", { daftar: "putusan.padanan-jenis", kunci: "wali adhal", nilai: "wali adhal (enggan)" });
    if (!u.ok) throw new Error(u.alasan.join("; "));
    const id = u.butir.id;
    await expect(sahkan(d(), "usr-super", { id, atasPerintah: "Ketua PA" })).rejects.toMatchObject({ status: 400 });
    await d().run("UPDATE aleta_tipe_keluaran SET hasil_ukur = ? WHERE id = ?", [JSON.stringify({ jenis: "padanan", adaDiSipp: false }), id]);
    await expect(sahkan(d(), "usr-super", { id, atasPerintah: "Ketua PA" })).rejects.toMatchObject({ status: 400 });
    await d().run("UPDATE aleta_tipe_keluaran SET hasil_ukur = ? WHERE id = ?", [JSON.stringify({ jenis: "padanan", adaDiSipp: true }), id]);
    const r = await selisihJejak(() => sahkan(d(), "usr-super", { id, atasPerintah: "Ketua PA" }));
    expect(r.hasil).toMatchObject({ ok: true, butir: { keadaan: "disahkan" } });
    expect([r.riwayat, r.audit]).toEqual([1, 1]);
  });

  it("jalankanTindakan: tindakan di luar enam -> 400; 'hapus' tidak ada", async () => {
    await expect(jalankanTindakan(d(), "usr-super", { tindakan: "hapus", id: "x" })).rejects.toMatchObject({ status: 400 });
    await expect(jalankanTindakan(d(), "usr-super", { tindakan: "ukur", id: "x" })).rejects.toMatchObject({ status: 400 });
  });

  it("TIDAK ADA JALUR DELETE: seluruh daur tidak pernah menjalankan DELETE, dan modul tidak mengekspor fungsi hapus", async () => {
    const sql = pasangMataSql(d());
    await pastikanBenih(d());
    const u = await usul(d(), "usr-admin", { daftar: "bas.kehadiran.bunyi", nilai: "hadir melalui telekonferensi" });
    if (!u.ok) throw new Error(u.alasan.join("; "));
    await sahkan(d(), "usr-super", { id: u.butir.id, atasPerintah: "usr-hakim" });
    await matikan(d(), "usr-admin", { id: u.butir.id, alasan: "uji" });
    await nyalakan(d(), "usr-admin", { id: u.butir.id, alasan: "uji" });
    const g = await ganti(d(), "usr-admin", { id: u.butir.id, nilai: "hadir melalui telekonferensi dari lembaga pemasyarakatan", alasan: "uji" });
    if (!g.ok) throw new Error(g.alasan.join("; "));
    await tolak(d(), "usr-admin", { id: g.butir.id, alasan: "uji" });
    await bacaAdmin(d(), "bas");
    await untukEkstensi(d());
    // Mata SQL-nya sungguh melihat: tulisan ke tabel tipe keluaran tertangkap.
    expect(sql.some((s) => /INSERT INTO aleta_tipe_keluaran\b/.test(s))).toBe(true);
    expect(sql.some((s) => /UPDATE aleta_tipe_keluaran\b/.test(s))).toBe(true);
    expect(sql.filter((s) => /^\s*DELETE\b/i.test(s))).toEqual([]);
    expect(Object.keys(modul).filter((k) => /hapus|delete|remove|buang/i.test(k))).toEqual([]);
  });
});

// ============================================================================
describe("bacaAdmin (K4 GET)", () => {
  it("bentuk jawaban: tiap daftar golongan, bawaan terkunci di urutan cermin, riwayat terbatas 5", async () => {
    const admin = await bacaAdmin(d(), "putusan");
    expect(admin.ok).toBe(true);
    const medan = admin.daftar.find((x) => x.daftar === "putusan.medan-borang")!;
    expect(medan).toMatchObject({ golongan: "putusan", jenis: "tulis", dapatDitambah: true, bercermin: true });
    expect(medan.butir.map((b) => b.nilai)).toEqual(cerminDaftar("putusan.medan-borang")!.map((e) => e.nilai));
    expect(medan.butir.every((b) => b.asal === "bawaan" && b.berlaku && b.riwayat.length === 1)).toBe(true);
    // CERMIN_ALASAN dirangkai orkestrator sesudah Tahap 1; uji ini berlaku
    // sebelum dan sesudahnya.
    const ciri = admin.daftar.find((x) => x.daftar === "putusan.alasan.ciri")!;
    const ciriBercermin = cerminDaftar("putusan.alasan.ciri") !== null;
    expect(ciri).toMatchObject({ jenis: "deteksi", bercermin: ciriBercermin, dapatDitambah: ciriBercermin, butuhUkur: true });
    expect(ciri.butir).toHaveLength(cerminDaftar("putusan.alasan.ciri")?.length ?? 0);
    await expect(bacaAdmin(d(), "relaas")).rejects.toMatchObject({ status: 400 });
  });

  it("daftar yang cerminnya belum dirangkai menolak usulan (409) - tambahannya akan menggantikan seluruh bawaan", async () => {
    // Berlaku sebelum dan sesudah orkestrator merangkai CERMIN_ALASAN: selama
    // belum dirangkai 409, sesudahnya usulan yang sama diterima.
    const contoh = { daftar: "putusan.upaya-damai.bunyi", kunci: "gagal", nilai: "upaya damai oleh keluarga tidak berhasil" };
    if (cerminDaftar("putusan.upaya-damai.bunyi") === null) {
      await expect(usul(d(), "usr-admin", contoh)).rejects.toMatchObject({ status: 409 });
    } else {
      await expect(usul(d(), "usr-admin", contoh)).resolves.toMatchObject({ ok: true });
    }
  });
});
