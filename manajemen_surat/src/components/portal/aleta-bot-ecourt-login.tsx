"use client";

/**
 * Masuk e-Court (akun penarik data) dari portal.
 *
 * ============================================================================
 * AKUN & SANDI TERSIMPAN: CUKUP KETIK CAPTCHA (30 Okt 2026)
 * ============================================================================
 *
 * Atas permintaan pengguna, surel dan sandi akun e-Court utama dan akun
 * lainnya DISIMPAN tersandi di ALETA Bot (AES-256-GCM, kunci server). Bila
 * tersimpan, bot mengetikkan sendiri surel dan sandi ke formulir e-Court -
 * layar ini hanya meminta captcha. Sandi tidak pernah dikirim kembali ke
 * peramban; kolom sandi di sini hanya untuk mengetik sandi BARU.
 *
 * Sandi yang diketik di sini hanya berada di keadaan komponen selama satu
 * percobaan, lalu dikosongkan. Bila "Simpan" dicentang, bot menyimpannya
 * SESUDAH e-Court menerima login itu - sandi yang salah tidak pernah tersimpan.
 *
 * Captcha tetap dijawab manusia. Gambarnya dipotret dari halaman e-Court yang
 * sedang dibuka bot (sesudah /capcay/regenerate) lalu ditampilkan apa adanya.
 *
 * Keadaan akun (lencana) dibaca dari status satu sumber - sama dengan semua
 * penanda lain di halaman ini, dan berubah serentak sesudah masuk/keluar.
 */

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  KeteranganStatusEcourt,
  LencanaStatusEcourt,
  kabarkanStatusEcourtBerubah,
  pasangStatusEcourt,
  useStatusEcourt,
  type DataStatusEcourt,
} from "@/components/portal/ecourt-status-lencana";
import { apiPath } from "@/lib/base-path";
import { PERISTIWA_MASUK_ECOURT } from "@/lib/ecourt-status-akun";

type Formulir = {
  adaEmail: boolean;
  adaSandi: boolean;
  adaCaptcha: boolean;
  adaTombol: boolean;
  jumlahIsian: number;
};

const ALASAN_TERBACA: Record<string, string> = {
  sesi_login_kedaluwarsa: "Kotak captcha sudah kedaluwarsa. Tekan Masuk lagi untuk mendapat captcha baru.",
  email_atau_sandi_kosong: "Surel dan sandi harus diisi (belum ada akun tersimpan untuk akun ini).",
  login_ditolak_ecourt: "e-Court menolak masuk. Periksa jawaban captcha, lalu coba lagi.",
  gagal_mengirim_formulir: "Formulir gagal dikirim ke e-Court. Coba lagi.",
  formulir_login_tidak_dikenali: "Halaman masuk e-Court tidak dikenali. Kemungkinan tampilannya berubah.",
  belum_pernah_login: "Belum pernah masuk dari server ini.",
  sesi_kedaluwarsa: "Sesi tersimpan sudah habis.",
  bot_tidak_terjangkau: "ALETA Bot belum dapat dihubungi.",
  gagal_membuka:
    "ALETA Bot gagal membuka halaman masuk e-Court. Biasanya karena server tidak dapat menjangkau e-Court, atau peramban di server gagal dijalankan.",
  folder_sesi_gagal:
    "Folder sesi e-Court tidak dapat dibuat atau ditulisi di server. Periksa ruang disk dan hak akses folder.",
  gerbang_menunggu_penegasan:
    "Sesi masih ada, tetapi e-Court menuntut penegasan karena akun dipakai di perangkat lain. Tekan Masuk lagi untuk menegaskannya - sesi di perangkat lain akan berhenti.",
  gerbang_ecourt_tidak_terlewati:
    "e-Court menampilkan halaman penegasan (akun sedang dipakai di perangkat lain), tetapi tombol Lanjut tidak ditemukan. Kemungkinan tampilan halaman itu berubah.",
  kembaran_dimatikan: "Server ini salinan kerja - e-Court tidak dibuka dari sini.",
  slot_tidak_sah: "Nama akun tidak sah.",
  kunci_tidak_tersedia:
    "Kunci penyandian di server tidak tersedia, jadi sandi TIDAK disimpan. Minta admin server mengisi ALETA_ECOURT_KUNCI atau memeriksa folder sesi e-Court.",
};

