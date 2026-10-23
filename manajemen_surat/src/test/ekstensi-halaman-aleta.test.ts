import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { modules } from "@/lib/mock-data";
import {
  SEMUA_ALAMAT_PINTASAN,
  susunMenuEkstensi,
} from "@/server/modules/aleta-ecourt/menu-ekstensi";

/**
 * Panel ekstensi di halaman ALETA sendiri.
 *
 * Yang dijaga: pintasan tiap jabatan menunjuk halaman yang benar-benar ada
 * dan boleh dibukanya, temanya mengikuti ALETA (bukan membawa tema sendiri),
 * dan berkas barunya benar-benar ikut ditanam dan dimuati manifest.
 */
const baca = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), "utf8");
const aletaJs = () => baca("../ekstensi-sipp/aleta.js");

describe("pintasan menurut jabatan", () => {
  it("setiap alamat pada peta pintasan benar-benar ada di daftar modul", () => {
    // Alamat yang salah ketik tidak akan berbunyi: pintasannya sekadar tidak
    // pernah tergambar, dan yang menunggu tidak tahu ada yang ditunggu.
    const hrefModul = new Set(modules.map((m) => m.href));
    for (const href of SEMUA_ALAMAT_PINTASAN) {
      expect(hrefModul.has(href), href).toBe(true);
    }
  });

  it("Super Admin mendapat pengaturan dan pembaruan; hakim tidak", () => {
    const sa = susunMenuEkstensi("super-admin").map((m) => m.href);
    expect(sa).toContain("/admin/aleta-ecourt");
    expect(sa).toContain("/admin/pembaruan-sistem");

    const hakim = susunMenuEkstensi("hakim").map((m) => m.href);
    expect(hakim).not.toContain("/admin/aleta-ecourt");
    expect(hakim).not.toContain("/admin/pembaruan-sistem");
    expect(hakim).toContain("/perkara");
  });

  it("tiap jabatan mendapat daftar yang berbeda, dan tidak ada yang kosong", () => {
    const daftar = ["ketua", "hakim", "panitera", "panitera-pengganti", "jurusita", "admin"].map((r) =>
      susunMenuEkstensi(r).map((m) => m.href).join("|")
    );
    for (const d of daftar) expect(d.length).toBeGreaterThan(0);
    expect(new Set(daftar).size).toBe(daftar.length);
  });

  it("peran yang tidak dikenal mendapat pintasan bawaan", () => {
    const hasil = susunMenuEkstensi("peran-karangan").map((m) => m.href);
    expect(hasil).toContain("/manajemen-surat");
  });

  it("peran tambahan Operator: pintasan ALETA x SIPP tidak lagi ditawarkan (belum fix, matriks peran 12 Okt), tanpa mengulang", () => {
    const tanpa = susunMenuEkstensi("jurusita").map((m) => m.href);
    const dengan = susunMenuEkstensi("jurusita", ["operator"]).map((m) => m.href);
    expect(tanpa).not.toContain("/aleta-sipp");
    // Dulu operator mendapat /aleta-sipp; kini aplikasi itu hanya Super Admin
    // (kecuali dibuka Akses Menu) - pintasannya tidak boleh menuntun ke 403.
    expect(dengan).not.toContain("/aleta-sipp");
    expect(susunMenuEkstensi("super-admin").map((m) => m.href)).toContain("/aleta-sipp");
    expect(new Set(dengan).size).toBe(dengan.length);
  });

  it("tiap pintasan membawa label dan keterangan", () => {
    for (const m of susunMenuEkstensi("panitera")) {
      expect(m.label.length).toBeGreaterThan(2);
      expect(m.keterangan.length).toBeGreaterThan(5);
    }
  });
});

