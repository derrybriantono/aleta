// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import {
  bacaParameterRiwayat,
  bacaRiwayatPesan,
  KOLOM_URUT,
  susunPenyaringRiwayat,
} from "@/server/modules/aleta-bot/riwayat-pesan";

/**
 * Riwayat pengiriman: penyaring, pengurut, dan pembacanya.
 *
 * Yang dijaga: nama kolom urut tidak pernah datang dari permintaan, tiap
 * penyaring benar-benar menyaring pada basis data, ringkasan per status
 * dihitung atas seluruh hasil saringan (bukan halaman), dan nomor disamarkan
 * untuk yang tidak berwenang.
 */
function parameter(query: string) {
  return bacaParameterRiwayat(new URLSearchParams(query));
}

describe("parameter dan penyaring riwayat", () => {
  it("kolom urut yang tidak dikenal jatuh ke bawaan - tidak pernah masuk SQL", () => {
    const p = parameter("urut=created_at;DROP TABLE users&arah=sideways");
    expect(p.urut).toBe("createdAt");
    expect(p.arah).toBe("desc");
    const saring = susunPenyaringRiwayat(p);
    expect(saring.orderBy).toBe(`${KOLOM_URUT.createdAt} DESC`);
    expect(saring.orderBy).not.toContain("DROP");
  });

  it("kolom urut yang dikenal dipakai, dengan pengurut kedua waktu dibuat", () => {
    const saring = susunPenyaringRiwayat(parameter("urut=recipientName&arah=asc"));
    expect(saring.orderBy).toBe("n.recipient_name ASC, n.created_at DESC");
    expect(susunPenyaringRiwayat(parameter("sort=sentAt&dir=desc")).orderBy).toContain("COALESCE(n.sent_at, n.created_at) DESC");
  });

  it("rentang bawaan 7 hari; tanggal tertentu memakai batas hari berikutnya", () => {
    const bawaan = susunPenyaringRiwayat(parameter(""), new Date("2026-09-11T10:00:00Z"));
    expect(bawaan.klausa).toContain("n.created_at >= ?");
    expect(bawaan.nilai[0]).toBe("2026-09-04");
    expect(bawaan.keterangan).toContain("Waktu: 7 hari terakhir");

    const tertentu = susunPenyaringRiwayat(parameter("dateFrom=2026-09-01&dateTo=2026-09-30"));
    expect(tertentu.nilai).toEqual(["2026-09-01", "2026-10-01"]);
    expect(tertentu.keterangan).toContain("Waktu: 2026-09-01 s.d. 2026-09-30");

    const semua = susunPenyaringRiwayat(parameter("dateRange="));
    expect(semua.klausa).not.toContain("created_at");
    expect(semua.keterangan).toContain("Waktu: semua");
  });

  it("tanggal yang bukan tanggal diabaikan - termasuk yang berbentuk benar tetapi mustahil", () => {
    // Bentuk saja tidak cukup: 2026-13-45 lolos pola tetapi bukan tanggal,
    // dan batas "hari berikutnya" akan melempar saat dihitung.
    const p = parameter("dateFrom=kemarin&dateTo=2026-13-45");
    expect(p.dateFrom).toBe("");
    expect(p.dateTo).toBe("");
    expect(p.dateRange).toBe("7d");

    // Tanggal yang "dibetulkan sendiri" oleh Date juga ditolak.
    expect(parameter("dateFrom=2026-02-31").dateFrom).toBe("");
    // Dan yang sah tetap lolos, termasuk 29 Februari tahun kabisat.
    expect(parameter("dateFrom=2028-02-29").dateFrom).toBe("2028-02-29");

    // Tidak ada penyaring waktu yang melempar walau isiannya sampah.
    expect(() => susunPenyaringRiwayat(parameter("dateFrom=2026-13-45&dateTo=2026-99-99"))).not.toThrow();
  });

  it("hanya-gagal mengalahkan status tunggal, dan penerima memetakan ke kategori", () => {
    const gagal = susunPenyaringRiwayat(parameter("status=success&hanyaGagal=1"));
    expect(gagal.klausa).toContain("n.status IN ('failed', 'dead_letter')");
    expect(gagal.klausa).not.toContain("n.status = ?");

    const pegawai = susunPenyaringRiwayat(parameter("penerima=pegawai"));
    expect(pegawai.klausa).toContain("n.category = 'employee'");
    expect(pegawai.nilai).toContain('%"recipientType":"employee"%');

    expect(parameter("penerima=semua").penerima).toBe("");
  });

  it("nomor WhatsApp dirapikan: hanya angka, 08 menjadi 628", () => {
    expect(parameter("nomor=0812-3456 789").nomor).toBe("628123456789");
    expect(parameter("nomor=%2B62 812").nomor).toBe("62812");
  });

  it("setiap penyaring lanjutan menambah klausa dan keterangannya", () => {
    const saring = susunPenyaringRiwayat(
      parameter("nomorPerkara=123/Pdt.G&isiPesan=panjar&notificationKey=pihak-sisa-panjar&sourceFeature=disposition&search=Budi")
    );
    expect(saring.klausa).toContain("n.message_preview LIKE ?");
    expect(saring.klausa).toContain("n.notification_id = ?");
    expect(saring.klausa).toContain("n.entity_id LIKE ?");
    expect(saring.nilai).toContain("%123/Pdt.G%");
    expect(saring.nilai).toContain("%panjar%");
    expect(saring.nilai).toContain("disposition_deadline_reminder");
    expect(saring.keterangan).toEqual(
      expect.arrayContaining([
        "Nomor perkara memuat: 123/Pdt.G",
        'Isi pesan memuat: "panjar"',
        "Kunci pesan: pihak-sisa-panjar",
        "Jenis: Disposisi",
        'Cari: "Budi"',
      ])
    );
    // Jumlah tanda tanya sama dengan jumlah nilai - satu pun yang selisih
    // membuat kueri gagal atau, lebih buruk, menyaring dengan nilai yang salah.
    expect((saring.klausa.match(/\?/g) ?? []).length).toBe(saring.nilai.length);
  });
});

