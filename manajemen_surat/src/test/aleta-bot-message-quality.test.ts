// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ALETA_BOT_VARIABLE_CATEGORY_LABELS,
  describeAletaBotVariable,
  humanizeVariableKey,
  isKnownAletaBotVariable,
  listAletaBotVariableDocs,
} from "@/lib/aleta-bot-variable-catalog";
import {
  findNotificationsOutsideSendingWindow,
  formatHoursLabel,
  listCronHours,
} from "@/lib/aleta-bot-sending-schedule";
import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import {
  ensureAletaBotSeeded,
  getAletaBotSnapshot,
  getDefaultTemplateBody,
  isReplaceableLegacyTemplateBody,
  listLegacyTemplateBodies,
  listSendingRiskPresets,
} from "@/server/modules/aleta-bot/service";

describe("Kamus variabel isi pesan", () => {
  const docs = listAletaBotVariableDocs();

  it("setiap variabel punya label, keterangan singkat, keterangan panjang, sumber, dan contoh", () => {
    expect(docs.length).toBeGreaterThan(10);
    for (const doc of docs) {
      expect(doc.key, `key kosong pada ${JSON.stringify(doc)}`).toBeTruthy();
      expect(doc.label.length, `label kosong: ${doc.key}`).toBeGreaterThan(0);
      expect(doc.shortDescription.length, `keterangan singkat kosong: ${doc.key}`).toBeGreaterThan(10);
      expect(doc.description.length, `keterangan panjang terlalu pendek: ${doc.key}`).toBeGreaterThan(40);
      expect(doc.source.length, `sumber data kosong: ${doc.key}`).toBeGreaterThan(5);
      expect(doc.example.length, `contoh kosong: ${doc.key}`).toBeGreaterThan(0);
      expect(ALETA_BOT_VARIABLE_CATEGORY_LABELS[doc.category], `kategori tak dikenal: ${doc.key}`).toBeTruthy();
    }
  });

  it("keterangan panjang lebih rinci daripada keterangan singkat", () => {
    for (const doc of docs) {
      expect(doc.description.length, doc.key).toBeGreaterThan(doc.shortDescription.length);
    }
  });

  it("label variabel tidak menampilkan nama kolom mentah", () => {
    for (const doc of docs) {
      expect(doc.label, doc.key).not.toContain("_");
      expect(doc.label, doc.key).not.toContain("{{");
    }
  });

  it("menjelaskan variabel bawaan yang dipakai isi pesan pihak dan pegawai", () => {
    for (const key of ["nama_pihak", "nomor_perkara", "ringkasan", "nama_pegawai", "jabatan"]) {
      expect(isKnownAletaBotVariable(key), key).toBe(true);
      expect(describeAletaBotVariable(key).description.length, key).toBeGreaterThan(40);
    }
  });

  it("kolom bebas dari sumber data tetap mendapat penjelasan, bukan kosong", () => {
    const doc = describeAletaBotVariable("jumlah_saksi_hadir");
    expect(isKnownAletaBotVariable("jumlah_saksi_hadir")).toBe(false);
    expect(doc.label).toBe("Jumlah Saksi Hadir");
    expect(doc.shortDescription).toContain("jumlah_saksi_hadir");
    expect(doc.description.length).toBeGreaterThan(40);
    expect(doc.source).toContain("jumlah_saksi_hadir");
  });

  it("merapikan nama kolom menjadi label yang enak dibaca", () => {
    expect(humanizeVariableKey("nomor_perkara")).toBe("Nomor Perkara");
    expect(humanizeVariableKey("sisa_panjar")).toBe("Sisa Panjar");
    expect(humanizeVariableKey("")).toBe("");
  });
});

