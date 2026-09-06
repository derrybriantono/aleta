"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiPath } from "@/lib/base-path";
import { jamSekarang, tanggalPanjang, warnaRuang } from "@/lib/antrian-tampilan";

/**
 * ============================================================================
 * AMBIL ANTRIAN SIDANG - LAYAR SENTUH RUANG TUNGGU, TANPA LOGIN
 * ============================================================================
 *
 * Yang berdiri di depan layar ini orang yang baru datang ke pengadilan, kerap
 * membawa map, kerap cemas, dan hampir selalu tidak pernah memakai aplikasi
 * ini sebelumnya. Karena itu SATU pertanyaan pada satu waktu.
 *
 *     1  "Siapa nama Anda?"        ketik nama atau nomor perkara
 *     2  "Ini perkara Anda?"       tekan kartunya
 *     3  "Anda datang sebagai?"    tekan perannya
 *     4  NOMOR ANTRIAN             sebesar mungkin, lalu dapat dicetak
 *
 * ============================================================================
 * PENUNJUK LANGKAH, BUKAN SEKADAR HALAMAN YANG BERGANTI
 * ============================================================================
 *
 * Orang yang tidak tahu ada berapa langkah lagi akan ragu menekan apa pun.
 * Penunjuk di atas menjawabnya sebelum ditanya - dan langkah yang sudah lewat
 * dapat ditekan untuk kembali, sehingga salah pilih tidak menuntut mengulang
 * dari awal.
 *
 * ============================================================================
 * MENGAPA TIDAK MEMINTA LOGIN
 * ============================================================================
 *
 * Aplikasi antrian yang sudah ada bekerja persis begini - cari, tekan hadir,
 * cetak struk - dan itu sebabnya ia dipakai. Menuntut login untuk mengambil
 * nomor berarti nomornya tidak akan pernah diambil.
 *
 * Yang menjaga bukan login, melainkan rutenya: tidak ada daftar tanpa dicari,
 * dan kata carinya harus cukup panjang. Lihat catatan pada
 * src/app/api/antrian-publik/route.ts.
 *
 * ============================================================================
 * NOMORNYA DARI BOT, TIDAK PERNAH DIHITUNG DI SINI
 * ============================================================================
 *
 * Nomor antrian lahir dari kehadiran PERTAMA pada satu perkara, dan hanya bot
 * yang menentukannya. Menghitungnya ulang di peramban akan menghasilkan angka
 * yang berbeda dari yang tercetak di struk dan yang dikirim lewat WhatsApp -
 * dan dua angka untuk satu orang lebih buruk daripada tidak ada angka.
 */

type Baris = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  jamSidang: string;
  ruangan: string;
  agenda: string;
  penggugat: string[];
  tergugat: string[];
  nomorAntrian: number | null;
  keadaan: string;
  sudahHadir: Array<{ sebutan: string; jam: string }>;
};

type Peran = { kunci: string; label: string; sisi: string };

/** Urutan pihak yang lazim. Lebih dari itu jarang, dan dapat dilewati. */
const URUTAN = ["", "I", "II", "III", "IV"];

const LANGKAH = ["Cari perkara", "Pilih perkara", "Peran Anda", "Nomor Anda"];

