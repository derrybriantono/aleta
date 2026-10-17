"use client";

import { Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { KartuTutorial } from "@/components/portal/tutorial-kartu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { usePortal } from "@/lib/app-state";
import { GOLONGAN_PERAN, LABEL_GOLONGAN, golonganPengguna, type GolonganPeran } from "@/lib/matriks-peran";
import { getEffectiveRoleId } from "@/lib/permissions";
import { TUTORIAL } from "@/lib/tutorial-isi";
import {
  KELOMPOK_TUTORIAL,
  URUTAN_KELOMPOK_TUTORIAL,
  cocokDenganKata,
  kelompokkanTutorial,
  saringTutorial,
  tandaBaru,
  type KelompokTutorial,
} from "@/lib/tutorial-hidup";
import { cn } from "@/lib/utils";

const TANPA_VISIBILITAS: never[] = [];

/**
 * Tutorial per fitur untuk halaman Panduan.
 *
 * Yang tampil = fitur yang MEMANG menjadi hak akun ini (diturunkan dari matriks
 * peran). Super Admin melihat semuanya dan dapat memilih "Lihat sebagai peran"
 * untuk memeriksa apa yang dilihat peran lain.
 */
export function TutorialHidup() {
  const { currentUser, moduleVisibility: visibilitas } = usePortal();
  const moduleVisibility = visibilitas ?? TANPA_VISIBILITAS;
  const [cari, setCari] = useState("");
  const [kelompok, setKelompok] = useState<KelompokTutorial | "semua">("semua");
  const [hanyaBaru, setHanyaBaru] = useState(false);
  const [sebagai, setSebagai] = useState<GolonganPeran | "saya">("saya");
  const [fiturDituju, setFiturDituju] = useState<string | null>(null);

  const golonganSaya = useMemo(() => golonganPengguna(currentUser), [currentUser]);
  const superAdmin = golonganSaya.includes("super-admin");
  const aksesMenu = useMemo(() => {
    const roleId = getEffectiveRoleId(currentUser);
    return moduleVisibility.find((item) => item.roleId === roleId) ?? null;
  }, [currentUser, moduleVisibility]);

  // Alamat ?fitur=<id> (dari tombol "?") membuka fiturnya langsung.
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const id = new URLSearchParams(window.location.search).get("fitur");
        if (id && TUTORIAL.some((x) => x.id === id)) {
          setFiturDituju(id);
          setKelompok("semua");
        }
      } catch {
        // Tanpa alamat: tampilan biasa.
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const dapatDilihat = useMemo(
    () =>
      saringTutorial(TUTORIAL, {
        pengguna: currentUser,
        aksesMenu,
        sebagaiGolongan: superAdmin && sebagai !== "saya" ? [sebagai] : undefined,
      }),
    [currentUser, aksesMenu, superAdmin, sebagai]
  );

  const hasil = useMemo(
    () =>
      dapatDilihat
        .filter((t) => kelompok === "semua" || t.kelompok === kelompok)
        .filter((t) => !hanyaBaru || tandaBaru(t) !== null)
        .filter((t) => cocokDenganKata(t, cari)),
    [dapatDilihat, kelompok, hanyaBaru, cari]
  );

  const jumlahBaru = useMemo(() => dapatDilihat.filter((t) => tandaBaru(t) !== null).length, [dapatDilihat]);
  const jumlahPerKelompok = useMemo(() => {
    const hitung = Object.fromEntries(URUTAN_KELOMPOK_TUTORIAL.map((k) => [k, 0])) as Record<KelompokTutorial, number>;
    for (const t of dapatDilihat) hitung[t.kelompok] += 1;
    return hitung;
  }, [dapatDilihat]);
  const bagian = useMemo(() => kelompokkanTutorial(hasil), [hasil]);

  const chip = (aktif: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      aktif
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-muted-foreground hover:text-foreground"
    );

  return (
    <div className="space-y-5" data-testid="tutorial-hidup">
      <Card className="border-border/80">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Cari fitur</span>
              <span className="relative block">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                  placeholder="Contoh: kasir, unggah putusan, mediasi, cuti"
                  className="pl-9"
                />
              </span>
            </label>

            {superAdmin ? (
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Lihat sebagai peran</span>
                <NativeSelect value={sebagai} onChange={(e) => setSebagai(e.target.value as GolonganPeran | "saya")}>
                  <option value="saya">Semua fitur (Super Admin)</option>
                  {GOLONGAN_PERAN.filter((g) => g !== "super-admin").map((g) => (
                    <option key={g} value={g}>
                      {LABEL_GOLONGAN[g]}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            ) : (
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">
                <p className="font-semibold text-foreground">Hanya fitur yang menjadi hak Anda</p>
                <p>Tutorial ini mengikuti peran dan jabatan akun Anda. Fitur yang tidak Anda punyai haknya tidak ditampilkan.</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Kelompok menu">
            <button type="button" className={chip(kelompok === "semua")} onClick={() => setKelompok("semua")}>
              Semua ({dapatDilihat.length})
            </button>
            {URUTAN_KELOMPOK_TUTORIAL.filter((k) => jumlahPerKelompok[k] > 0).map((k) => (
              <button key={k} type="button" className={chip(kelompok === k)} onClick={() => setKelompok(k)}>
                {KELOMPOK_TUTORIAL[k].label} ({jumlahPerKelompok[k]})
              </button>
            ))}
            {jumlahBaru > 0 ? (
              <button
                type="button"
                className={cn(chip(hanyaBaru), "inline-flex items-center gap-1.5")}
                aria-pressed={hanyaBaru}
                onClick={() => setHanyaBaru((x) => !x)}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Yang baru ({jumlahBaru})
              </button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {bagian.length === 0 ? (
        <Card className="border-dashed border-border bg-muted/30">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Tidak ada fitur yang cocok. Coba hapus kata pencarian atau pilih kelompok lain.
          </CardContent>
        </Card>
      ) : (
        bagian.map((b) => (
          <section key={b.kelompok} className="space-y-3" aria-labelledby={`kelompok-${b.kelompok}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 id={`kelompok-${b.kelompok}`} className="text-lg font-semibold text-foreground">
                {b.label}
              </h2>
              <Badge variant="muted">{b.isi.length} fitur</Badge>
              <p className="w-full text-sm text-muted-foreground sm:w-auto">{b.keterangan}</p>
            </div>
            <div className="grid items-start gap-3 2xl:grid-cols-2">
              {b.isi.map((t) => (
                <KartuTutorial key={`${t.id}-${t.id === fiturDituju}`} tutorial={t} tampilkanKelompok={false} bukaAwal={t.id === fiturDituju} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
