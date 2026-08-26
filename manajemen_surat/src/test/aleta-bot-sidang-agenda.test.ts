// @vitest-environment node

/**
 * Penyaringan agenda pada pengingat sidang (Usulan 07 dan 13).
 *
 * Yang diuji di sini bukan penerjemahan agendanya - itu diperiksa oleh
 * aleta_bot/scripts/verify-sidang-agenda.js - melainkan apakah penandaan tahap
 * agenda benar-benar SAMPAI ke instalasi yang sudah berjalan. Notifikasi
 * disimpan dengan ON CONFLICT DO NOTHING, sehingga server produksi yang sudah
 * pernah di-seed tidak pernah menerima kolom baru dari pembaruan aplikasi.
 * Tanpa penyisipan terarah, penyaringan agenda hanya bekerja di pemasangan baru.
 */

import { describe, expect, it } from "vitest";

import { listAletaBotVariableDocs } from "@/lib/aleta-bot-variable-catalog";
import { findNotificationsOutsideSendingWindow, listCronHours } from "@/lib/aleta-bot-sending-schedule";
import {
  getAletaBotDefaultNotification,
  getDefaultTemplateBody,
  isReplaceableLegacyTemplateBody,
  listSendingRiskPresets,
  mergeAgendaStageIntoScheduleConfig,
} from "@/server/modules/aleta-bot/service";

describe("Penyisipan tahap agenda ke jadwal tersimpan", () => {
  it("menambahkan tahap agenda pada notifikasi lama", () => {
    const tersimpan = JSON.stringify({ type: "cron", cron: "00 09 * * *", trigger: "cron pagi" });
    const hasil = mergeAgendaStageIntoScheduleConfig(tersimpan, "h3");
    expect(hasil).not.toBeNull();
    expect(JSON.parse(hasil as string)).toEqual({
      type: "cron",
      cron: "00 09 * * *",
      trigger: "cron pagi",
      agendaStage: "h3",
    });
  });

  it("tidak mengembalikan jam cron yang sudah disesuaikan admin", () => {
    // Admin memindahkan pengiriman ke pukul 10:30. Pembaruan aplikasi tidak
    // boleh diam-diam mengembalikannya ke bawaan.
    const tersimpan = JSON.stringify({ type: "cron", cron: "30 10 * * *", trigger: "cron pagi" });
    const hasil = mergeAgendaStageIntoScheduleConfig(tersimpan, "h3");
    expect(JSON.parse(hasil as string).cron).toBe("30 10 * * *");
  });

  it("menghormati nilai yang sudah ada, termasuk yang sengaja dikosongkan admin", () => {
    const sudahAda = JSON.stringify({ type: "cron", cron: "00 09 * * *", agendaStage: "h1" });
    expect(mergeAgendaStageIntoScheduleConfig(sudahAda, "h3")).toBeNull();

    // Admin mengosongkan tahap agenda untuk mematikan penyaringan. Pembaruan
    // aplikasi tidak boleh menyalakannya kembali tanpa sepengetahuan mereka.
    const dikosongkan = JSON.stringify({ type: "cron", cron: "00 09 * * *", agendaStage: "" });
    expect(mergeAgendaStageIntoScheduleConfig(dikosongkan, "h3")).toBeNull();
  });

  it("membiarkan data rusak apa adanya, bukan menimpanya", () => {
    expect(mergeAgendaStageIntoScheduleConfig("{bukan json", "h3")).toBeNull();
    expect(mergeAgendaStageIntoScheduleConfig("[1,2,3]", "h3")).toBeNull();
    expect(mergeAgendaStageIntoScheduleConfig("null", "h3")).toBeNull();
  });

  it("tidak mengarang jadwal untuk baris yang belum punya pengaturan", () => {
    // Menebak jam kirim notifikasi ke pihak jauh lebih berbahaya daripada
    // membiarkan barisnya tidak tersentuh.
    expect(mergeAgendaStageIntoScheduleConfig(null, "h3")).toBeNull();
    expect(mergeAgendaStageIntoScheduleConfig("", "h3")).toBeNull();
    expect(mergeAgendaStageIntoScheduleConfig("   ", "h3")).toBeNull();
  });

  it("tidak melakukan apa pun bila tahap agenda tidak ditentukan", () => {
    const tersimpan = JSON.stringify({ type: "cron", cron: "00 09 * * *" });
    expect(mergeAgendaStageIntoScheduleConfig(tersimpan, "")).toBeNull();
  });
});