export default function AntrianPublikPage() {
  const [cari, setCari] = useState("");
  const [baris, setBaris] = useState<Baris[]>([]);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(false);

  const [dipilih, setDipilih] = useState<Baris | null>(null);
  const [peran, setPeran] = useState<Peran[]>([]);
  const [peranDipilih, setPeranDipilih] = useState("");
  const [urutanPihak, setUrutanPihak] = useState("");
  const [sebagaiKuasa, setSebagaiKuasa] = useState(false);

  const [nomorTerbit, setNomorTerbit] = useState<number | null>(null);
  const [sebutanTerbit, setSebutanTerbit] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [jam, setJam] = useState("");

  const kotakCari = useRef<HTMLInputElement>(null);

  const langkahKini = nomorTerbit !== null || sebutanTerbit ? 3 : dipilih ? 2 : baris.length > 0 ? 1 : 0;

  useEffect(() => {
    const detak = setInterval(() => setJam(jamSekarang()), 1000);
    return () => clearInterval(detak);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(apiPath("/api/antrian-publik?peran=1"), { cache: "no-store" });
        const isi = (await r.json()) as { data?: { peran?: Peran[] } };
        const hasil = isi.data ?? (isi as { peran?: Peran[] });
        setPeran(Array.isArray(hasil.peran) ? hasil.peran : []);
      } catch {
        /* daftar peran gagal dimuat - layar tetap dapat mencari */
      }
    })();
  }, []);

  const jalankanCari = useCallback(async (kata: string) => {
    setMemuat(true);
    setPesan("");
    try {
      const r = await fetch(apiPath(`/api/antrian-publik?cari=${encodeURIComponent(kata)}`), {
        cache: "no-store",
      });
      const isi = (await r.json()) as { data?: Record<string, unknown> };
      const hasil = (isi.data ?? isi) as { baris?: Baris[]; pesan?: string; available?: boolean };
      setBaris(Array.isArray(hasil.baris) ? hasil.baris : []);
      setPesan(
        hasil.pesan ||
          (hasil.available === false ? "Antrian belum dapat dibaca. Silakan menghubungi petugas." : "")
      );
    } catch {
      setPesan("Antrian belum dapat dibaca. Silakan menghubungi petugas.");
    } finally {
      setMemuat(false);
    }
  }, []);

  // Dicari sesudah orang berhenti mengetik sejenak. Mencari pada tiap huruf
  // membuat layar berkedip sementara orangnya masih mengetik namanya.
  useEffect(() => {
    const kata = cari.trim();
    if (kata.length < 3) {
      setBaris([]);
      setPesan(kata.length > 0 ? "Ketik sekurang-kurangnya 3 huruf." : "");
      return;
    }
    const tunda = setTimeout(() => void jalankanCari(kata), 450);
    return () => clearTimeout(tunda);
  }, [cari, jalankanCari]);

  const ambilNomor = useCallback(async () => {
    if (!dipilih || !peranDipilih) return;
    setSibuk(true);
    try {
      const r = await fetch(apiPath("/api/antrian-publik"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          perkaraId: dipilih.perkaraId,
          nomorPerkara: dipilih.nomorPerkara,
          peran: peranDipilih,
          urutanPihak,
          sebagaiKuasa,
        }),
      });
      const isi = (await r.json()) as { data?: Record<string, unknown> };
      const hasil = (isi.data ?? isi) as { ok?: boolean; alasan?: string; sebutan?: string };

      if (hasil.ok === false) {
        setPesan(hasil.alasan || "Nomor antrian belum dapat diterbitkan.");
        setSibuk(false);
        return;
      }

      setSebutanTerbit(String(hasil.sebutan || ""));

      // Nomornya dibaca ULANG dari server, bukan ditebak. Perkara yang pihak
      // lain sudah mengambil nomornya memakai nomor itu juga - satu perkara
      // satu nomor - dan menebak di sini menampilkan angka yang berbeda dari
      // yang dipanggil.
      const ulang = await fetch(
        apiPath(`/api/antrian-publik?cari=${encodeURIComponent(dipilih.nomorPerkara)}`),
        { cache: "no-store" }
      );
      const isiUlang = (await ulang.json()) as { data?: { baris?: Baris[] } };
      const daftar = (isiUlang.data ?? (isiUlang as { baris?: Baris[] })).baris || [];
      setNomorTerbit(daftar.find((x) => x.perkaraId === dipilih.perkaraId)?.nomorAntrian ?? null);
    } catch {
      setPesan("Nomor antrian belum dapat diterbitkan. Silakan menghubungi petugas.");
    } finally {
      setSibuk(false);
    }
  }, [dipilih, peranDipilih, urutanPihak, sebagaiKuasa]);

  const mulaiUlang = useCallback(() => {
    setDipilih(null);
    setPeranDipilih("");
    setUrutanPihak("");
    setSebagaiKuasa(false);
    setNomorTerbit(null);
    setSebutanTerbit("");
    setCari("");
    setBaris([]);
    setPesan("");
    kotakCari.current?.focus();
  }, []);

  // Layar sentuh yang ditinggalkan tanpa disentuh kembali ke awal sendiri -
  // kalau tidak, orang berikutnya menemukan nomor antrian orang sebelumnya
  // masih terpampang, beserta nomor perkaranya.
  useEffect(() => {
    if (nomorTerbit === null && !sebutanTerbit) return;
    const pulang = setTimeout(mulaiUlang, 45000);
    return () => clearTimeout(pulang);
  }, [nomorTerbit, sebutanTerbit, mulaiUlang]);

  return (
    <main className="min-h-screen bg-[#0a0c10] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-6">
        <Kepala jam={jam} />
        <Langkah kini={langkahKini} onKembali={(ke) => {
          if (ke === 0) mulaiUlang();
          if (ke === 1 && langkahKini > 1) {
            setDipilih(null);
            setNomorTerbit(null);
            setSebutanTerbit("");
          }
        }} />

        <div className="flex flex-1 flex-col justify-center py-4">
          {nomorTerbit !== null || sebutanTerbit ? (
            <Selesai
              nomor={nomorTerbit}
              sebutan={sebutanTerbit}
              perkara={dipilih}
              onSelesai={mulaiUlang}
            />
          ) : dipilih ? (
            <PilihPeran
              perkara={dipilih}
              peran={peran.length > 0 ? peran : BAWAAN_PERAN}
              peranDipilih={peranDipilih}
              setPeranDipilih={setPeranDipilih}
              urutanPihak={urutanPihak}
              setUrutanPihak={setUrutanPihak}
              sebagaiKuasa={sebagaiKuasa}
              setSebagaiKuasa={setSebagaiKuasa}
              sibuk={sibuk}
              onAmbil={() => void ambilNomor()}
              pesan={pesan}
            />
          ) : (
            <Pencarian
              kotakCari={kotakCari}
              cari={cari}
              setCari={setCari}
              baris={baris}
              memuat={memuat}
              pesan={pesan}
              onPilih={setDipilih}
            />
          )}
        </div>

        <p className="border-t border-slate-800/80 pt-3 text-center text-sm text-slate-600">
          Nomor antrian terbit dari kehadiran pertama pada satu perkara. Bila pihak lawan sudah
          mengambil, nomornya tetap sama - satu perkara satu nomor.
        </p>
      </div>
    </main>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function Kepala({ jam }: { jam: string }) {
  return (
    <header className="flex items-baseline justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Ambil Antrian Sidang</p>
        <h1 className="mt-0.5 text-lg font-medium text-slate-300">Pengadilan Agama Donggala</h1>
      </div>
      <div className="text-right">
        <p className="font-mono text-2xl font-light tabular-nums text-slate-300">{jam}</p>
        <p className="text-xs text-slate-600">{tanggalPanjang()}</p>
      </div>
    </header>
  );
}

/**
 * Penunjuk langkah.
 *
 * Menjawab "masih berapa lagi" sebelum ditanya. Langkah yang SUDAH LEWAT dapat
 * ditekan untuk kembali - salah pilih perkara tidak menuntut mengulang dari
 * awal, dan itu keadaan yang sering terjadi pada nama yang mirip.
 */
function Langkah({ kini, onKembali }: { kini: number; onKembali: (ke: number) => void }) {
  return (
    <nav className="mt-5 flex items-center gap-2">
      {LANGKAH.map((label, urutan) => {
        const lewat = urutan < kini;
        const aktif = urutan === kini;
        return (
          <button
            key={label}
            type="button"
            disabled={!lewat}
            onClick={() => onKembali(urutan)}
            className={[
              "flex flex-1 flex-col gap-1.5 text-left transition",
              lewat ? "cursor-pointer" : "cursor-default",
            ].join(" ")}
          >
            <span
              className={[
                "h-1 rounded-full",
                aktif ? "bg-emerald-400" : lewat ? "bg-emerald-800" : "bg-slate-800",
              ].join(" ")}
            />
            <span
              className={[
                "text-xs",
                aktif ? "text-emerald-300" : lewat ? "text-slate-400" : "text-slate-600",
              ].join(" ")}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function Pencarian({
  kotakCari,
  cari,
  setCari,
  baris,
  memuat,
  pesan,
  onPilih,
}: {
  kotakCari: React.RefObject<HTMLInputElement | null>;
  cari: string;
  setCari: (nilai: string) => void;
  baris: Baris[];
  memuat: boolean;
  pesan: string;
  onPilih: (baris: Baris) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="cari-perkara" className="text-2xl font-light text-slate-200">
          Ketik nama Anda atau nomor perkara
        </label>
        <input
          id="cari-perkara"
          ref={kotakCari}
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Contoh: Siti, atau 123/Pdt.G"
          autoFocus
          autoComplete="off"
          className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-5 text-2xl outline-none transition placeholder:text-slate-700 focus:border-emerald-600"
        />
      </div>

      {memuat ? <p className="text-lg text-slate-500">Mencari…</p> : null}
      {pesan ? <p className="text-lg text-amber-300/90">{pesan}</p> : null}

      {!memuat && cari.trim().length >= 3 && baris.length === 0 && !pesan ? (
        <p className="text-lg text-slate-500">
          Tidak ada sidang hari ini yang cocok. Periksa ejaannya, atau tanyakan kepada petugas.
        </p>
      ) : null}

      <div className="space-y-2">
        {baris.map((satu) => {
          const w = warnaRuang(Number(String(satu.ruangan).replace(/\D/g, "")) || null);
          return (
            <button
              key={satu.perkaraId}
              type="button"
              onClick={() => onPilih(satu)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-left transition hover:border-emerald-700 hover:bg-slate-900"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xl font-medium">{satu.nomorPerkara}</span>
                {satu.nomorAntrian ? (
                  <span
                    className="rounded-lg px-3 py-1 font-mono text-lg tabular-nums"
                    style={{ color: w.aksen }}
                  >
                    Nomor {satu.nomorAntrian}
                  </span>
                ) : null}
              </div>

              <p className="mt-1 text-lg text-slate-300">
                {[satu.penggugat[0], satu.tergugat[0]].filter(Boolean).join("  lawan  ") || "—"}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {[satu.jamSidang, satu.ruangan, satu.jenisPerkara].filter(Boolean).join(" · ")}
              </p>

              {satu.sudahHadir.length > 0 ? (
                <p className="mt-1 text-sm text-emerald-400/80">
                  Sudah hadir: {satu.sudahHadir.map((x) => x.sebutan).join(", ")}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PilihPeran({
  perkara,
  peran,
  peranDipilih,
  setPeranDipilih,
  urutanPihak,
  setUrutanPihak,
  sebagaiKuasa,
  setSebagaiKuasa,
  sibuk,
  onAmbil,
  pesan,
}: {
  perkara: Baris;
  peran: Peran[];
  peranDipilih: string;
  setPeranDipilih: (nilai: string) => void;
  urutanPihak: string;
  setUrutanPihak: (nilai: string) => void;
  sebagaiKuasa: boolean;
  setSebagaiKuasa: (nilai: boolean) => void;
  sibuk: boolean;
  onAmbil: () => void;
  pesan: string;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <p className="text-lg font-medium">{perkara.nomorPerkara}</p>
        <p className="mt-0.5 text-sm text-slate-500">
          {[perkara.jamSidang, perkara.ruangan].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div>
        <p className="text-2xl font-light text-slate-200">Anda datang sebagai apa?</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {peran.map((satu) => (
            <button
              key={satu.kunci}
              type="button"
              onClick={() => setPeranDipilih(satu.kunci)}
              className={[
                "rounded-2xl border px-5 py-5 text-left text-xl transition",
                peranDipilih === satu.kunci
                  ? "border-emerald-500 bg-emerald-950/60 text-emerald-100"
                  : "border-slate-800 hover:border-slate-600",
              ].join(" ")}
            >
              {satu.label}
            </button>
          ))}
        </div>
      </div>

      {peranDipilih ? (
        <>
          <div>
            <p className="text-lg text-slate-300">Yang keberapa?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {URUTAN.map((angka) => (
                <button
                  key={angka || "tanpa"}
                  type="button"
                  onClick={() => setUrutanPihak(angka)}
                  className={[
                    "rounded-xl border px-6 py-3 text-lg transition",
                    urutanPihak === angka
                      ? "border-emerald-500 bg-emerald-950/60 text-emerald-100"
                      : "border-slate-800 hover:border-slate-600",
                  ].join(" ")}
                >
                  {angka || "Tidak disebut"}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 text-lg text-slate-300">
            <input
              type="checkbox"
              className="h-6 w-6 accent-emerald-500"
              checked={sebagaiKuasa}
              onChange={(e) => setSebagaiKuasa(e.target.checked)}
            />
            Saya kuasa hukumnya
          </label>

          <button
            type="button"
            disabled={sibuk}
            onClick={onAmbil}
            className="w-full rounded-2xl bg-emerald-600 px-6 py-6 text-2xl font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
          >
            {sibuk ? "Menerbitkan…" : "Ambil nomor antrian"}
          </button>
        </>
      ) : null}

      {pesan ? <p className="text-lg text-amber-300/90">{pesan}</p> : null}
    </div>
  );
}

function Selesai({
  nomor,
  sebutan,
  perkara,
  onSelesai,
}: {
  nomor: number | null;
  sebutan: string;
  perkara: Baris | null;
  onSelesai: () => void;
}) {
  return (
    <div className="space-y-6 text-center">
      <style>{GAYA_STRUK}</style>

      <div id="aleta-struk-antrian" className="rounded-3xl border border-emerald-900/60 bg-emerald-950/20 p-8">
        <p className="text-sm uppercase tracking-[0.35em] text-emerald-400/70">Nomor antrian Anda</p>
        <p className="mt-1 font-mono text-[8rem] font-semibold leading-none tabular-nums text-emerald-300">
          {nomor ?? "—"}
        </p>
        {sebutan ? <p className="mt-2 text-xl text-emerald-100/90">{sebutan} tercatat hadir</p> : null}

        {perkara ? (
          <div className="mt-5 space-y-0.5 border-t border-emerald-900/60 pt-4">
            <p className="text-lg font-medium">{perkara.nomorPerkara}</p>
            <p className="text-slate-400">
              {[perkara.jamSidang, perkara.ruangan].filter(Boolean).join(" · ")}
            </p>
          </div>
        ) : null}

        <p className="mt-5 text-slate-400">
          Silakan menunggu di ruang tunggu. Nomor Anda akan dipanggil lewat layar dan pengeras
          suara.
        </p>
      </div>

      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-2xl border border-slate-700 px-8 py-4 text-lg text-slate-200 transition hover:bg-slate-900"
        >
          Cetak struk
        </button>
        <button
          type="button"
          onClick={onSelesai}
          className="rounded-2xl bg-emerald-600 px-10 py-4 text-lg font-semibold text-white transition hover:bg-emerald-500"
        >
          Selesai
        </button>
      </div>

      <p className="text-sm text-slate-600">
        Layar kembali ke awal dengan sendirinya sesudah beberapa saat.
      </p>
    </div>
  );
}

/**
 * Aturan cetak struk.
 *
 * Menyembunyikan SISANYA, bukan menyebut satu per satu apa yang harus hilang -
 * yang terakhir gagal begitu ada bagian baru ditambahkan, dan yang tercetak
 * menjadi tombol.
 *
 * Warnanya dibalik menjadi hitam di atas putih: layar sentuh bertema gelap,
 * dan mencetaknya apa adanya menghabiskan tinta sekaligus menghasilkan angka
 * putih yang tidak terbaca di atas kertas.
 */
const GAYA_STRUK = `
@media print {
  body * { visibility: hidden !important; }
  #aleta-struk-antrian, #aleta-struk-antrian * { visibility: visible !important; }
  #aleta-struk-antrian {
    position: absolute !important;
    left: 0; top: 0;
    width: 100%;
    border: none !important;
    background: #fff !important;
    color: #000 !important;
  }
  #aleta-struk-antrian * { color: #000 !important; }
  @page { margin: 8mm; }
}
`;

/**
 * Dipakai hanya bila daftar peran gagal dimuat dari bot. Layar sentuh di ruang
 * tunggu tidak boleh berhenti bekerja karena satu permintaan yang gagal.
 */
const BAWAAN_PERAN: Peran[] = [
  { kunci: "penggugat", label: "Penggugat / Pemohon", sisi: "1" },
  { kunci: "tergugat", label: "Tergugat / Termohon", sisi: "2" },
  { kunci: "saksi", label: "Saksi", sisi: "saksi" },
  { kunci: "kuasa", label: "Kuasa Hukum", sisi: "1" },
];
