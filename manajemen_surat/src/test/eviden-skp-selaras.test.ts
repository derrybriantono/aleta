// @vitest-environment node
import { describe, expect, it } from "vitest";

import { bacaPermintaanUnduhEvidenSkp, mulaiPeriodeEvidenSkp, PILIHAN_PERIODE_EVIDEN_SKP } from "@/lib/eviden-skp-unduh";
import { bacaPermintaanEvidenSkp, mulaiPeriodeSkp } from "@/server/modules/aleta-ecourt/eviden-skp-data";

/**
 * ============================================================================
 * RUTE DAFTAR DAN RUTE UNDUH MEMBACA ALAMAT DENGAN ATURAN YANG SAMA
 * ============================================================================
 *
 * Menu Unduh eviden SKP memanggil dua rute dengan ?peran=&id=&tahun=&periode=
 * yang sama: rute daftar (bacaPermintaanEvidenSkp, agen data) lalu rute unduh
 * (bacaPermintaanUnduhEvidenSkp). Bila keduanya berselisih, menu menampilkan
 * dokumen yang unduhannya ditolak - atau sebaliknya. Keduanya diuji di sini
 * atas masukan yang sama: sah-tidaknya dan kalimat penolakannya harus sama.
 */

const HARI_INI = "2026-09-27";

const KUERI = [
  "",
  "peran=panitera&id=26&tahun=2026&periode=tw2",
  "peran=HAKIM&id=26&tahun=2026&periode=TW2",
  "peran=hakim",
  "peran=hakim&id=abc&tahun=2026&periode=tw2",
  "peran=hakim&id=025&tahun=2026&periode=tw2",
  "peran=hakim&id=0&tahun=2026&periode=tw2",
  "peran=hakim&id=99999999999&tahun=2026&periode=tw2",
  "peran=hakim&id=26",
  "peran=hakim&id=26&tahun=26&periode=tw2",
  "peran=hakim&id=26&tahun=1999&periode=tw2",
  "peran=hakim&id=26&tahun=2026&periode=tw5",
  "peran=hakim&id=26&tahun=2026&periode=tw3",
  "peran=hakim&id=26&tahun=2026&periode=tw4",
  "peran=hakim&id=26&tahun=2026&periode=tahun",
  "peran=hakim&id=26&tahun=2027&periode=tw1",
  "peran=hakim&id=31&tahun=2025&periode=tw4",
];

describe("pembaca alamat rute daftar dan rute unduh selaras", () => {
  for (const kueri of KUERI) {
    it(`"${kueri || "(kosong)"}"`, () => {
      const daftar = bacaPermintaanEvidenSkp(new URLSearchParams(kueri), HARI_INI);
      const unduh = bacaPermintaanUnduhEvidenSkp(new URLSearchParams(`${kueri}&dokumen=semua&format=pdf`), HARI_INI);
      expect(unduh.ok).toBe(daftar.ok);
      if (!daftar.ok && !unduh.ok) expect(unduh.pesan).toBe(daftar.pesan);
      if (daftar.ok && unduh.ok) {
        expect({ peran: unduh.nilai.peran, id: unduh.nilai.id, tahun: unduh.nilai.tahun, periode: unduh.nilai.periode }).toEqual(daftar.nilai);
      }
    });
  }

  it("hari pertama tiap periode sama menurut kedua pihak", () => {
    for (const p of PILIHAN_PERIODE_EVIDEN_SKP) {
      for (const tahun of [2025, 2026]) expect(mulaiPeriodeEvidenSkp(p.kunci, tahun)).toBe(mulaiPeriodeSkp(p.kunci, tahun));
    }
  });
});