describe("membaca riwayat dari basis data", () => {
  let db: AletaDatabase | null = null;

  const baris = [
    { id: "abnl-t1", nama: "SITI AMINAH", nomor: "6281111111111", kategori: "party", status: "success", pesan: "Perkara 10/Pdt.G/2026/PA.Dgl sidang pertama", dibuat: "2026-09-10T02:00:00.000Z", terkirim: "2026-09-10T02:01:00.000Z", fitur: "kirim_saat_lengkap", entity: "10/Pdt.G/2026/PA.Dgl", meta: { nomorPerkara: "10/Pdt.G/2026/PA.Dgl", notificationKey: "pihak-baru-lengkap", recipientType: "party" }, galat: null },
    { id: "abnl-t2", nama: "BUDI SANTOSO", nomor: "6282222222222", kategori: "party", status: "failed", pesan: "Sisa panjar perkara 11/Pdt.G/2026/PA.Dgl", dibuat: "2026-09-09T02:00:00.000Z", terkirim: null, fitur: "party", entity: "", meta: { nomorPerkara: "11/Pdt.G/2026/PA.Dgl", notificationKey: "pihak-sisa-panjar" }, galat: "pesan_pihak_dimatikan" },
    { id: "abnl-t3", nama: "AKBAR ALI", nomor: "6283333333333", kategori: "employee", status: "simulated", pesan: "Pengingat kasir", dibuat: "2026-09-08T02:00:00.000Z", terkirim: null, fitur: "employee", entity: "", meta: { recipientType: "employee", notificationKey: "pegawai-kasir-harian" }, galat: null },
    { id: "abnl-t4", nama: "CITRA DEWI", nomor: "6284444444444", kategori: "party", status: "dead_letter", pesan: "Panggilan sidang 12/Pdt.G/2026/PA.Dgl", dibuat: "2026-08-01T02:00:00.000Z", terkirim: null, fitur: "party", entity: "", meta: {}, galat: "invalid number" },
  ];

  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    for (const satu of baris) {
      await db
        .prepare(
          `INSERT INTO aleta_bot_notification_logs (
            id, notification_id, query_id, recipient_number, recipient_name, category,
            message_preview, status, error_message, source_app, source_feature, entity_type, entity_id, metadata_json,
            sent_at, created_at
          ) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, 'aleta_bot', ?, ?, ?, ?, ?, ?)`
        )
        .run(
          satu.id,
          satu.nomor,
          satu.nama,
          satu.kategori,
          satu.pesan,
          satu.status,
          satu.galat,
          satu.fitur,
          satu.entity ? "perkara" : "",
          satu.entity,
          JSON.stringify(satu.meta),
          satu.terkirim,
          satu.dibuat
        );
    }
  }, 120000);

  afterAll(async () => {
    await db?.close();
    db = null;
  });

  const baca = (query: string, isPrivileged = true, limit = 50, offset = 0) =>
    bacaRiwayatPesan(db!, parameter(query), { isPrivileged, limit, offset });

  it("tanpa penyaring waktu: seluruh baris, urut terbaru dulu, dengan ringkasan per status", async () => {
    const hasil = await baca("dateRange=");
    const id = hasil.items.map((item) => item.id);
    expect(id).toEqual(expect.arrayContaining(["abnl-t1", "abnl-t2", "abnl-t3", "abnl-t4"]));
    expect(id.indexOf("abnl-t1")).toBeLessThan(id.indexOf("abnl-t4"));
    expect(hasil.total).toBeGreaterThanOrEqual(4);
    expect(hasil.ringkasan.perStatus.success).toBeGreaterThanOrEqual(1);
    expect(hasil.ringkasan.gagal).toBeGreaterThanOrEqual(2);
    expect(hasil.ringkasan.simulasi).toBeGreaterThanOrEqual(1);
  });

  it("urut naik menurut nama penerima", async () => {
    const hasil = await baca("dateRange=&urut=recipientName&arah=asc");
    const nama = hasil.items.filter((i) => i.id.startsWith("abnl-t")).map((i) => i.recipientName);
    expect(nama).toEqual([...nama].sort((a, b) => a.localeCompare(b)));
  });

  it("ringkasan dihitung atas seluruh saringan walau halamannya satu baris", async () => {
    const hasil = await baca("dateRange=", true, 1, 0);
    expect(hasil.items.length).toBe(1);
    expect(hasil.total).toBeGreaterThanOrEqual(4);
  });

  it("nomor perkara menyaring lewat metadata maupun isi pesan", async () => {
    const lewatMeta = await baca("dateRange=&nomorPerkara=11/Pdt.G");
    expect(lewatMeta.items.map((i) => i.id)).toEqual(["abnl-t2"]);
    const lewatIsi = await baca("dateRange=&nomorPerkara=12/Pdt.G");
    expect(lewatIsi.items.map((i) => i.id)).toEqual(["abnl-t4"]);
  });

  it("hanya-gagal, penerima, kunci pesan, dan tanggal tertentu", async () => {
    expect((await baca("dateRange=&hanyaGagal=1")).items.map((i) => i.id).sort()).toEqual(["abnl-t2", "abnl-t4"]);
    expect((await baca("dateRange=&penerima=pegawai")).items.map((i) => i.id)).toEqual(["abnl-t3"]);
    expect((await baca("dateRange=&notificationKey=pihak-baru-lengkap")).items.map((i) => i.id)).toEqual(["abnl-t1"]);
    expect((await baca("dateFrom=2026-09-09&dateTo=2026-09-09")).items.map((i) => i.id)).toEqual(["abnl-t2"]);
  });

  it("butir menyebut penerima, kunci, dan keterangan galat yang manusiawi", async () => {
    const hasil = await baca("dateRange=&notificationKey=pihak-sisa-panjar");
    const butir = hasil.items[0];
    expect(butir.penerima).toBe("pihak");
    expect(butir.notificationKey).toBe("pihak-sisa-panjar");
    expect(butir.caseOrPosition).toBe("11/Pdt.G/2026/PA.Dgl");
    expect(butir.errorMessage).toBe("Jenis pesan ini sedang dimatikan dari saklar per pesan.");
  });

  it("nomor disamarkan dan isi pesan disembunyikan untuk yang tidak berwenang", async () => {
    const hasil = await baca("dateRange=&notificationKey=pihak-baru-lengkap", false);
    expect(hasil.items[0].recipientNumber).toBe("628****1111");
    expect(hasil.items[0].recipientNumberMasked).toBe(true);
    expect(hasil.items[0].messageBody).toBeNull();
  });
});