describe("Isi pesan pengingat sidang", () => {
  it("isi pesan jadwal sidang memakai variabel persiapan", () => {
    const body = getDefaultTemplateBody("jadwal-sidang");
    expect(body).toContain("{{persiapan_sidang}}");
  });

  it("pengingat H-1 punya isi pesan sendiri dan lebih pendek daripada H-3", () => {
    const h1 = getDefaultTemplateBody("pihak-sidang-h1");
    const h3 = getDefaultTemplateBody("jadwal-sidang");
    expect(h1).toBeTruthy();
    expect(h1).toContain("{{persiapan_sidang}}");
    // Penjelasan panjang sudah disampaikan pada H-3. Mengulanginya utuh membuat
    // pesan penting terlihat seperti pesan berulang.
    expect((h1 as string).length).toBeLessThan((h3 as string).length);
  });

  it("isi pesan jadwal sidang versi lama ikut diperbarui di instalasi berjalan", () => {
    const versiLama =
      "Assalamualaikum Warahmatullahi Wabarakatuh,\n\nHalo, saya Aleta, Bot Pengadilan.\n\nDetail Sidang Perkara:\n- Nama: Sdr/Sdri *{{nama_pihak}}*\n- Nomor Perkara: *{{nomor_perkara}}*\n\n{{ringkasan}}\n\nInformasi Tambahan:\n- Pesan ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi sebelumnya disampaikan oleh Jurusita/Petugas Pos.\n- Untuk daftar antrian online, ikuti petunjuk yang tercantum pada informasi perkara apabila tersedia.\n- Info lebih lanjut, ketik \"perkara\" atau hubungi WhatsApp: *0822-7111-5021*.";
    expect(isReplaceableLegacyTemplateBody("jadwal-sidang", versiLama)).toBe(true);
  });

  it("isi pesan yang sudah disunting admin tidak pernah ditimpa", () => {
    const disuntingAdmin =
      "Assalamualaikum Warahmatullahi Wabarakatuh,\n\nHalo, saya Aleta, Bot Pengadilan Agama Donggala.\n\n{{ringkasan}}";
    expect(isReplaceableLegacyTemplateBody("jadwal-sidang", disuntingAdmin)).toBe(false);
  });
});