describe("Preset Slider Risiko: jarak antar pesan", () => {
  const presets = listSendingRiskPresets();

  it("setiap tingkat menetapkan jarak antar pesan dan jeda per nomor", () => {
    for (const preset of presets) {
      expect(preset.sendingGapMinMs, `level ${preset.level}`).toBeGreaterThanOrEqual(0);
      expect(preset.sendingGapMaxMs, `level ${preset.level}`).toBeGreaterThanOrEqual(preset.sendingGapMinMs);
      expect(preset.perRecipientCooldownMs, `level ${preset.level}`).toBeGreaterThanOrEqual(0);
    }
  });

  it("tingkat lebih aman berarti jarak lebih lebar dan jeda per nomor lebih panjang", () => {
    for (let i = 1; i < presets.length; i += 1) {
      const lower = presets[i - 1];
      const higher = presets[i];
      expect(higher.sendingGapMinMs, `L${higher.level} vs L${lower.level}`).toBeLessThanOrEqual(lower.sendingGapMinMs);
      expect(higher.perRecipientCooldownMs, `L${higher.level} vs L${lower.level}`).toBeLessThanOrEqual(lower.perRecipientCooldownMs);
    }
  });

  it("Minimal benar-benar memisahkan pesan sejenis, tapi tetap muat sehari penuh", () => {
    const minimal = presets[0];
    // Harus ada jarak nyata (bukan serentak)...
    expect(minimal.sendingGapMinMs).toBeGreaterThanOrEqual(10000);
    expect(minimal.sendingGapMaxMs).toBeGreaterThan(minimal.sendingGapMinMs);

    // ...tetapi ukuran yang benar bukan lagi "jarak terpanjang harus pendek".
    // Irama campuran memang SENGAJA memuat jeda panjang sesekali - justru itu
    // yang membuatnya menyerupai manusia. Yang harus dijaga adalah hasil
    // akhirnya: kapasitas sehari tetap cukup untuk kebutuhan nyata.
    const profil = minimal.gapProfile;
    expect(profil, "Mode Minimal harus punya irama campuran").toBeTruthy();

    const totalBobot = profil!.reduce((jumlah, bucket) => jumlah + bucket.weight, 0);
    const rataGapMs =
      profil!.reduce((jumlah, bucket) => jumlah + bucket.weight * ((bucket.minMs + bucket.maxMs) / 2), 0) / totalBobot;

    const jamKirim =
      Number(minimal.sendingWindowEnd.split(":")[0]) - Number(minimal.sendingWindowStart.split(":")[0]);
    const kapasitasHarian = Math.floor((jamKirim * 3600000) / rataGapMs);

    // Kebutuhan nyata PA Donggala 100-200 pesan per hari pada hari tersibuk.
    expect(kapasitasHarian, "kapasitas harian Mode Minimal").toBeGreaterThanOrEqual(220);
    // Kapasitas yang jauh berlebihan berarti iramanya kembali rapat dan
    // kehilangan gunanya sebagai penyamaran.
    expect(kapasitasHarian, "kapasitas harian Mode Minimal").toBeLessThan(400);

    // Kelompok tercepat tetap menjaga pesan sejenis tidak berangkat serentak.
    const tercepat = Math.min(...profil!.map((bucket) => bucket.minMs));
    expect(tercepat).toBeGreaterThanOrEqual(15000);
  });

  it("batas per menit/jam berada DI ATAS laju yang dihasilkan jarak, jadi berperan sebagai rem darurat", () => {
    // Laju kirim bisa berasal dari DUA jalur: gapProfile (irama campuran, jalur
    // normal) dan sendingGapMin/MaxMs (jalur cadangan bila profilnya tidak
    // termuat, mis. server masih memakai runtime config lama sesaat setelah
    // pembaruan). Keduanya harus berada di bawah rem, karena batas yang
    // terlampaui membuat pesan DIBUANG - bukan ditunda.
    const rataGapProfilMs = (preset: (typeof presets)[number]) => {
      if (!preset.gapProfile || preset.gapProfile.length === 0) return null;
      const totalBobot = preset.gapProfile.reduce((jumlah, bucket) => jumlah + bucket.weight, 0);
      if (totalBobot <= 0) return null;
      return (
        preset.gapProfile.reduce((jumlah, bucket) => jumlah + bucket.weight * ((bucket.minMs + bucket.maxMs) / 2), 0) /
        totalBobot
      );
    };

    for (const preset of presets) {
      if (preset.sendingGapMinMs === 0) continue;
      const jalur: Array<[string, number]> = [["cadangan", (preset.sendingGapMinMs + preset.sendingGapMaxMs) / 2]];
      const rataProfil = rataGapProfilMs(preset);
      if (rataProfil !== null) jalur.push(["irama", rataProfil]);

      for (const [nama, rataGapMs] of jalur) {
        expect(preset.maxPerMinute, `level ${preset.level} batas menit (${nama})`).toBeGreaterThanOrEqual(
          60000 / rataGapMs
        );
        expect(preset.maxPerHour, `level ${preset.level} batas jam (${nama})`).toBeGreaterThanOrEqual(
          3600000 / rataGapMs
        );
      }
    }
  });

  it("rentang cadangan tidak jauh lebih cepat daripada irama campuran", () => {
    // Kalau cadangannya jauh lebih cepat, kegagalan memuat gapProfile berubah
    // dari "irama kembali seperti dulu" menjadi "pesan mulai dibuang".
    for (const preset of presets) {
      if (!preset.gapProfile || preset.gapProfile.length === 0) continue;
      const totalBobot = preset.gapProfile.reduce((jumlah, bucket) => jumlah + bucket.weight, 0);
      const rataProfil =
        preset.gapProfile.reduce((jumlah, bucket) => jumlah + bucket.weight * ((bucket.minMs + bucket.maxMs) / 2), 0) /
        totalBobot;
      const rataCadangan = (preset.sendingGapMinMs + preset.sendingGapMaxMs) / 2;
      expect(rataCadangan, `level ${preset.level}`).toBeGreaterThan(rataProfil * 0.7);
    }
  });

  it("jam kirim tidak pernah mencakup tengah malam", () => {
    for (const preset of presets) {
      const startHour = Number(preset.sendingWindowStart.split(":")[0]);
      const endHour = Number(preset.sendingWindowEnd.split(":")[0]);
      expect(startHour, `level ${preset.level}`).toBeGreaterThanOrEqual(6);
      expect(endHour, `level ${preset.level}`).toBeLessThanOrEqual(22);
      expect(startHour, `level ${preset.level}`).toBeLessThan(endHour);
    }
  });
});

