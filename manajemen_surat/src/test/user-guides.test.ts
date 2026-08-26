import { describe, expect, it } from "vitest";

import { USER_GUIDES } from "@/lib/user-guides";

describe("user guides", () => {
  it("documents the v1.4.15 workflow without removing operational guides", () => {
    const guideIds = new Set(USER_GUIDES.map((guide) => guide.id));

    expect(guideIds).toContain("v1415-staging-public-readiness");
    expect(guideIds).toContain("feedback-panduan-v1415");
    expect(guideIds).toContain("v145-ringkasan-integrasi");
    expect(guideIds).toContain("jlf-blangko-cepat-abt");
    expect(guideIds).toContain("estatus-workflow-batch");
    expect(guideIds).toContain("integrasi-sipp-aps-badilag");
    expect(guideIds).toContain("feedback-panduan-v145");
    expect(guideIds).toContain("rekomendasi-lanjutan-v145");
    expect(guideIds).toContain("v121-e-kepegawaian-ringkasan");
    expect(guideIds).toContain("e-kepegawaian-pegawai-cuti");
    expect(guideIds).toContain("e-kepegawaian-pejabat-approval");
    expect(guideIds).toContain("e-kepegawaian-admin-settings");
    expect(guideIds).toContain("e-kepegawaian-dokumen-whatsapp");
    expect(guideIds).toContain("v113-maintenance-ringkasan");
    expect(guideIds).toContain("v112-maintenance-ringkasan");
    expect(guideIds).toContain("v111-maintenance-ringkasan");
    expect(guideIds).toContain("v110-stable-update-ringkasan");
    expect(guideIds).toContain("v100-stable-ringkasan");
    expect(guideIds).toContain("pdf-surat-upload-preview-download");
    expect(guideIds).toContain("aleta-bot-sumber-data-notifikasi-query");
    expect(guideIds).toContain("aleta-bot-laporan-whatsapp-excel");
    expect(guideIds).toContain("aleta-bot-settings-admin");
    expect(guideIds).toContain("aleta-bot-employee-whatsapp-detection");
    expect(guideIds).toContain("identitas-instansi-logo");
    expect(guideIds).toContain("lupa-password-otp-whatsapp");
    expect(guideIds).toContain("server-docker-centos7-copy-patch");
    expect(guideIds).toContain("ssh-centos7-copy-paste-patch");
    expect(guideIds).toContain("system-update-manager");
    expect(guideIds).toContain("pengaturan-panel-v110");
    expect(guideIds).toContain("akses-publik-v112");
    expect(guideIds).toContain("backup-sistem-v110");
    expect(guideIds).toContain("database-postgresql-admin-v110");
    expect(guideIds).toContain("footer-kontak-kanal-digital-v110");
    expect(guideIds).toContain("staging-server-v100");
    expect(guideIds).toContain("system-update-package-workflow");
    expect(guideIds).toContain("system-update-rollback-downgrade");
    expect(guideIds).toContain("rekomendasi-lanjutan-v121");
    expect(guideIds).toContain("rekomendasi-lanjutan-v113");
    expect(guideIds).toContain("rekomendasi-lanjutan-v112");
    expect(guideIds).toContain("rekomendasi-lanjutan-v111");
    expect(guideIds).toContain("rekomendasi-lanjutan-v110");
    expect(guideIds).toContain("rekomendasi-lanjutan-v100");

    const patchNotesGuide = USER_GUIDES.find((guide) => guide.id === "patch-notes");
    expect(patchNotesGuide?.notes).toContain("Versi terbaru adalah 1.4.15 Staging-Public Readiness.");

    const v1415Guide = USER_GUIDES.find((guide) => guide.id === "v1415-staging-public-readiness");
    expect(v1415Guide?.steps.join(" ")).toContain("/aleta/portal");
    expect(v1415Guide?.notes.join(" ")).toContain("BETTER_AUTH_SECRET");
    expect(v1415Guide?.notes.join(" ")).toContain("SAFE_READ_ONLY");

    const v145Guide = USER_GUIDES.find((guide) => guide.id === "v145-ringkasan-integrasi");
    expect(v145Guide?.steps.join(" ")).toContain("/aleta/portal");
    expect(v145Guide?.notes.join(" ")).toContain("SIPP dipakai sebagai sumber data read-only");

    const jlfGuide = USER_GUIDES.find((guide) => guide.id === "jlf-blangko-cepat-abt");
    expect(jlfGuide?.steps.join(" ")).toContain("Pdt.GS");
    expect(jlfGuide?.notes.join(" ")).toContain("AI Assist bersifat opsional");

    const estatusGuide = USER_GUIDES.find((guide) => guide.id === "estatus-workflow-batch");
    expect(estatusGuide?.steps.join(" ")).toContain("snapshot data disimpan");
    expect(estatusGuide?.notes.join(" ")).toContain("Batch final tidak diedit biasa");

    const v121Guide = USER_GUIDES.find((guide) => guide.id === "v121-e-kepegawaian-ringkasan");
    expect(v121Guide?.steps.join(" ")).toContain("/aleta/admin/e-kepegawaian");
    expect(v121Guide?.notes.join(" ")).toContain("Saldo cuti awal");

    const v113Guide = USER_GUIDES.find((guide) => guide.id === "v113-maintenance-ringkasan");
    expect(v113Guide?.steps.join(" ")).toContain("Admin > Akses Publik");
    expect(v113Guide?.notes.join(" ")).toContain("Ringkasan AI surat");

    const v111Guide = USER_GUIDES.find((guide) => guide.id === "v111-maintenance-ringkasan");
    expect(v111Guide?.steps.join(" ")).toContain("kolom Tanggal Upload");
    expect(v111Guide?.notes.join(" ")).toContain("Hapus permanen untuk Super Admin");

    const updateGuide = USER_GUIDES.find((guide) => guide.id === "system-update-manager");
    expect(updateGuide?.notes).toContain("Halaman ini hanya menampilkan status dan perintah; update tidak dijalankan langsung dari browser.");

    const packageGuide = USER_GUIDES.find((guide) => guide.id === "system-update-package-workflow");
    expect(packageGuide?.steps.join(" ")).toContain("scripts/aleta-make-update.sh 1.4.15");

    const sshGuide = USER_GUIDES.find((guide) => guide.id === "ssh-centos7-copy-paste-patch");
    expect(sshGuide?.steps.join(" ")).toContain("docker-compose build portal");
    expect(sshGuide?.steps.join(" ")).toContain("bash scripts/aleta-update.sh /root/aleta-update-1.4.15.tar.gz");
    expect(sshGuide?.notes.join(" ")).toContain("Jangan copy .env.local");
  });

  it("keeps login guidance aligned with the /aleta base path", () => {
    const loginGuide = USER_GUIDES.find((guide) => guide.id === "login");

    expect(loginGuide?.steps.join(" ")).toContain("/aleta/login");
    expect(loginGuide?.steps.join(" ")).toContain("/aleta/portal");
    expect(loginGuide?.notes.join(" ")).toContain("Session login aktif sekitar 1 jam");
    expect(loginGuide?.notes.join(" ")).toContain("SSO Single Sign On");
  });
});
