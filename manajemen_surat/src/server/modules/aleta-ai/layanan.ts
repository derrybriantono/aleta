import { KELOMPOK_PUTUSAN, bolehPakaiRute, tabelRuteDari } from "@/lib/aleta-ai/rute";
import type { AletaDatabase } from "@/server/db/client";
import type { PelakuAi } from "@/server/modules/aleta-ai/akses";
import { ambilKlienAi, statusKunciAi } from "@/server/modules/aleta-ai/klien";
import { kursBerlaku, kursTersimpanTerakhir, segarkanKursBilaPerlu, type PengambilKurs } from "@/server/modules/aleta-ai/kurs";
import { bacaKuotaPeran, pastikanKuotaBulanIni } from "@/server/modules/aleta-ai/kuota";
import { PESAN_NONAKTIF_KUNCI, PESAN_NONAKTIF_PROYEK, PESAN_NONAKTIF_SAKLAR } from "@/server/modules/aleta-ai/mesin";
import { bacaPengaturan, bacaRute, bacaTarif } from "@/server/modules/aleta-ai/pengaturan";
import { proyekAktif } from "@/server/modules/aleta-ai/proyek";
import { daftarMutasi, saldoPengguna } from "@/server/modules/aleta-ai/saldo";

/**
 * Bacaan ringkas untuk layar ALETA Ai: status, saldo, tombol pemicu, dan
 * tampilan pengaturan Super Admin. Tidak pernah memuat kunci API (hanya
 * "terpasang atau tidak") atau isi percakapan.
 */

export type RingkasAi = {
  aktif: boolean;
  alasanNonaktif?: string;
  saldoRp: number;
  /** Tahap 4: saldo di bawah ambang pengaturan (bukan Super Admin). */
  saldoMenipis: boolean;
  ambangSaldoMenipisRp: number;
  superAdmin: boolean;
  pemicu: Array<{ kode: string; label: string; kelompok: string; mode: string; grup: string }>;
  proyekVersi: number;
};

export async function ringkasAi(db: AletaDatabase, pelaku: PelakuAi): Promise<RingkasAi> {
  const pengaturan = await bacaPengaturan(db);
  const proyek = await proyekAktif(db);
  const adaKlien = Boolean(await ambilKlienAi(db));
  const alasan = !pengaturan.aktif ? PESAN_NONAKTIF_SAKLAR : !adaKlien ? PESAN_NONAKTIF_KUNCI : !proyek ? PESAN_NONAKTIF_PROYEK : undefined;

  const tabel = tabelRuteDari(await bacaRute(db));
  const pemicu = (proyek?.menu ?? [])
    .filter((p) => {
      const rute = tabel.get(p.kelompok);
      // Draf putusan tidak ditawarkan kepada peran yang tidak berhak.
      return !(p.kelompok === KELOMPOK_PUTUSAN && rute && !bolehPakaiRute(rute, pelaku.peranId));
    })
    .map((p) => ({ kode: p.kode, label: p.label, kelompok: p.grup, mode: tabel.get(p.kelompok)?.label ?? "Cepat", grup: p.grupHuruf }));

  await pastikanKuotaBulanIni(db, pelaku);
  const saldoRp = await saldoPengguna(db, pelaku.id);
  return {
    aktif: !alasan,
    ...(alasan ? { alasanNonaktif: alasan } : {}),
    saldoRp,
    saldoMenipis: !pelaku.superAdmin && pengaturan.ambangSaldoMenipisRp > 0 && saldoRp < pengaturan.ambangSaldoMenipisRp,
    ambangSaldoMenipisRp: pengaturan.ambangSaldoMenipisRp,
    superAdmin: pelaku.superAdmin,
    pemicu,
    proyekVersi: proyek?.versi ?? 0,
  };
}

export async function tampilSaldo(db: AletaDatabase, pelaku: PelakuAi) {
  const mutasi = (await daftarMutasi(db, pelaku.id, 100)).map((m) => ({ ...m, keterangan: m.catatan || m.jenis, saldoSesudahRp: m.saldoSetelah }));
  return { saldoRp: await saldoPengguna(db, pelaku.id), mutasi };
}

export async function tampilKurs(db: AletaDatabase, opsi: { segarkan?: boolean; pengambil?: PengambilKurs } = {}) {
  if (opsi.segarkan) await segarkanKursBilaPerlu(db, { pengambil: opsi.pengambil });
  const berlaku = await kursBerlaku(db);
  const tersimpan = await kursTersimpanTerakhir(db);
  const pengaturan = await bacaPengaturan(db);
  return {
    kurs: berlaku.kurs,
    tanggal: berlaku.tanggal,
    sumber: berlaku.sumber,
    basi: berlaku.basi,
    tersimpan: Boolean(tersimpan),
    penyanggaKursPersen: pengaturan.penyanggaKursPersen,
    kursDipakai: berlaku.kurs * (1 + pengaturan.penyanggaKursPersen / 100),
  };
}

export async function tampilPengaturan(db: AletaDatabase) {
  const [pengaturan, tarif, rute, kurs, kuotaPeran, kunciClaude] = await Promise.all([bacaPengaturan(db), bacaTarif(db), bacaRute(db), tampilKurs(db), bacaKuotaPeran(db), statusKunciAi(db)]);
  // `margin` dan `penyanggaKurs` = nama pendek yang sama dengan marginPersen/penyanggaKursPersen (PERSEN, 30 = 30%).
  return {
    pengaturan: { ...pengaturan, margin: pengaturan.marginPersen, penyanggaKurs: pengaturan.penyanggaKursPersen },
    tarif,
    rute,
    kurs,
    kuotaPeran,
    kunciTerpasang: kunciClaude.sumber !== "belum",
    // Asal kunci Claude (tanpa isinya): "pengaturan-ai" (+ nama koneksi) | "env" | "belum".
    kunciClaude,
  };
}