describe("Peringatan jadwal notifikasi di luar jam kirim", () => {
  const buatNotifikasi = (id: string, cron: string, isActive = true) => ({
    id,
    name: `Notifikasi ${id}`,
    isActive,
    scheduleConfig: { type: "cron", cron },
  });

  it("membaca jam dari berbagai bentuk penulisan cron", () => {
    expect(listCronHours("00 19 * * *")).toEqual([19]);
    expect(listCronHours("30 14 * * Monday-Thursday")).toEqual([14]);
    expect(listCronHours("0 8,12,19 * * *")).toEqual([8, 12, 19]);
    expect(listCronHours("0 8-10 * * *")).toEqual([8, 9, 10]);
    expect(listCronHours("0 */6 * * *")).toEqual([0, 6, 12, 18]);
    expect(listCronHours("0 7 * * *;0 21 * * *")).toEqual([7, 21]);
  });

  it("mengabaikan cron yang tidak dapat dibaca, bukan menebak", () => {
    expect(listCronHours("")).toEqual([]);
    expect(listCronHours("bukan cron")).toEqual([]);
    expect(listCronHours("0 abc * * *")).toEqual([]);
    expect(listCronHours("0 99 * * *")).toEqual([]);
  });

  it("menandai notifikasi malam saat jam kirim hanya jam kerja", () => {
    const warnings = findNotificationsOutsideSendingWindow(
      [
        buatNotifikasi("sisa-panjar", "00 19 * * *"),
        buatNotifikasi("kasir-harian", "30 14 * * Monday-Thursday"),
        buatNotifikasi("pagi", "10 07 * * *"),
      ],
      "08:00",
      "16:00"
    );

    expect(warnings.map((item) => item.notificationId).sort()).toEqual(["pagi", "sisa-panjar"]);
    expect(warnings.find((item) => item.notificationId === "sisa-panjar")?.outsideHours).toEqual([19]);
  });

  it("tidak memperingatkan bila jam kirim sudah mencakup jadwalnya", () => {
    const warnings = findNotificationsOutsideSendingWindow(
      [buatNotifikasi("sisa-panjar", "00 19 * * *")],
      "06:00",
      "22:00"
    );
    expect(warnings).toEqual([]);
  });

  it("hanya memeriksa notifikasi aktif berjadwal cron", () => {
    const warnings = findNotificationsOutsideSendingWindow(
      [
        buatNotifikasi("nonaktif", "00 23 * * *", false),
        { id: "manual", name: "Manual", isActive: true, scheduleConfig: { type: "manual", cron: "" } },
        { id: "event", name: "Event", isActive: true, scheduleConfig: { type: "event", cron: "00 23 * * *" } },
      ],
      "08:00",
      "16:00"
    );
    expect(warnings).toEqual([]);
  });

  it("menampilkan jam dalam bentuk yang dibaca admin", () => {
    expect(formatHoursLabel([19])).toBe("19:00");
    expect(formatHoursLabel([7, 21])).toBe("07:00, 21:00");
  });

  it("setiap preset risiko dapat diperiksa terhadap jadwal notifikasi bawaan", () => {
    // Pada tingkat paling longgar, jadwal notifikasi bawaan pukul 07:00-19:00
    // seharusnya sudah tercakup jam kirim.
    const maksimal = listSendingRiskPresets()[4];
    const warnings = findNotificationsOutsideSendingWindow(
      [buatNotifikasi("pagi", "10 07 * * *"), buatNotifikasi("sore", "00 19 * * *")],
      maksimal.sendingWindowStart,
      maksimal.sendingWindowEnd
    );
    expect(warnings).toEqual([]);
  });
});