describe("Jam kirim pengingat H-1", () => {
  it("berada di dalam jendela kirim mode paling ketat sekalipun", () => {
    const h1 = getAletaBotDefaultNotification("pihak-sebelum-sidang-h1");
    expect(h1).toBeTruthy();

    // Preset risiko paling ketat menutup jendela kirim paling awal. Pengingat
    // H-1 yang jatuh di luar jendela TIDAK dibatalkan, melainkan digeser ke
    // pembukaan jendela berikutnya - yaitu pagi hari sidang itu sendiri, saat
    // pihak mungkin sudah berangkat. Pengingat H-1 yang tiba pada hari-H bukan
    // lagi pengingat H-1.
    const presetTerketat = listSendingRiskPresets().reduce((paling, preset) =>
      preset.sendingWindowEnd < paling.sendingWindowEnd ? preset : paling
    );

    // Perbandingan sengaja dilakukan per MENIT, bukan per jam.
    // findNotificationsOutsideSendingWindow hanya membaca jam, sehingga jadwal
    // 16:30 dianggapnya masih berada di dalam jendela yang berakhir 16:00 -
    // padahal sendingPaceService di bot menggesernya ke hari berikutnya.
    const keMenit = (jam: string) => {
      const [j, m] = jam.split(":").map(Number);
      return j * 60 + (m || 0);
    };
    const [menitCron, jamCron] = h1!.scheduleConfig.cron.split(" ").map(Number);
    const waktuKirim = jamCron * 60 + menitCron;

    expect(
      waktuKirim,
      `pengingat H-1 (${h1!.scheduleConfig.cron}) jatuh di luar jendela ${presetTerketat.sendingWindowStart}-${presetTerketat.sendingWindowEnd} dan akan tergeser ke pagi hari sidang`
    ).toBeGreaterThanOrEqual(keMenit(presetTerketat.sendingWindowStart));
    expect(
      waktuKirim,
      `pengingat H-1 (${h1!.scheduleConfig.cron}) jatuh di luar jendela ${presetTerketat.sendingWindowStart}-${presetTerketat.sendingWindowEnd} dan akan tergeser ke pagi hari sidang`
    ).toBeLessThanOrEqual(keMenit(presetTerketat.sendingWindowEnd));

    // Pemeriksa portal tetap dijalankan supaya pelanggaran tingkat jam pun
    // ikut tertangkap bila jadwalnya kelak diubah jauh.
    const diLuar = findNotificationsOutsideSendingWindow(
      // isActive dipaksa true: pemeriksa melewati notifikasi yang tidak aktif,
      // sedangkan yang diuji di sini jadwalnya - supaya sudah benar pada saat
      // admin menyalakannya nanti.
      [{ id: h1!.id, name: h1!.name, isActive: true, scheduleConfig: { type: "cron", cron: h1!.scheduleConfig.cron } }],
      presetTerketat.sendingWindowStart,
      presetTerketat.sendingWindowEnd
    );
    expect(diLuar).toEqual([]);
  });

  it("dikirim sore hari, bukan pagi atau malam", () => {
    const h1 = getAletaBotDefaultNotification("pihak-sebelum-sidang-h1");
    const jam = listCronHours(h1!.scheduleConfig.cron);
    expect(jam.every((item) => item >= 13 && item <= 17)).toBe(true);
  });

  it("menyaring agenda pada tahap yang benar", () => {
    expect(getAletaBotDefaultNotification("pihak-sebelum-sidang-h1")?.scheduleConfig.agendaStage).toBe("h1");
    expect(getAletaBotDefaultNotification("pihak-sebelum-sidang")?.scheduleConfig.agendaStage).toBe("h3");
  });

  it("pengingat H-1 tidak membawa lampiran dokumen", () => {
    // Kueri H-1 ikut mengambil petitum_dok. Tanpa penegasan, pengingat pendek
    // akan membawa PDF petitum dan menjadi berat tanpa alasan.
    expect(getAletaBotDefaultNotification("pihak-sebelum-sidang-h1")?.attachDocument).toBe(false);
  });
});

describe("Kamus variabel", () => {
  it("persiapan sidang dijelaskan lengkap untuk admin", () => {
    const doc = listAletaBotVariableDocs().find((item) => item.key === "persiapan_sidang");
    expect(doc).toBeTruthy();
    expect(doc?.audience).toBe("pihak");
    expect(doc?.category).toBe("jadwal");
    // Contohnya harus berupa hasil nyata, bukan keterangan tentang variabelnya.
    expect(doc?.example).toContain("saksi");
  });

  it("tidak ada variabel yang menyediakan nama hakim, panitera, atau jurusita", () => {
    // Nama pegawai dilarang disampaikan ke pihak demi keamanan mereka.
    // Penjagaan ini mencegah variabel semacam itu masuk lewat pembaruan
    // berikutnya tanpa disadari.
    const terlarang = /hakim|panitera|jurusita|majelis/i;
    const bermasalah = listAletaBotVariableDocs().filter(
      (item) => item.audience === "pihak" && terlarang.test(item.key)
    );
    expect(bermasalah.map((item) => item.key)).toEqual([]);
  });
});