describe("aleta.js: mengikuti tema ALETA dan tidak membawa temanya sendiri", () => {
  it("tema dibaca dari kelas dark pada html, dan didengar perubahannya", () => {
    const isi = aletaJs();
    expect(isi).toContain('document.documentElement.classList.contains("dark")');
    expect(isi).toContain("new MutationObserver(");
    expect(isi).toContain('attributeFilter: ["class"]');
  });

  it("warnanya disalin dari token ALETA ke token panel", () => {
    const isi = aletaJs();
    for (const token of ["--card", "--foreground", "--primary", "--border", "--muted-foreground"]) {
      expect(isi, token).toContain(`"${token}"`);
    }
    expect(isi).toContain("panel.style.setProperty(tujuan");
  });

  it("saklar temanya kembali - sebab sekarang ia saklar yang SAMA", () => {
    // 1.155.0. Dahulu tombol tema panel ini dibuang, dengan alasan yang benar
    // pada zamannya: "dua saklar untuk satu tema hanya melahirkan dua tema
    // yang berselisih" - tombol panel mengubah temaPanel, tombol ALETA
    // mengubah kelas dark, dan keduanya tidak pernah bertemu.
    //
    // Sejak keduanya disambungkan, alasan itu hilang: menekan yang mana pun
    // menggerakkan tema yang satu.
    const isi = aletaJs();
    expect(isi).toContain('kepala.querySelector(".aleta-tema")');
    expect(isi).not.toContain("tombolTema.remove()");
    // Penanda gelap milik SIPP tetap TIDAK dipasang di halaman portal: portal
    // punya peta warnanya sendiri, dan dua peta warna berebut satu halaman.
    expect(isi).toContain("temaHalaman: false");
  });

  it("tema disambungkan dua arah dengan portal LEWAT SATU PUSAT, tanpa penyamaan di tiap pemuatan", () => {
    const isi = aletaJs();
    // 23 Okt 2026: panel portal tidak lagi menyamakan portal dengan
    // chrome.storage tiap kali dibangun (itu yang membalik pilihan baru dengan
    // nilai lama) dan tidak lagi menulis chrome.storage dari pengamat kelas.
    expect(isi).not.toContain("function samakanTemaDenganPortal(");
    expect(isi).not.toContain("function mintaPortalBertema(");
    expect(isi).not.toContain("chrome.storage.local.set({ [KUNCI_TEMA_BERSAMA]");
    // Yang tersisa hanya menyalin variabel warna portal ke panel.
    expect(isi).toContain("function ikutiTemaAleta(panel)");
    // Jembatannya ada di pusat: atribut salinan yang ditulis portal diamati
    // di sana, dan permintaan ke portal berupa satu peristiwa DOM.
    const pusat = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/tema-pusat.js"), "utf8");
    expect(pusat).toContain('new akar.CustomEvent("aleta-ekstensi-tema"');
    expect(pusat).toContain('jembatan: "data-aleta-tema-salinan"');
  });

  it("portal mengikuti salinan pilihannya; peristiwa ekstensi hanya memicu pembacaan ulang", () => {
    const portal = readFileSync(path.resolve(process.cwd(), "src/lib/tema-pilihan.ts"), "utf8");
    expect(portal).toContain("window.addEventListener(PERISTIWA_EKSTENSI_TEMA, saatEkstensi)");
    expect(portal).toContain("window.removeEventListener(PERISTIWA_EKSTENSI_TEMA, saatEkstensi)");
    expect(portal).toContain('export const PERISTIWA_EKSTENSI_TEMA = "aleta-ekstensi-tema";');
    // Ekstensi lama yang hanya mengirim satu kata tetap dilayani.
    expect(portal).toContain('if (lama === "gelap" || lama === "terang") {');
    const keadaan = readFileSync(path.resolve(process.cwd(), "src/lib/app-state.tsx"), "utf8");
    expect(keadaan).toContain("mulaiTemaPortal()");
    expect(keadaan).not.toContain('document.documentElement.classList.toggle("dark", state.theme === "dark")');
  });

  it("panel yang ditutup dapat dibuka lagi tanpa memuat ulang", () => {
    // Tombol × dahulu hanya panel.remove(). Sesudah itu tidak ada satu pun
    // jalan kembali: berkas ini dijalankan sekali, pasangPortal() hanya
    // dipanggil lagi ketika ALAMATNYA berpindah, dan portal yang sedang dibaca
    // orang tidak berpindah alamat.
    const isi = aletaJs();
    expect(isi).toContain("saatTutup: () => tutupPanel(),");
    expect(isi).toContain("function tutupPanel()");
    expect(isi).toContain("chrome.storage.local.set({ aktif: false })");
    // Dan saklar itu didengarkan di sini - tanpa pendengarnya, mencentangnya
    // kembali hanya berlaku pada halaman yang dibuka SESUDAHNYA.
    expect(isi).toContain("if (tempat !== \"local\" || !ubah.aktif) return;");
    expect(isi).toContain("void pasangPortal();");
  });

  it("diam di halaman masuk, dan mengejar perpindahan halaman Next.js", () => {
    const isi = aletaJs();
    expect(isi).toContain('"/login"');
    expect(isi).toContain("location.pathname === jalurTerakhir");
  });

  it("tidak menulis apa pun ke portal - hanya satu GET tentang dirinya sendiri", () => {
    const isi = aletaJs().replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    expect(isi).toContain("/api/aleta-ecourt/ekstensi/siapa");
    expect(isi).not.toMatch(/method:\s*"(POST|PUT|DELETE)"/);
  });
});

describe("berkasnya benar-benar dimuat dan ditanam", () => {
  it("manifest memuati halaman /aleta/* dengan panel-alat.js dan aleta.js", () => {
    const manifest = JSON.parse(baca("../ekstensi-sipp/manifest.json"));
    const entri = manifest.content_scripts.find((c: { matches: string[] }) =>
      c.matches.includes("http://192.168.10.10/aleta/*")
    );
    expect(entri).toBeTruthy();
    // checklist.js - widget checklist milestone, paling belakang.
    expect(entri.js).toEqual(["deteksi-sisa-blangko.js", "panel-alat.js", "aleta.js", "checklist.js"]);
    expect(entri.css).toEqual(["panel.css"]);
  });

  it("susun-ekstensi menanam aleta.js", () => {
    expect(baca("scripts/susun-ekstensi.mjs")).toContain('"aleta.js",');
  });

  it("konten.js mencatat perkara yang dibuka, hanya pada halaman detail", () => {
    const isi = baca("../ekstensi-sipp/konten.js");
    expect(isi).toContain("async function catatRiwayatPerkaraSipp(nomor, konteks) {");
    expect(isi).toContain("if (!nomor || !alamatHalamanPerkara()) return;");
    expect(isi).toContain("void catatRiwayatPerkaraSipp(nomor, isi.konteks);");
    // Kuncinya sama dengan yang dibaca aleta.js.
    expect(aletaJs()).toContain('"riwayatPerkaraSipp"');
    expect(isi).toContain('"riwayatPerkaraSipp"');
  });
});