describe("Isi pesan pegawai", () => {
  let db: AletaDatabase | null = null;
  const previousRuntimeMode = process.env.WHATSAPP_RUNTIME_MODE;

  const EMPLOYEE_TEMPLATE_IDS = [
    "pegawai-monitoring",
    "pegawai-monitoring-ringkas",
    "hakim-jadwal-tugas-sidang",
    "kepaniteraan-monitoring-perkara",
    "kesekretariatan-info-internal",
    "disposition-deadline-h-minus-1",
  ];

  beforeAll(async () => {
    process.env.WHATSAPP_RUNTIME_MODE = "disabled";
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  }, 120000);

  afterAll(async () => {
    await db?.close();
    db = null;
    if (previousRuntimeMode === undefined) {
      delete process.env.WHATSAPP_RUNTIME_MODE;
    } else {
      process.env.WHATSAPP_RUNTIME_MODE = previousRuntimeMode;
    }
  });

  it("tidak lagi memperkenalkan diri sebagai bot ke pegawai", async () => {
    const snapshot = await getAletaBotSnapshot(db!, "usr-super");
    const employeeTemplates = snapshot.templates.filter((template) => EMPLOYEE_TEMPLATE_IDS.includes(template.id));
    expect(employeeTemplates.length).toBe(EMPLOYEE_TEMPLATE_IDS.length);

    for (const template of employeeTemplates) {
      expect(template.body, template.id).not.toMatch(/saya Aleta/i);
      expect(template.body, template.id).not.toMatch(/Bot Pengadilan/i);
      expect(template.body, template.id).not.toMatch(/ALETA Bot/i);
    }
  }, 90000);

  it("menyebut nama dan jabatan pegawai di awal pesan", async () => {
    const snapshot = await getAletaBotSnapshot(db!, "usr-super");
    for (const id of EMPLOYEE_TEMPLATE_IDS) {
      const template = snapshot.templates.find((item) => item.id === id);
      expect(template, id).toBeTruthy();
      const body = template!.body;
      expect(body, id).toContain("{{nama_pegawai}}");
      expect(body, id).toContain("{{jabatan}}");
      // Nama & jabatan harus berada di baris pertama, bukan di tengah pesan.
      const firstLine = body.split("\n")[0];
      expect(firstLine, `${id} baris pertama`).toContain("{{nama_pegawai}}");
      expect(firstLine, `${id} baris pertama`).toContain("{{jabatan}}");
      expect(template!.placeholders, id).toContain("jabatan");
    }
  }, 90000);

  it("nama pegawai ditulis polos, tanpa penanda tebal", async () => {
    const snapshot = await getAletaBotSnapshot(db!, "usr-super");
    for (const id of EMPLOYEE_TEMPLATE_IDS) {
      const body = snapshot.templates.find((item) => item.id === id)!.body;
      expect(body, `${id} masih menebalkan nama pegawai`).not.toContain("*{{nama_pegawai}}*");
      expect(body, id).toContain("{{nama_pegawai}}");
      // Baris sapaan tidak boleh memuat penanda tebal sama sekali.
      expect(body.split("\n")[0], `${id} baris pertama`).not.toContain("*");
    }
  }, 90000);

  it("isi pesan pegawai tetap ringkas", async () => {
    const snapshot = await getAletaBotSnapshot(db!, "usr-super");
    for (const id of EMPLOYEE_TEMPLATE_IDS) {
      const body = snapshot.templates.find((item) => item.id === id)!.body;
      expect(body.length, `${id} terlalu panjang`).toBeLessThan(400);
    }
  }, 90000);

  it("isi pesan v1.7.1 yang menebalkan nama pegawai ikut diperbarui saat update", () => {
    for (const id of EMPLOYEE_TEMPLATE_IDS) {
      const bodyBaru = getDefaultTemplateBody(id);
      expect(bodyBaru, id).toBeTruthy();
      // Bentuk v1.7.1 = bawaan sekarang dengan nama pegawai ditebalkan.
      const bodyV171 = bodyBaru!.replace("{{nama_pegawai}} —", "*{{nama_pegawai}}* —");
      expect(bodyV171, `${id} tidak berubah`).not.toBe(bodyBaru);
      expect(isReplaceableLegacyTemplateBody(id, bodyV171), `${id} belum terdaftar sebagai bawaan lama`).toBe(true);
    }
  });

  it("sapaan lama 'saya Aleta' terdaftar sebagai bawaan lama, sehingga ikut diperbarui saat update", () => {
    // Persis isi pesan yang saat ini terpasang di server produksi.
    const bodyTerpasang = "*_Hai {{nama_pegawai}}, saya Aleta, berikut data keadaan perkara :_*\n\n*{{judul_notifikasi}}*\n\n{{ringkasan}}";
    expect(isReplaceableLegacyTemplateBody("pegawai-monitoring", bodyTerpasang)).toBe(true);

    const bodyBaru = getDefaultTemplateBody("pegawai-monitoring");
    expect(bodyBaru).toBeTruthy();
    expect(bodyBaru).not.toContain("saya Aleta");
    expect(bodyBaru).toContain("{{jabatan}}");
  });

  it("semua bawaan lama isi pesan pegawai terdaftar, tidak ada yang tertinggal", () => {
    for (const id of EMPLOYEE_TEMPLATE_IDS) {
      const legacyBodies = listLegacyTemplateBodies(id);
      expect(legacyBodies.length, `${id} tidak punya daftar bawaan lama`).toBeGreaterThan(0);
      for (const body of legacyBodies) {
        expect(isReplaceableLegacyTemplateBody(id, body), `${id}: ${body.slice(0, 40)}`).toBe(true);
      }
      // Bawaan baru tidak boleh ikut terdaftar sebagai "lama", agar update
      // berikutnya tidak menimpa isi pesan yang sudah benar berulang kali.
      const bodyBaru = getDefaultTemplateBody(id);
      expect(legacyBodies, `${id} bawaan baru ikut terdaftar sebagai lama`).not.toContain(bodyBaru);
    }
  });

  it("isi pesan yang sudah diubah sendiri oleh admin TIDAK ditimpa saat update", () => {
    const bodyBuatanAdmin = "Halo {{nama_pegawai}}, ini isi pesan khusus buatan admin.\n\n{{ringkasan}}";
    expect(isReplaceableLegacyTemplateBody("kesekretariatan-info-internal", bodyBuatanAdmin)).toBe(false);

    // Bahkan ubahan sekecil satu spasi pun dianggap milik admin.
    const nyarisSamaDenganBawaanLama = `${listLegacyTemplateBodies("pegawai-monitoring")[0]} `;
    expect(isReplaceableLegacyTemplateBody("pegawai-monitoring", nyarisSamaDenganBawaanLama)).toBe(false);
  });

  it("proses seed benar-benar memakai aturan penggantian bawaan lama itu", async () => {
    // Menjalankan seed pada database yang isi pesannya masih bawaan lama harus
    // menghasilkan isi pesan baru (jalur yang dipakai saat aplikasi diupdate,
    // ketika proses baru dimulai dan cache seed masih kosong).
    const dbBaru = await createAletaDatabase({ useInMemory: true, seed: false });
    try {
      await ensureAletaBotSeeded(dbBaru);
      const bodyLama = listLegacyTemplateBodies("pegawai-monitoring")[0];
      await dbBaru
        .prepare(`UPDATE aleta_bot_templates SET body = ? WHERE id = 'pegawai-monitoring'`)
        .run(bodyLama);

      const dbSegar = await createAletaDatabase({ useInMemory: true, seed: false });
      try {
        await ensureAletaBotSeeded(dbSegar);
        const hasil = await dbSegar
          .prepare(`SELECT body FROM aleta_bot_templates WHERE id = 'pegawai-monitoring'`)
          .get<{ body: string }>();
        expect(hasil?.body).toBe(getDefaultTemplateBody("pegawai-monitoring"));
        expect(hasil?.body).not.toContain("saya Aleta");
      } finally {
        await dbSegar.close();
      }
    } finally {
      await dbBaru.close();
    }
    // Batas 300 detik, bukan 120.
    //
    // Uji ini menjalankan proses seed LENGKAP dua kali pada database di memori,
    // dan pekerjaan itu sendiri memakan sekitar 43 detik bila dijalankan
    // sendirian. Batas 120 detik terlihat longgar, tetapi ketika 71 berkas uji
    // berjalan berbarengan dan berebut CPU, waktu nyatanya bisa melewati batas
    // itu - sehingga uji lulus saat diperiksa sendiri dan gagal saat suite
    // penuh dijalankan.
    //
    // Batasnya dinaikkan, BUKAN pekerjaannya yang dikurangi: menjalankan seed
    // dua kali persis itulah yang diuji di sini, yakni jalur yang dipakai saat
    // aplikasi diperbarui pada proses baru dengan cache seed masih kosong.
  }, 300000);
});
