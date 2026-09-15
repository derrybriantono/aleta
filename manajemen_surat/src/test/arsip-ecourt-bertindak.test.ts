/**
 * Agen Arsip e-Court Bertindak (Tahap 5) - rencananya.
 *
 * Inilah agen pertama yang BERTINDAK, dan karena itu penjaganya sebagian besar
 * menguji kapan ia MENOLAK bertindak.
 *
 * Angka pada berkas ini diukur di peladen 15 September 2026:
 *   aleta_bot_ecourt_files  400 tercatat, 0 ada di cakram, 400 hilang.
 */
import { describe, expect, it } from "vitest";

import {
  type BerkasArsip,
  type FaktaArsip,
  BATAS_SEKALI_JALAN,
  rencanaPemulihan,
  ringkasJalan,
} from "@/lib/arsip-ecourt-bertindak";

function berkas(i: number, ubah: Partial<BerkasArsip> = {}): BerkasArsip {
  return {
    id: String(i),
    nomorPerkara: `${400 + i}/Pdt.G/2026/PA.Dgl`,
    jalurBerkas: `/usr/src/app/data/ecourt/${400 + i}/Dokumen Bukti__${i}.pdf`,
    sumberUrl: `https://ecourt.example/berkas/${i}`,
    adaDiCakram: false,
    ukuranByte: 1024,
    ...ubah,
  };
}

function fakta(ubah: Partial<FaktaArsip> = {}): FaktaArsip {
  return {
    akar: "/usr/src/app/data/ecourt",
    akarBertahan: true,
    berkas: Array.from({ length: 400 }, (_, i) => berkas(i)),
    ...ubah,
  };
}

// ============================================================================
describe("MENOLAK bertindak ketika tindakannya akan menghapus dirinya sendiri", () => {
  it("akar yang tidak bertahan: tidak satu pun berkas ditarik", () => {
    // Inilah yang sudah terjadi sekali: 400 berkas diunduh ke lapisan peti
    // sebelum volumenya dipasang, lalu musnah pada pembangunan berikutnya.
    // Agen yang tidak memeriksanya akan mengulanginya dengan lebih rajin.
    const r = rencanaPemulihan(
      fakta({ akarBertahan: false, alasanTidakBertahan: "tidak ada bind mount" })
    );
    expect(r.amanDijalankan).toBe(false);
    expect(r.tindakan).toHaveLength(0);
    expect(r.alasan).toContain("menghapus dirinya sendiri");
    expect(r.alasan).toContain("tidak ada bind mount");
    // Angkanya tetap dilaporkan - menolak bertindak bukan alasan diam.
    expect(r.hilang).toBe(400);
  });

  it("tidak ada yang hilang: juga tidak bertindak, dan mengatakannya", () => {
    const r = rencanaPemulihan(
      fakta({ berkas: [berkas(1, { adaDiCakram: true }), berkas(2, { adaDiCakram: true })] })
    );
    expect(r.amanDijalankan).toBe(false);
    expect(r.hilang).toBe(0);
    expect(r.alasan).toContain("Tidak ada yang perlu dipulihkan");
  });

  it("berkas tanpa alamat sumber tidak dijanjikan akan ditarik", () => {
    // Menyebutnya "akan ditarik" adalah janji yang pasti gagal.
    const r = rencanaPemulihan(
      fakta({ berkas: [berkas(1, { sumberUrl: "" }), berkas(2)] })
    );
    expect(r.tindakan).toHaveLength(1);
    expect(r.hilang).toBe(2);
    expect(r.alasan).toContain("tidak punya alamat sumber");
  });
});

// ============================================================================
describe("ketika memang bertindak, ia bertindak sedikit-sedikit", () => {
  it("dibatasi satu jalan, sisanya disebut", () => {
    const r = rencanaPemulihan(fakta());
    expect(r.tindakan).toHaveLength(BATAS_SEKALI_JALAN);
    expect(r.sisaSesudahIni).toBe(400 - BATAS_SEKALI_JALAN);
    expect(r.alasan).toContain(`sisa ${400 - BATAS_SEKALI_JALAN}`);
    expect(r.amanDijalankan).toBe(true);
  });

  it("keadaan peladen sungguhan: 400 tercatat, 0 ada, 400 hilang", () => {
    const r = rencanaPemulihan(fakta());
    expect(r.tercatat).toBe(400);
    expect(r.ada).toBe(0);
    expect(r.hilang).toBe(400);
  });

  it("tiap tindakan membawa tujuan dan sumbernya - tidak ada yang disimpulkan nanti", () => {
    const r = rencanaPemulihan(fakta({ berkas: [berkas(7)] }));
    expect(r.tindakan[0]).toEqual({
      id: "7",
      nomorPerkara: "407/Pdt.G/2026/PA.Dgl",
      jalurBerkas: "/usr/src/app/data/ecourt/407/Dokumen Bukti__7.pdf",
      sumberUrl: "https://ecourt.example/berkas/7",
    });
  });
});

// ============================================================================
describe("ringkasan sesudah berjalan", () => {
  it("gagal disebut berikut SEBABNYA, bukan hanya angkanya", () => {
    // Angka tanpa sebab menyuruh orang membuka log; sebab tanpa angka
    // menyembunyikan seberapa luas.
    const r = rencanaPemulihan(fakta({ berkas: Array.from({ length: 3 }, (_, i) => berkas(i)) }));
    const teks = ringkasJalan(r, {
      diminta: 3,
      berhasil: 2,
      gagal: 1,
      sebabGagal: [{ nomorPerkara: "401/Pdt.G/2026/PA.Dgl", sebab: "e-Court menjawab 403" }],
    });
    expect(teks).toContain("2 dari 3");
    expect(teks).toContain("1 gagal");
    expect(teks).toContain("401/Pdt.G/2026/PA.Dgl: e-Court menjawab 403");
  });

  it("rencana yang tidak aman meneruskan alasannya apa adanya", () => {
    const r = rencanaPemulihan(fakta({ akarBertahan: false }));
    const teks = ringkasJalan(r, { diminta: 0, berhasil: 0, gagal: 0, sebabGagal: [] });
    expect(teks).toBe(r.alasan);
  });
});

// ============================================================================
describe("yang tidak pernah dikerjakannya - dijaga pada berkasnya", () => {
  it("tidak ada penghapusan, dan tidak ada penarikan baru", () => {
    const r = rencanaPemulihan(fakta());
    // Seluruh tindakan menunjuk berkas yang SUDAH tercatat. Tidak ada satu pun
    // yang lahir dari luar catatan - itu penarikan, bukan pemulihan, dan
    // mencampur keduanya membuat "memulihkan" berarti "mengunduh apa saja".
    const idTercatat = new Set(fakta().berkas.map((b) => b.id));
    for (const t of r.tindakan) expect(idTercatat.has(t.id)).toBe(true);
  });
});