/** Kode alasan dari bot -> kalimat untuk petugas. */
function baca(alasan?: string): string {
  if (!alasan) return "Gagal.";
  const terbaca = ALASAN_TERBACA[alasan];
  if (terbaca) return terbaca;
  const pisah = alasan.indexOf(":");
  if (pisah > 0) {
    const kode = alasan.slice(0, pisah).trim();
    const pangkal = ALASAN_TERBACA[kode];
    if (pangkal) return pangkal;
  }
  return alasan.replace(/_/g, " ");
}

export function AletaBotEcourtLogin() {
  const { data, memuat: memuatStatus } = useStatusEcourt();
  const akun = data?.akun ?? [];
  const [pilihSlot, setPilihSlot] = useState("");
  const slot = pilihSlot || data?.utama || akun[0]?.slot || "utama";
  const status = akun.find((a) => a.slot === slot) ?? (data?.ringkas?.slot === slot ? data.ringkas : null) ?? data?.ringkas ?? null;

  const [namaPengguna, setNamaPengguna] = useState("");
  const [adaSesi, setAdaSesi] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [catatan, setCatatan] = useState("");

  const [captcha, setCaptcha] = useState("");
  const [formulir, setFormulir] = useState<Formulir | null>(null);
  const [terisiOtomatis, setTerisiOtomatis] = useState(false);
  const [emailTerisi, setEmailTerisi] = useState("");
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [simpan, setSimpan] = useState(true);
  const [jawabanCaptcha, setJawabanCaptcha] = useState("");
  const [tawarGantiSandi, setTawarGantiSandi] = useState(false);

  const lupakanIsian = useCallback(() => {
    setSandi("");
    setJawabanCaptcha("");
    setCaptcha("");
    setFormulir(null);
    setTerisiOtomatis(false);
    setEmailTerisi("");
  }, []);

  /** Nama akun e-Court & ada-tidaknya sesi tersimpan untuk slot terpilih (tanpa membuka Chrome). */
  const muatSesi = useCallback(async (s: string) => {
    try {
      const jawaban = await fetch(apiPath(`/api/aleta-bot/ecourt/login?slot=${encodeURIComponent(s)}`), { cache: "no-store" });
      const hasil = await jawaban.json();
      const isi = hasil?.data ?? hasil;
      setNamaPengguna(String(isi?.keadaan?.namaPengguna || ""));
      setAdaSesi(Boolean(isi?.sesi?.tersimpan));
    } catch {
      setNamaPengguna("");
      setAdaSesi(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void muatSesi(slot), 0);
    return () => window.clearTimeout(t);
  }, [slot, muatSesi, status?.keadaan]);

  const kirimAksi = useCallback(async (payload: Record<string, unknown>) => {
    const respons = await fetch(apiPath("/api/aleta-bot/ecourt/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const hasil = await respons.json();
    return hasil?.data ?? hasil;
  }, []);

  const periksa = useCallback(async () => {
    setSibuk(true);
    setCatatan("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/status-akun"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tindakan: "periksa", slot }),
      });
      const isi = await jawaban.json();
      const d = (isi?.data ?? isi) as DataStatusEcourt;
      if (d?.ringkas) pasangStatusEcourt(d);
      else setCatatan(String(isi?.error || "Pemeriksaan belum dapat dijalankan."));
      kabarkanStatusEcourtBerubah();
    } catch (error) {
      setCatatan(error instanceof Error ? error.message : "Pemeriksaan gagal.");
    } finally {
      setSibuk(false);
    }
  }, [slot]);

  /** Membuka halaman masuk e-Court di server dan menampilkan captchanya. */
  const mulai = useCallback(
    async (isiOtomatis = true, slotDiminta = "") => {
      setSibuk(true);
      setCatatan("");
      setTawarGantiSandi(false);
      try {
        const isi = await kirimAksi({ aksi: "mulai", slot: slotDiminta || slot, isiOtomatis });
        if (isi?.ok && isi?.alasan === "sudah_masuk") {
          setCatatan("Sesi tersimpan masih berlaku. Tidak perlu masuk lagi.");
          kabarkanStatusEcourtBerubah();
        } else if (isi?.ok) {
          setCaptcha(isi.captcha || "");
          setFormulir(isi.formulir ?? null);
          setTerisiOtomatis(Boolean(isi.terisiOtomatis));
          setEmailTerisi(String(isi.emailTerisi || ""));
          if (!isi.captcha) {
            setCatatan("Halaman masuk terbuka, tetapi gambar captcha tidak ditemukan. Coba kirim tanpa captcha.");
          }
        } else {
          setCatatan(baca(isi?.alasan));
          kabarkanStatusEcourtBerubah();
        }
      } catch (error) {
        setCatatan(error instanceof Error ? error.message : "Gagal membuka halaman masuk.");
      } finally {
        setSibuk(false);
      }
    },
    [kirimAksi, slot]
  );

  const kirim = useCallback(async () => {
    setSibuk(true);
    setCatatan("");
    try {
      const isi = await kirimAksi({
        aksi: "kirim",
        slot,
        email: terisiOtomatis ? "" : email,
        sandi: terisiOtomatis ? "" : sandi,
        captcha: jawabanCaptcha,
        simpan: !terisiOtomatis && simpan,
      });
      const pakaiTersimpan = terisiOtomatis;
      lupakanIsian();
      if (isi?.ok) {
        let teks = "Berhasil masuk. Sesi tersimpan di server dan penarikan berjalan dengan akun ini.";
        if (isi.kredensialTersimpan) teks += " Akun & sandi tersimpan tersandi - berikutnya cukup ketik captcha.";
        else if (isi.alasanSimpan) teks += ` Akun & sandi BELUM tersimpan: ${baca(String(isi.alasanSimpan))}`;
        setCatatan(teks);
      } else if (isi?.jenisTolak === "captcha") {
        setCatatan("Kode captcha salah atau sudah hangus. Tekan Masuk lagi untuk mendapat captcha baru.");
      } else if (isi?.jenisTolak === "sandi" && (isi?.pakaiSandiTersimpan || pakaiTersimpan)) {
        setCatatan(
          "e-Court menolak surel/sandi yang tersimpan - kemungkinan sandinya sudah diganti. Tekan \"Ganti sandi & masuk\" lalu ketik sandi baru."
        );
        setTawarGantiSandi(true);
      } else if (isi?.jenisTolak === "sandi") {
        setCatatan("e-Court menolak surel atau sandi. Periksa keduanya, lalu tekan Masuk lagi.");
      } else {
        setCatatan(baca(isi?.alasan));
      }
      kabarkanStatusEcourtBerubah();
    } catch (error) {
      lupakanIsian();
      setCatatan(error instanceof Error ? error.message : "Gagal mengirim.");
    } finally {
      setSibuk(false);
    }
  }, [email, sandi, jawabanCaptcha, simpan, terisiOtomatis, kirimAksi, lupakanIsian, slot]);

  const keluar = useCallback(async () => {
    if (!window.confirm("Hapus sesi e-Court akun ini dari server? Penarikan memakai akun ini berhenti sampai masuk lagi.")) return;
    setSibuk(true);
    setCatatan("");
    try {
      const isi = await kirimAksi({ aksi: "keluar", slot });
      lupakanIsian();
      setCatatan(isi?.ok ? "Sesi dihapus. Masuk berikutnya dari awal." : baca(isi?.alasan));
      kabarkanStatusEcourtBerubah();
    } catch (error) {
      setCatatan(error instanceof Error ? error.message : "Gagal menghapus sesi.");
    } finally {
      setSibuk(false);
    }
  }, [kirimAksi, lupakanIsian, slot]);

  // "Masuk lagi" dari penanda mana pun (tabel akun, kartu lain): pilih akunnya
  // dan buka kotak captcha seketika.
  useEffect(() => {
    const dengar = (e: Event) => {
      const diminta = String((e as CustomEvent<{ slot?: string }>).detail?.slot || "");
      if (!diminta) return;
      setPilihSlot(diminta);
      lupakanIsian();
      void mulai(true, diminta);
    };
    window.addEventListener(PERISTIWA_MASUK_ECOURT, dengar);
    return () => window.removeEventListener(PERISTIWA_MASUK_ECOURT, dengar);
  }, [mulai, lupakanIsian]);

  const labelMasuk = status?.keadaan === "perlu_masuk" ? "Masuk lagi" : "Masuk e-Court";

  return (
    <Card id="masuk-ecourt">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Masuk e-Court
            {memuatStatus && !status ? null : <LencanaStatusEcourt t={status} />}
          </CardTitle>
          <CardDescription>
            Masuk sekali dari sini, lalu penarikan e-Court berjalan sendiri selama sesinya masih berlaku. Bila akun &
            sandi sudah tersimpan, masuk (atau masuk lagi saat sesi habis) cukup mengetik captcha.
          </CardDescription>
          {namaPengguna ? (
            <p className="mt-1 text-sm">
              <span className="text-muted-foreground">Akun: </span>
              <span className="font-medium">{namaPengguna}</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {akun.length > 1 ? (
            <label className="flex items-center gap-1 text-xs">
              Akun
              <select
                className="h-8 rounded border border-input bg-background px-2 text-sm"
                value={slot}
                disabled={sibuk || Boolean(formulir)}
                onChange={(e) => {
                  setPilihSlot(e.target.value);
                  lupakanIsian();
                  setCatatan("");
                }}
              >
                {akun.map((a) => (
                  <option key={a.slot} value={a.slot}>
                    {a.label || a.slot}
                    {a.utama ? " (utama)" : ""} - {a.judul}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Button variant="outline" size="sm" disabled={sibuk} onClick={() => void periksa()}>
            Periksa sekarang
          </Button>
          {adaSesi ? (
            <Button variant="outline" size="sm" disabled={sibuk} onClick={() => void keluar()}>
              Hapus Sesi
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <KeteranganStatusEcourt t={status} tampilkanAktif />
        {catatan ? <p className="rounded border border-border bg-muted/40 p-3 text-sm">{catatan}</p> : null}

        {!formulir ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={sibuk} onClick={() => void mulai(true)}>
              {sibuk ? "Membuka…" : labelMasuk}
            </Button>
            {tawarGantiSandi || status?.sandiDitolak ? (
              <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void mulai(false)}>
                Ganti sandi & masuk
              </Button>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {status?.adaSandi
                ? "Akun & sandi tersimpan - bot mengisinya sendiri; Anda cukup mengetik captcha."
                : "Belum ada akun & sandi tersimpan untuk akun ini - surel dan sandi diketik sekali, lalu dapat disimpan."}
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            {terisiOtomatis ? (
              <p className="rounded bg-muted/50 p-2.5 text-sm">
                Masuk sebagai <span className="font-medium">{emailTerisi || "akun tersimpan"}</span> - surel dan sandi
                sudah diisi ALETA Bot dari simpanan tersandi. Cukup ketik kode captcha.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="ecourt-email">
                    Surel e-Court
                  </label>
                  <Input
                    id="ecourt-email"
                    type="email"
                    autoComplete="off"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nama@pa-donggala.go.id"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="ecourt-sandi">
                    Sandi
                  </label>
                  <Input
                    id="ecourt-sandi"
                    type="password"
                    autoComplete="new-password"
                    value={sandi}
                    onChange={(event) => setSandi(event.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" checked={simpan} onChange={(e) => setSimpan(e.target.checked)} />
                  Simpan surel & sandi ini (tersandi di server) supaya berikutnya cukup ketik captcha
                </label>
              </div>
            )}

            {captcha ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="ecourt-captcha">
                  Ketik ulang kode pada gambar
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Gambar captcha dari halaman e-Court yang sedang dibuka bot. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={captcha}
                    alt="Kode captcha dari halaman masuk e-Court"
                    className="h-12 rounded border border-border bg-white"
                  />
                  <Input
                    id="ecourt-captcha"
                    autoComplete="off"
                    autoFocus
                    value={jawabanCaptcha}
                    onChange={(event) => setJawabanCaptcha(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && jawabanCaptcha && (terisiOtomatis || (email && sandi))) void kirim();
                    }}
                    className="w-40"
                  />
                </div>
              </div>
            ) : (
              <p className="rounded bg-muted/50 p-2.5 text-xs text-muted-foreground">
                Gambar captcha tidak ditemukan pada halaman. Coba kirim tanpa captcha — bila e-Court menolak, tekan
                Masuk lagi.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={sibuk || (!terisiOtomatis && (!email || !sandi)) || (Boolean(captcha) && !jawabanCaptcha)}
                onClick={() => void kirim()}
              >
                {sibuk ? "Mengirim…" : "Masuk"}
              </Button>
              <Button variant="outline" size="sm" disabled={sibuk} onClick={lupakanIsian}>
                Batal
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Sandi tidak pernah ditampilkan kembali dan tidak dikirim ke peramban. Bila disimpan, sandi disandi di
              server ALETA Bot dan hanya dibuka di sana saat mengisi formulir e-Court. Captcha selalu diketik manusia.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
