import { type InstitutionIdentity } from "@/lib/types";

type CourtType = "ma" | "badilag" | "bua" | "pta" | "pa" | "pt" | "pn" | "other";

type CourtEntryOptions = {
  identityOverrides?: Partial<InstitutionIdentity>;
  aliases?: string[];
  courtType?: CourtType;
  jurisdiction?: string;
  regions?: string[];
  satkerLabel?: string;
};

export type CourtDirectoryEntry = {
  id: string;
  courtName: string;
  satkerLabel: string;
  identity: InstitutionIdentity;
  aliases: string[];
  courtType: CourtType;
  jurisdiction: string;
  regions: string[];
};

const REGION_ALIAS_MAP: Record<string, string[]> = {
  // Sumatera
  "aceh": ["nad", "nanggroe aceh darussalam"],
  "sumatera utara": ["sumut"],
  "sumatera barat": ["sumbar"],
  "sumatera selatan": ["sumsel"],
  "kepulauan riau": ["kepri"],
  "bangka belitung": ["babel", "bangka"],
  // Jawa
  "dki jakarta": ["jakarta"],
  "jakarta pusat": ["jakpus"],
  "jawa barat": ["jabar"],
  "jawa tengah": ["jateng"],
  "jawa timur": ["jatim"],
  "daerah istimewa yogyakarta": ["diy", "yogya", "yogyakarta", "jogja"],
  "yogyakarta": ["yogya", "jogja"],
  // Bali & NT
  "nusa tenggara barat": ["ntb"],
  "nusa tenggara timur": ["ntt"],
  // Kalimantan
  "kalimantan barat": ["kalbar"],
  "kalimantan tengah": ["kalteng"],
  "kalimantan selatan": ["kalsel"],
  "kalimantan timur": ["kaltim"],
  "kalimantan utara": ["kaltara"],
  // Sulawesi
  "sulawesi tengah": ["sulteng"],
  "sulawesi selatan": ["sulsel"],
  "sulawesi utara": ["sulut"],
  "sulawesi barat": ["sulbar"],
  "sulawesi tenggara": ["sultra"],
  // Kepulauan
  "maluku utara": ["malut"],
  // Lain
  "kepulauan selayar": ["selayar"],
  "sidenreng rappang": ["sidrap"],
  "papua barat": ["papbar"],
};

function slugifyCourtName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripCourtClassSuffix(value: string) {
  return value.replace(/\s+(kelas|klas)\s+[a-z0-9/.\- ]+$/i, "").trim();
}

function deriveCourtType(courtName: string): CourtType {
  if (courtName === "Mahkamah Agung Republik Indonesia") return "ma";
  if (courtName === "Badan Peradilan Agama") return "badilag";
  if (courtName === "Badan Urusan Administrasi MA RI") return "bua";
  if (courtName.startsWith("Pengadilan Tinggi Agama ")) return "pta";
  if (courtName.startsWith("Pengadilan Agama ")) return "pa";
  if (courtName.startsWith("Pengadilan Tinggi ")) return "pt";
  if (courtName.startsWith("Pengadilan Negeri ")) return "pn";
  return "other";
}

function deriveJurisdiction(courtName: string) {
  return stripCourtClassSuffix(
    courtName
      .replace(/^Pengadilan Tinggi Agama\s+/i, "")
      .replace(/^Pengadilan Agama\s+/i, "")
      .replace(/^Pengadilan Tinggi\s+/i, "")
      .replace(/^Pengadilan Negeri\s+/i, "")
      .trim()
  );
}

function deriveCourtShortName(courtName: string, courtType = deriveCourtType(courtName), jurisdiction = deriveJurisdiction(courtName)) {
  if (courtName === "Mahkamah Agung Republik Indonesia") return "Mahkamah Agung RI";
  if (courtName === "Badan Peradilan Agama") return "Ditjen Badilag";
  if (courtName === "Badan Urusan Administrasi MA RI") return "BUA MA RI";
  if (courtType === "pta") return `PTA ${jurisdiction}`;
  if (courtType === "pa") return `PA ${jurisdiction}`;
  if (courtType === "pt") return `PT ${jurisdiction}`;
  if (courtType === "pn") return `PN ${jurisdiction}`;
  return courtName;
}

function deriveSatkerLabel(courtType: CourtType, fallbackLabel?: string) {
  if (fallbackLabel) return fallbackLabel;
  if (courtType === "ma") return "Pusat / Mahkamah Agung";
  if (courtType === "badilag") return "Eselon I / Ditjen Badilag";
  if (courtType === "bua") return "Eselon I / Badan Urusan Administrasi";
  if (courtType === "pta") return "Peradilan Agama Tingkat Banding";
  if (courtType === "pa") return "Peradilan Agama Tingkat Pertama";
  if (courtType === "pt") return "Peradilan Umum Tingkat Banding";
  if (courtType === "pn") return "Peradilan Umum Tingkat Pertama";
  return "Satuan Kerja Peradilan";
}

function buildIdentity(courtName: string, overrides: Partial<InstitutionIdentity> = {}): InstitutionIdentity {
  const jurisdiction = deriveJurisdiction(courtName);
  const shortName = overrides.courtShortName ?? deriveCourtShortName(courtName);

  return {
    courtName,
    courtShortName: shortName,
    address: overrides.address ?? "",
    phoneNumber: overrides.phoneNumber ?? "",
    mobilePhone: overrides.mobilePhone ?? "",
    email: overrides.email ?? "",
    instagram: overrides.instagram ?? "",
    facebook: overrides.facebook ?? "",
    youtube: overrides.youtube ?? "",
    website: overrides.website ?? "",
    mapUrl:
      overrides.mapUrl ??
      (jurisdiction ? `https://maps.google.com/?q=${encodeURIComponent(courtName)}` : ""),
  };
}

function expandRegionAliases(region: string) {
  const normalizedRegion = normalizeQuery(region);
  const regionAliases = REGION_ALIAS_MAP[normalizedRegion] ?? [];

  return Array.from(
    new Set(
      [
        region,
        ...regionAliases,
        region.startsWith("Kota ") || region.startsWith("Kabupaten ") ? region.replace(/^(Kota|Kabupaten)\s+/i, "").trim() : undefined,
        !region.startsWith("Kota ") ? `Kota ${region}` : undefined,
        !region.startsWith("Kabupaten ") ? `Kabupaten ${region}` : undefined,
      ].filter((value): value is string => Boolean(value?.trim()))
    )
  );
}

function buildCourtTypeAliases(courtType: CourtType, jurisdiction: string) {
  if (!jurisdiction) return [];

  if (courtType === "pa") {
    return [`PA ${jurisdiction}`, `Pengadilan Agama ${jurisdiction}`];
  }
  if (courtType === "pta") {
    return [`PTA ${jurisdiction}`, `Pengadilan Tinggi Agama ${jurisdiction}`];
  }
  if (courtType === "pn") {
    return [`PN ${jurisdiction}`, `Pengadilan Negeri ${jurisdiction}`];
  }
  if (courtType === "pt") {
    return [`PT ${jurisdiction}`, `Pengadilan Tinggi ${jurisdiction}`];
  }

  return [jurisdiction];
}

function buildCourtEntry(
  id: string,
  courtName: string,
  {
    identityOverrides = {},
    aliases = [],
    courtType = deriveCourtType(courtName),
    jurisdiction = deriveJurisdiction(courtName),
    regions = [deriveJurisdiction(courtName)],
    satkerLabel,
  }: CourtEntryOptions = {}
): CourtDirectoryEntry {
  const shortName = identityOverrides.courtShortName ?? deriveCourtShortName(courtName, courtType, jurisdiction);
  const searchRegions = Array.from(new Set(regions.map((item) => item.trim()).filter(Boolean)));
  const normalizedAliases = Array.from(
    new Set(
      [
        courtName,
        stripCourtClassSuffix(courtName),
        shortName,
        jurisdiction,
        stripCourtClassSuffix(jurisdiction),
        ...buildCourtTypeAliases(courtType, jurisdiction),
        ...searchRegions.flatMap((region) => expandRegionAliases(region)),
        ...aliases,
      ]
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

  return {
    id,
    courtName,
    satkerLabel: deriveSatkerLabel(courtType, satkerLabel),
    identity: buildIdentity(courtName, {
      ...identityOverrides,
      courtShortName: shortName,
    }),
    aliases: normalizedAliases,
    courtType,
    jurisdiction,
    regions: searchRegions,
  };
}

export const courtDirectoryCatalog: CourtDirectoryEntry[] = [
  // ─── Pusat / MA ─────────────────────────────────────────────────────────────
  buildCourtEntry("ma-ri", "Mahkamah Agung Republik Indonesia", {
    identityOverrides: {
      courtShortName: "Mahkamah Agung RI",
      address: "Jl. Medan Merdeka Utara No. 9-13, Jakarta Pusat, DKI Jakarta 10110",
      phoneNumber: "(021) 3843348",
      mobilePhone: "(021) 3810350",
      email: "persuratan@mahkamahagung.go.id",
      website: "https://www.mahkamahagung.go.id",
      mapUrl: "https://maps.google.com/?q=Mahkamah+Agung+Republik+Indonesia",
    },
    regions: ["Jakarta Pusat", "DKI Jakarta"],
    aliases: ["mahkamah agung", "ma ri"],
  }),
  buildCourtEntry("badilag", "Badan Peradilan Agama", {
    identityOverrides: {
      courtShortName: "Ditjen Badilag",
      address: "Gedung Sekretariat Mahkamah Agung RI, Jakarta Pusat",
      website: "https://badilag.mahkamahagung.go.id",
      mapUrl: "https://maps.google.com/?q=Badan+Peradilan+Agama",
    },
    regions: ["Jakarta Pusat", "DKI Jakarta"],
    aliases: ["ditjen badilag", "badan peradilan agama ma ri"],
  }),
  buildCourtEntry("bua-ma", "Badan Urusan Administrasi MA RI", {
    identityOverrides: {
      courtShortName: "BUA MA RI",
      address: "Gedung Sekretariat Mahkamah Agung RI, Jakarta Pusat",
      website: "https://bua.mahkamahagung.go.id",
      mapUrl: "https://maps.google.com/?q=Badan+Urusan+Administrasi+Mahkamah+Agung",
    },
    regions: ["Jakarta Pusat", "DKI Jakarta"],
    aliases: ["bua ma", "badan urusan administrasi"],
  }),

  // ─── ACEH ───────────────────────────────────────────────────────────────────
  buildCourtEntry("pta-banda-aceh", "Pengadilan Tinggi Agama Banda Aceh", {
    identityOverrides: { website: "https://pta-bandaaceh.go.id" },
    regions: ["Banda Aceh", "Aceh"],
    aliases: ["pta aceh", "banda aceh"],
  }),
  buildCourtEntry("pt-banda-aceh", "Pengadilan Tinggi Banda Aceh", {
    identityOverrides: { website: "https://pt-bandaaceh.go.id" },
    regions: ["Banda Aceh", "Aceh"],
    aliases: ["pt aceh", "banda aceh"],
  }),
  buildCourtEntry("pa-banda-aceh", "Pengadilan Agama Banda Aceh", {
    regions: ["Banda Aceh", "Aceh"],
    aliases: ["pa aceh"],
  }),
  buildCourtEntry("pn-banda-aceh", "Pengadilan Negeri Banda Aceh", {
    regions: ["Banda Aceh", "Aceh"],
    aliases: ["pn aceh"],
  }),
  buildCourtEntry("pa-sabang", "Pengadilan Agama Sabang", { regions: ["Sabang", "Aceh"] }),
  buildCourtEntry("pa-meulaboh", "Pengadilan Agama Meulaboh", { regions: ["Meulaboh", "Aceh Barat", "Aceh"] }),
  buildCourtEntry("pa-langsa", "Pengadilan Agama Langsa", { regions: ["Langsa", "Aceh"] }),
  buildCourtEntry("pa-lhokseumawe", "Pengadilan Agama Lhokseumawe", { regions: ["Lhokseumawe", "Aceh"] }),
  buildCourtEntry("pa-sigli", "Pengadilan Agama Sigli", { regions: ["Sigli", "Pidie", "Aceh"] }),
  buildCourtEntry("pa-takengon", "Pengadilan Agama Takengon", { regions: ["Takengon", "Aceh Tengah", "Aceh"] }),
  buildCourtEntry("pa-kutacane", "Pengadilan Agama Kutacane", { regions: ["Kutacane", "Aceh Tenggara", "Aceh"] }),
  buildCourtEntry("pa-tapaktuan", "Pengadilan Agama Tapaktuan", { regions: ["Tapaktuan", "Aceh Selatan", "Aceh"] }),
  buildCourtEntry("pa-calang", "Pengadilan Agama Calang", { regions: ["Calang", "Aceh Jaya", "Aceh"] }),
  buildCourtEntry("pa-blangkejeren", "Pengadilan Agama Blangkejeren", { regions: ["Blangkejeren", "Gayo Lues", "Aceh"] }),
  buildCourtEntry("pa-singkil", "Pengadilan Agama Singkil", { regions: ["Singkil", "Aceh Singkil", "Aceh"] }),
  buildCourtEntry("pa-sinabang", "Pengadilan Agama Sinabang", { regions: ["Sinabang", "Simeulue", "Aceh"] }),

  // ─── SUMATERA UTARA ─────────────────────────────────────────────────────────
  buildCourtEntry("pta-medan", "Pengadilan Tinggi Agama Medan", {
    identityOverrides: { website: "https://pta-medan.go.id" },
    regions: ["Medan", "Sumatera Utara"],
  }),
  buildCourtEntry("pt-medan", "Pengadilan Tinggi Medan", {
    identityOverrides: { website: "https://pt-medan.go.id" },
    regions: ["Medan", "Sumatera Utara"],
  }),
  buildCourtEntry("pa-medan", "Pengadilan Agama Medan", { regions: ["Medan", "Sumatera Utara"] }),
  buildCourtEntry("pn-medan", "Pengadilan Negeri Medan", { regions: ["Medan", "Sumatera Utara"] }),
  buildCourtEntry("pa-binjai", "Pengadilan Agama Binjai", { regions: ["Binjai", "Sumatera Utara"] }),
  buildCourtEntry("pa-lubuk-pakam", "Pengadilan Agama Lubuk Pakam", { regions: ["Lubuk Pakam", "Deli Serdang", "Sumatera Utara"] }),
  buildCourtEntry("pa-tanjung-balai", "Pengadilan Agama Tanjung Balai", { regions: ["Tanjung Balai", "Sumatera Utara"] }),
  buildCourtEntry("pa-kisaran", "Pengadilan Agama Kisaran", { regions: ["Kisaran", "Asahan", "Sumatera Utara"] }),
  buildCourtEntry("pa-pematangsiantar", "Pengadilan Agama Pematangsiantar", { regions: ["Pematangsiantar", "Siantar", "Sumatera Utara"] }),
  buildCourtEntry("pa-simalungun", "Pengadilan Agama Simalungun", { regions: ["Simalungun", "Sumatera Utara"] }),
  buildCourtEntry("pa-padangsidimpuan", "Pengadilan Agama Padangsidimpuan", { regions: ["Padangsidimpuan", "Sumatera Utara"] }),
  buildCourtEntry("pa-sibolga", "Pengadilan Agama Sibolga", { regions: ["Sibolga", "Sumatera Utara"] }),
  buildCourtEntry("pa-rantau-prapat", "Pengadilan Agama Rantau Prapat", { regions: ["Rantau Prapat", "Labuhan Batu", "Sumatera Utara"] }),
  buildCourtEntry("pa-gunung-sitoli", "Pengadilan Agama Gunung Sitoli", { regions: ["Gunung Sitoli", "Nias", "Sumatera Utara"] }),
  buildCourtEntry("pa-kabanjahe", "Pengadilan Agama Kabanjahe", { regions: ["Kabanjahe", "Karo", "Sumatera Utara"] }),
  buildCourtEntry("pa-balige", "Pengadilan Agama Balige", { regions: ["Balige", "Toba", "Sumatera Utara"] }),
  buildCourtEntry("pa-stabat", "Pengadilan Agama Stabat", { regions: ["Stabat", "Langkat", "Sumatera Utara"] }),

  // ─── SUMATERA BARAT ─────────────────────────────────────────────────────────
  buildCourtEntry("pta-padang", "Pengadilan Tinggi Agama Padang", {
    identityOverrides: { website: "https://pta-padang.go.id" },
    regions: ["Padang", "Sumatera Barat"],
  }),
  buildCourtEntry("pt-padang", "Pengadilan Tinggi Padang", {
    identityOverrides: { website: "https://pt-padang.go.id" },
    regions: ["Padang", "Sumatera Barat"],
  }),
  buildCourtEntry("pa-padang", "Pengadilan Agama Padang", { regions: ["Padang", "Sumatera Barat"] }),
  buildCourtEntry("pn-padang", "Pengadilan Negeri Padang", { regions: ["Padang", "Sumatera Barat"] }),
  buildCourtEntry("pa-bukittinggi", "Pengadilan Agama Bukittinggi", { regions: ["Bukittinggi", "Sumatera Barat"] }),
  buildCourtEntry("pa-payakumbuh", "Pengadilan Agama Payakumbuh", { regions: ["Payakumbuh", "Lima Puluh Kota", "Sumatera Barat"] }),
  buildCourtEntry("pa-solok", "Pengadilan Agama Solok", { regions: ["Solok", "Sumatera Barat"] }),
  buildCourtEntry("pa-batusangkar", "Pengadilan Agama Batusangkar", { regions: ["Batusangkar", "Tanah Datar", "Sumatera Barat"] }),
  buildCourtEntry("pa-pariaman", "Pengadilan Agama Pariaman", { regions: ["Pariaman", "Padang Pariaman", "Sumatera Barat"] }),
  buildCourtEntry("pa-lubuk-basung", "Pengadilan Agama Lubuk Basung", { regions: ["Lubuk Basung", "Agam", "Sumatera Barat"] }),
  buildCourtEntry("pa-muaro", "Pengadilan Agama Muaro", { regions: ["Muaro", "Sijunjung", "Sumatera Barat"] }),
  buildCourtEntry("pa-painan", "Pengadilan Agama Painan", { regions: ["Painan", "Pesisir Selatan", "Sumatera Barat"] }),
  buildCourtEntry("pa-talu", "Pengadilan Agama Talu", { regions: ["Talu", "Pasaman Barat", "Sumatera Barat"] }),
  buildCourtEntry("pa-koto-baru", "Pengadilan Agama Koto Baru", { regions: ["Koto Baru", "Dharmasraya", "Sumatera Barat"] }),

  // ─── RIAU ────────────────────────────────────────────────────────────────────
  buildCourtEntry("pta-pekanbaru", "Pengadilan Tinggi Agama Pekanbaru", {
    identityOverrides: { website: "https://pta-pekanbaru.go.id" },
    regions: ["Pekanbaru", "Riau"],
  }),
  buildCourtEntry("pt-pekanbaru", "Pengadilan Tinggi Pekanbaru", {
    identityOverrides: { website: "https://pt-pekanbaru.go.id" },
    regions: ["Pekanbaru", "Riau"],
  }),
  buildCourtEntry("pa-pekanbaru", "Pengadilan Agama Pekanbaru", { regions: ["Pekanbaru", "Riau"] }),
  buildCourtEntry("pn-pekanbaru", "Pengadilan Negeri Pekanbaru", { regions: ["Pekanbaru", "Riau"] }),
  buildCourtEntry("pa-dumai", "Pengadilan Agama Dumai", { regions: ["Dumai", "Riau"] }),
  buildCourtEntry("pa-bangkinang", "Pengadilan Agama Bangkinang", { regions: ["Bangkinang", "Kampar", "Riau"] }),
  buildCourtEntry("pa-rengat", "Pengadilan Agama Rengat", { regions: ["Rengat", "Indragiri Hulu", "Riau"] }),
  buildCourtEntry("pa-tembilahan", "Pengadilan Agama Tembilahan", { regions: ["Tembilahan", "Indragiri Hilir", "Riau"] }),
  buildCourtEntry("pa-pasir-pangaraian", "Pengadilan Agama Pasir Pangaraian", { regions: ["Pasir Pangaraian", "Rokan Hulu", "Riau"] }),
  buildCourtEntry("pa-siak", "Pengadilan Agama Siak Sri Indrapura", {
    jurisdiction: "Siak Sri Indrapura",
    regions: ["Siak", "Siak Sri Indrapura", "Riau"],
    aliases: ["pa siak"],
  }),

  // ─── KEPULAUAN RIAU ──────────────────────────────────────────────────────────
  buildCourtEntry("pta-tanjungpinang", "Pengadilan Tinggi Agama Tanjungpinang", {
    identityOverrides: { website: "https://pta-tanjungpinang.go.id" },
    regions: ["Tanjungpinang", "Kepulauan Riau"],
    aliases: ["pta kepri", "tanjung pinang"],
  }),
  buildCourtEntry("pt-tanjungpinang", "Pengadilan Tinggi Tanjungpinang", {
    identityOverrides: { website: "https://pt-tanjungpinang.go.id" },
    regions: ["Tanjungpinang", "Kepulauan Riau"],
    aliases: ["pt kepri", "tanjung pinang"],
  }),
  buildCourtEntry("pa-tanjungpinang", "Pengadilan Agama Tanjungpinang", {
    regions: ["Tanjungpinang", "Kepulauan Riau"],
    aliases: ["tanjung pinang"],
  }),
  buildCourtEntry("pn-tanjungpinang", "Pengadilan Negeri Tanjungpinang", {
    regions: ["Tanjungpinang", "Kepulauan Riau"],
    aliases: ["tanjung pinang"],
  }),
  buildCourtEntry("pa-batam", "Pengadilan Agama Batam", { regions: ["Batam", "Kepulauan Riau"] }),
  buildCourtEntry("pn-batam", "Pengadilan Negeri Batam", { regions: ["Batam", "Kepulauan Riau"] }),
  buildCourtEntry("pa-karimun", "Pengadilan Agama Karimun", { regions: ["Karimun", "Kepulauan Riau"] }),
  buildCourtEntry("pa-ranai", "Pengadilan Agama Ranai", { regions: ["Ranai", "Natuna", "Kepulauan Riau"] }),

  // ─── JAMBI ───────────────────────────────────────────────────────────────────
  buildCourtEntry("pta-jambi", "Pengadilan Tinggi Agama Jambi", {
    identityOverrides: { website: "https://pta-jambi.go.id" },
    regions: ["Jambi", "Kota Jambi"],
  }),
  buildCourtEntry("pt-jambi", "Pengadilan Tinggi Jambi", {
    identityOverrides: { website: "https://pt-jambi.go.id" },
    regions: ["Jambi", "Kota Jambi"],
  }),
  buildCourtEntry("pa-jambi", "Pengadilan Agama Jambi", { regions: ["Jambi", "Kota Jambi"] }),
  buildCourtEntry("pn-jambi", "Pengadilan Negeri Jambi", { regions: ["Jambi", "Kota Jambi"] }),
  buildCourtEntry("pa-muara-bungo", "Pengadilan Agama Muara Bungo", { regions: ["Muara Bungo", "Bungo", "Jambi"] }),
  buildCourtEntry("pa-muara-bulian", "Pengadilan Agama Muara Bulian", { regions: ["Muara Bulian", "Batang Hari", "Jambi"] }),
  buildCourtEntry("pa-sungai-penuh", "Pengadilan Agama Sungai Penuh", { regions: ["Sungai Penuh", "Kerinci", "Jambi"] }),
  buildCourtEntry("pa-kuala-tungkal", "Pengadilan Agama Kuala Tungkal", { regions: ["Kuala Tungkal", "Tanjung Jabung Barat", "Jambi"] }),
  buildCourtEntry("pa-bangko", "Pengadilan Agama Bangko", { regions: ["Bangko", "Merangin", "Jambi"] }),
  buildCourtEntry("pa-sarolangun", "Pengadilan Agama Sarolangun", { regions: ["Sarolangun", "Jambi"] }),
  buildCourtEntry("pa-muara-sabak", "Pengadilan Agama Muara Sabak", { regions: ["Muara Sabak", "Tanjung Jabung Timur", "Jambi"] }),

  // ─── SUMATERA SELATAN ────────────────────────────────────────────────────────
  buildCourtEntry("pta-palembang", "Pengadilan Tinggi Agama Palembang", {
    identityOverrides: { website: "https://pta-palembang.go.id" },
    regions: ["Palembang", "Sumatera Selatan"],
  }),
  buildCourtEntry("pt-palembang", "Pengadilan Tinggi Palembang", {
    identityOverrides: { website: "https://pt-palembang.go.id" },
    regions: ["Palembang", "Sumatera Selatan"],
  }),
  buildCourtEntry("pa-palembang", "Pengadilan Agama Palembang", { regions: ["Palembang", "Sumatera Selatan"] }),
  buildCourtEntry("pn-palembang", "Pengadilan Negeri Palembang", { regions: ["Palembang", "Sumatera Selatan"] }),
  buildCourtEntry("pa-sekayu", "Pengadilan Agama Sekayu", { regions: ["Sekayu", "Musi Banyuasin", "Sumatera Selatan"] }),
  buildCourtEntry("pa-lahat", "Pengadilan Agama Lahat", { regions: ["Lahat", "Sumatera Selatan"] }),
  buildCourtEntry("pa-baturaja", "Pengadilan Agama Baturaja", { regions: ["Baturaja", "Ogan Komering Ulu", "Sumatera Selatan"] }),
  buildCourtEntry("pa-lubuk-linggau", "Pengadilan Agama Lubuk Linggau", { regions: ["Lubuk Linggau", "Sumatera Selatan"] }),
  buildCourtEntry("pa-muara-enim", "Pengadilan Agama Muara Enim", { regions: ["Muara Enim", "Sumatera Selatan"] }),
  buildCourtEntry("pa-kayuagung", "Pengadilan Agama Kayu Agung", {
    jurisdiction: "Kayu Agung",
    regions: ["Kayu Agung", "Ogan Komering Ilir", "Sumatera Selatan"],
    aliases: ["pa kayuagung", "pa kayu agung"],
  }),
  buildCourtEntry("pa-prabumulih", "Pengadilan Agama Prabumulih", { regions: ["Prabumulih", "Sumatera Selatan"] }),

  // ─── BANGKA BELITUNG ─────────────────────────────────────────────────────────
  buildCourtEntry("pta-bangka", "Pengadilan Tinggi Agama Bangka", {
    identityOverrides: { website: "https://pta-bangka.go.id" },
    regions: ["Pangkalpinang", "Bangka Belitung"],
    aliases: ["pta babel", "pta bangka belitung", "pangkalpinang"],
  }),
  buildCourtEntry("pt-pangkalpinang", "Pengadilan Tinggi Pangkalpinang", {
    identityOverrides: { website: "https://pt-pangkalpinang.go.id" },
    regions: ["Pangkalpinang", "Bangka Belitung"],
    aliases: ["pt babel", "pt bangka belitung"],
  }),
  buildCourtEntry("pa-pangkalpinang", "Pengadilan Agama Pangkalpinang", { regions: ["Pangkalpinang", "Bangka Belitung"] }),
  buildCourtEntry("pn-pangkalpinang", "Pengadilan Negeri Pangkalpinang", { regions: ["Pangkalpinang", "Bangka Belitung"] }),
  buildCourtEntry("pa-sungailiat", "Pengadilan Agama Sungailiat", { regions: ["Sungailiat", "Bangka", "Bangka Belitung"] }),
  buildCourtEntry("pa-toboali", "Pengadilan Agama Toboali", { regions: ["Toboali", "Bangka Selatan", "Bangka Belitung"] }),
  buildCourtEntry("pa-manggar", "Pengadilan Agama Manggar", { regions: ["Manggar", "Belitung Timur", "Bangka Belitung"] }),
  buildCourtEntry("pa-tanjung-pandan", "Pengadilan Agama Tanjung Pandan", { regions: ["Tanjung Pandan", "Belitung", "Bangka Belitung"] }),

  // ─── BENGKULU ────────────────────────────────────────────────────────────────
  buildCourtEntry("pta-bengkulu", "Pengadilan Tinggi Agama Bengkulu", {
    identityOverrides: { website: "https://pta-bengkulu.go.id" },
    regions: ["Bengkulu", "Kota Bengkulu"],
  }),
  buildCourtEntry("pt-bengkulu", "Pengadilan Tinggi Bengkulu", {
    identityOverrides: { website: "https://pt-bengkulu.go.id" },
    regions: ["Bengkulu", "Kota Bengkulu"],
  }),
  buildCourtEntry("pa-bengkulu", "Pengadilan Agama Bengkulu", { regions: ["Bengkulu", "Kota Bengkulu"] }),
  buildCourtEntry("pn-bengkulu", "Pengadilan Negeri Bengkulu", { regions: ["Bengkulu", "Kota Bengkulu"] }),
  buildCourtEntry("pa-arga-makmur", "Pengadilan Agama Arga Makmur", { regions: ["Arga Makmur", "Bengkulu Utara", "Bengkulu"] }),
  buildCourtEntry("pa-curup", "Pengadilan Agama Curup", { regions: ["Curup", "Rejang Lebong", "Bengkulu"] }),
  buildCourtEntry("pa-manna", "Pengadilan Agama Manna", { regions: ["Manna", "Bengkulu Selatan", "Bengkulu"] }),
  buildCourtEntry("pa-mukomuko", "Pengadilan Agama Mukomuko", { regions: ["Mukomuko", "Bengkulu"] }),
  buildCourtEntry("pa-tais", "Pengadilan Agama Tais", { regions: ["Tais", "Seluma", "Bengkulu"] }),

  // ─── LAMPUNG ─────────────────────────────────────────────────────────────────
  buildCourtEntry("pta-bandar-lampung", "Pengadilan Tinggi Agama Bandar Lampung", {
    identityOverrides: { website: "https://pta-bandarlampung.go.id" },
    regions: ["Bandar Lampung", "Lampung"],
    aliases: ["pta lampung"],
  }),
  buildCourtEntry("pt-tanjungkarang", "Pengadilan Tinggi Tanjungkarang", {
    jurisdiction: "Tanjungkarang",
    identityOverrides: { website: "https://pt-tanjungkarang.go.id" },
    regions: ["Bandar Lampung", "Tanjungkarang", "Lampung"],
    aliases: ["pt lampung", "pt bandar lampung", "tanjung karang"],
  }),
  buildCourtEntry("pa-tanjung-karang", "Pengadilan Agama Tanjung Karang", {
    jurisdiction: "Tanjung Karang",
    regions: ["Bandar Lampung", "Tanjung Karang", "Lampung"],
    aliases: ["pa bandar lampung", "pa lampung"],
  }),
  buildCourtEntry("pn-tanjung-karang", "Pengadilan Negeri Tanjung Karang", {
    jurisdiction: "Tanjung Karang",
    regions: ["Bandar Lampung", "Tanjung Karang", "Lampung"],
    aliases: ["pn bandar lampung", "pn lampung"],
  }),
  buildCourtEntry("pa-metro", "Pengadilan Agama Metro", { regions: ["Metro", "Lampung"] }),
  buildCourtEntry("pa-kotabumi", "Pengadilan Agama Kotabumi", { regions: ["Kotabumi", "Lampung Utara", "Lampung"] }),
  buildCourtEntry("pa-kalianda", "Pengadilan Agama Kalianda", { regions: ["Kalianda", "Lampung Selatan", "Lampung"] }),
  buildCourtEntry("pa-blambangan-umpu", "Pengadilan Agama Blambangan Umpu", { regions: ["Blambangan Umpu", "Way Kanan", "Lampung"] }),
  buildCourtEntry("pa-menggala", "Pengadilan Agama Menggala", { regions: ["Menggala", "Tulang Bawang", "Lampung"] }),
  buildCourtEntry("pa-pringsewu", "Pengadilan Agama Pringsewu", { regions: ["Pringsewu", "Lampung"] }),
  buildCourtEntry("pa-liwa", "Pengadilan Agama Liwa", { regions: ["Liwa", "Lampung Barat", "Lampung"] }),

  // ─── DKI JAKARTA ─────────────────────────────────────────────────────────────
  buildCourtEntry("pta-jakarta", "Pengadilan Tinggi Agama Jakarta", {
    identityOverrides: { website: "https://pta-jakarta.go.id" },
    regions: ["Jakarta", "DKI Jakarta"],
    aliases: ["pta dki", "pta dki jakarta"],
  }),
  buildCourtEntry("pt-dki-jakarta", "Pengadilan Tinggi DKI Jakarta", {
    jurisdiction: "DKI Jakarta",
    identityOverrides: { website: "https://pt-dkijakarta.go.id" },
    regions: ["Jakarta", "DKI Jakarta"],
    aliases: ["pt jakarta", "pt dki"],
  }),
  buildCourtEntry("pa-jakarta-pusat", "Pengadilan Agama Jakarta Pusat", {
    jurisdiction: "Jakarta Pusat",
    regions: ["Jakarta Pusat", "DKI Jakarta"],
    aliases: ["pa jakpus"],
  }),
  buildCourtEntry("pa-jakarta-selatan", "Pengadilan Agama Jakarta Selatan", {
    jurisdiction: "Jakarta Selatan",
    regions: ["Jakarta Selatan", "DKI Jakarta"],
    aliases: ["pa jaksel"],
  }),
  buildCourtEntry("pa-jakarta-timur", "Pengadilan Agama Jakarta Timur", {
    jurisdiction: "Jakarta Timur",
    regions: ["Jakarta Timur", "DKI Jakarta"],
    aliases: ["pa jaktim"],
  }),
  buildCourtEntry("pa-jakarta-barat", "Pengadilan Agama Jakarta Barat", {
    jurisdiction: "Jakarta Barat",
    regions: ["Jakarta Barat", "DKI Jakarta"],
    aliases: ["pa jakbar"],
  }),
  buildCourtEntry("pa-jakarta-utara", "Pengadilan Agama Jakarta Utara", {
    jurisdiction: "Jakarta Utara",
    regions: ["Jakarta Utara", "DKI Jakarta"],
    aliases: ["pa jakut"],
  }),
  buildCourtEntry("pn-jakarta-pusat", "Pengadilan Negeri Jakarta Pusat", {
    jurisdiction: "Jakarta Pusat",
    regions: ["Jakarta Pusat", "DKI Jakarta"],
    aliases: ["pn jakpus"],
  }),
  buildCourtEntry("pn-jakarta-selatan", "Pengadilan Negeri Jakarta Selatan", {
    jurisdiction: "Jakarta Selatan",
    regions: ["Jakarta Selatan", "DKI Jakarta"],
    aliases: ["pn jaksel"],
  }),
  buildCourtEntry("pn-jakarta-timur", "Pengadilan Negeri Jakarta Timur", {
    jurisdiction: "Jakarta Timur",
    regions: ["Jakarta Timur", "DKI Jakarta"],
    aliases: ["pn jaktim"],
  }),
  buildCourtEntry("pn-jakarta-barat", "Pengadilan Negeri Jakarta Barat", {
    jurisdiction: "Jakarta Barat",
    regions: ["Jakarta Barat", "DKI Jakarta"],
    aliases: ["pn jakbar"],
  }),
  buildCourtEntry("pn-jakarta-utara", "Pengadilan Negeri Jakarta Utara", {
    jurisdiction: "Jakarta Utara",
    regions: ["Jakarta Utara", "DKI Jakarta"],
    aliases: ["pn jakut"],
  }),

  // ─── BANTEN ──────────────────────────────────────────────────────────────────
  buildCourtEntry("pta-banten", "Pengadilan Tinggi Agama Banten", {
    identityOverrides: { website: "https://pta-banten.go.id" },
    regions: ["Serang", "Banten"],
    aliases: ["pta serang"],
  }),
  buildCourtEntry("pt-serang", "Pengadilan Tinggi Serang", {
    identityOverrides: { website: "https://pt-serang.go.id" },
    regions: ["Serang", "Banten"],
    aliases: ["pt banten"],
  }),
  buildCourtEntry("pa-serang", "Pengadilan Agama Serang", { regions: ["Serang", "Banten"] }),
  buildCourtEntry("pn-serang", "Pengadilan Negeri Serang", { regions: ["Serang", "Banten"] }),
  buildCourtEntry("pa-pandeglang", "Pengadilan Agama Pandeglang", { regions: ["Pandeglang", "Banten"] }),
  buildCourtEntry("pa-lebak", "Pengadilan Agama Lebak", { regions: ["Rangkasbitung", "Lebak", "Banten"] }),
  buildCourtEntry("pa-tangerang", "Pengadilan Agama Tangerang", { regions: ["Tangerang", "Banten"] }),
  buildCourtEntry("pn-tangerang", "Pengadilan Negeri Tangerang", { regions: ["Tangerang", "Banten"] }),
  buildCourtEntry("pa-cilegon", "Pengadilan Agama Cilegon", { regions: ["Cilegon", "Banten"] }),

  // ─── JAWA BARAT ──────────────────────────────────────────────────────────────
  buildCourtEntry("pta-bandung", "Pengadilan Tinggi Agama Bandung", {
    identityOverrides: { website: "https://pta-bandung.go.id" },
    regions: ["Bandung", "Jawa Barat"],
    aliases: ["pta jabar"],
  }),
  buildCourtEntry("pt-bandung", "Pengadilan Tinggi Bandung", {
    identityOverrides: { website: "https://pt-bandung.go.id" },
    regions: ["Bandung", "Jawa Barat"],
    aliases: ["pt jabar"],
  }),
  buildCourtEntry("pa-bandung", "Pengadilan Agama Bandung", { regions: ["Bandung", "Jawa Barat"] }),
  buildCourtEntry("pn-bandung", "Pengadilan Negeri Bandung", { regions: ["Bandung", "Jawa Barat"] }),
  buildCourtEntry("pa-bogor", "Pengadilan Agama Bogor", { regions: ["Bogor", "Jawa Barat"] }),
  buildCourtEntry("pn-bogor", "Pengadilan Negeri Bogor", { regions: ["Bogor", "Jawa Barat"] }),
  buildCourtEntry("pa-bekasi", "Pengadilan Agama Bekasi", { regions: ["Bekasi", "Jawa Barat"] }),
  buildCourtEntry("pn-bekasi", "Pengadilan Negeri Bekasi", { regions: ["Bekasi", "Jawa Barat"] }),
  buildCourtEntry("pa-depok", "Pengadilan Agama Depok", { regions: ["Depok", "Jawa Barat"] }),
  buildCourtEntry("pa-cirebon", "Pengadilan Agama Cirebon", { regions: ["Cirebon", "Jawa Barat"] }),
  buildCourtEntry("pn-cirebon", "Pengadilan Negeri Cirebon", { regions: ["Cirebon", "Jawa Barat"] }),
  buildCourtEntry("pa-karawang", "Pengadilan Agama Karawang", { regions: ["Karawang", "Jawa Barat"] }),
  buildCourtEntry("pa-sukabumi", "Pengadilan Agama Sukabumi", { regions: ["Sukabumi", "Jawa Barat"] }),
  buildCourtEntry("pa-tasikmalaya", "Pengadilan Agama Tasikmalaya", { regions: ["Tasikmalaya", "Jawa Barat"] }),
  buildCourtEntry("pa-garut", "Pengadilan Agama Garut", { regions: ["Garut", "Jawa Barat"] }),
  buildCourtEntry("pa-cianjur", "Pengadilan Agama Cianjur", { regions: ["Cianjur", "Jawa Barat"] }),
  buildCourtEntry("pa-purwakarta", "Pengadilan Agama Purwakarta", { regions: ["Purwakarta", "Jawa Barat"] }),
  buildCourtEntry("pa-subang", "Pengadilan Agama Subang", { regions: ["Subang", "Jawa Barat"] }),
  buildCourtEntry("pa-indramayu", "Pengadilan Agama Indramayu", { regions: ["Indramayu", "Jawa Barat"] }),
  buildCourtEntry("pa-sumedang", "Pengadilan Agama Sumedang", { regions: ["Sumedang", "Jawa Barat"] }),
  buildCourtEntry("pa-kuningan", "Pengadilan Agama Kuningan", { regions: ["Kuningan", "Jawa Barat"] }),
  buildCourtEntry("pa-majalengka", "Pengadilan Agama Majalengka", { regions: ["Majalengka", "Jawa Barat"] }),
  buildCourtEntry("pa-ciamis", "Pengadilan Agama Ciamis", { regions: ["Ciamis", "Jawa Barat"] }),

  // ─── JAWA TENGAH ─────────────────────────────────────────────────────────────
  buildCourtEntry("pta-semarang", "Pengadilan Tinggi Agama Semarang", {
    identityOverrides: { website: "https://pta-semarang.go.id" },
    regions: ["Semarang", "Jawa Tengah"],
    aliases: ["pta jateng"],
  }),
  buildCourtEntry("pt-semarang", "Pengadilan Tinggi Semarang", {
    identityOverrides: { website: "https://pt-semarang.go.id" },
    regions: ["Semarang", "Jawa Tengah"],
    aliases: ["pt jateng"],
  }),
  buildCourtEntry("pa-semarang", "Pengadilan Agama Semarang", { regions: ["Semarang", "Jawa Tengah"] }),
  buildCourtEntry("pn-semarang", "Pengadilan Negeri Semarang", { regions: ["Semarang", "Jawa Tengah"] }),
  buildCourtEntry("pa-surakarta", "Pengadilan Agama Surakarta", {
    regions: ["Surakarta", "Solo", "Jawa Tengah"],
    aliases: ["pa solo"],
  }),
  buildCourtEntry("pn-surakarta", "Pengadilan Negeri Surakarta", {
    regions: ["Surakarta", "Solo", "Jawa Tengah"],
    aliases: ["pn solo"],
  }),
  buildCourtEntry("pa-magelang", "Pengadilan Agama Magelang", { regions: ["Magelang", "Jawa Tengah"] }),
  buildCourtEntry("pa-purwokerto", "Pengadilan Agama Purwokerto", { regions: ["Purwokerto", "Banyumas", "Jawa Tengah"] }),
  buildCourtEntry("pa-tegal", "Pengadilan Agama Tegal", { regions: ["Tegal", "Jawa Tengah"] }),
  buildCourtEntry("pa-kudus", "Pengadilan Agama Kudus", { regions: ["Kudus", "Jawa Tengah"] }),
  buildCourtEntry("pa-pati", "Pengadilan Agama Pati", { regions: ["Pati", "Jawa Tengah"] }),
  buildCourtEntry("pa-kendal-jateng", "Pengadilan Agama Kendal", {
    jurisdiction: "Kendal",
    regions: ["Kendal", "Jawa Tengah"],
  }),
  buildCourtEntry("pa-klaten", "Pengadilan Agama Klaten", { regions: ["Klaten", "Jawa Tengah"] }),
  buildCourtEntry("pa-cilacap", "Pengadilan Agama Cilacap", { regions: ["Cilacap", "Jawa Tengah"] }),
  buildCourtEntry("pa-banyumas", "Pengadilan Agama Banyumas", { regions: ["Banyumas", "Jawa Tengah"] }),
  buildCourtEntry("pa-kebumen", "Pengadilan Agama Kebumen", { regions: ["Kebumen", "Jawa Tengah"] }),
  buildCourtEntry("pa-purworejo", "Pengadilan Agama Purworejo", { regions: ["Purworejo", "Jawa Tengah"] }),
  buildCourtEntry("pa-wonosobo", "Pengadilan Agama Wonosobo", { regions: ["Wonosobo", "Jawa Tengah"] }),
  buildCourtEntry("pa-salatiga", "Pengadilan Agama Salatiga", { regions: ["Salatiga", "Jawa Tengah"] }),
  buildCourtEntry("pa-blora", "Pengadilan Agama Blora", { regions: ["Blora", "Jawa Tengah"] }),
  buildCourtEntry("pa-boyolali", "Pengadilan Agama Boyolali", { regions: ["Boyolali", "Jawa Tengah"] }),
  buildCourtEntry("pa-brebes", "Pengadilan Agama Brebes", { regions: ["Brebes", "Jawa Tengah"] }),
  buildCourtEntry("pa-demak", "Pengadilan Agama Demak", { regions: ["Demak", "Jawa Tengah"] }),
  buildCourtEntry("pa-grobogan", "Pengadilan Agama Grobogan", { regions: ["Grobogan", "Purwodadi", "Jawa Tengah"] }),
  buildCourtEntry("pa-jepara", "Pengadilan Agama Jepara", { regions: ["Jepara", "Jawa Tengah"] }),
  buildCourtEntry("pa-karanganyar", "Pengadilan Agama Karanganyar", { regions: ["Karanganyar", "Jawa Tengah"] }),
  buildCourtEntry("pa-pemalang", "Pengadilan Agama Pemalang", { regions: ["Pemalang", "Jawa Tengah"] }),
  buildCourtEntry("pa-purbalingga", "Pengadilan Agama Purbalingga", { regions: ["Purbalingga", "Jawa Tengah"] }),
  buildCourtEntry("pa-rembang", "Pengadilan Agama Rembang", { regions: ["Rembang", "Jawa Tengah"] }),
  buildCourtEntry("pa-sragen", "Pengadilan Agama Sragen", { regions: ["Sragen", "Jawa Tengah"] }),
  buildCourtEntry("pa-temanggung", "Pengadilan Agama Temanggung", { regions: ["Temanggung", "Jawa Tengah"] }),
  buildCourtEntry("pa-wonogiri", "Pengadilan Agama Wonogiri", { regions: ["Wonogiri", "Jawa Tengah"] }),
  buildCourtEntry("pa-batang", "Pengadilan Agama Batang", { regions: ["Batang", "Jawa Tengah"] }),
  buildCourtEntry("pa-banjarnegara", "Pengadilan Agama Banjarnegara", { regions: ["Banjarnegara", "Jawa Tengah"] }),

  // ─── DI YOGYAKARTA ───────────────────────────────────────────────────────────
  buildCourtEntry("pta-yogyakarta", "Pengadilan Tinggi Agama Yogyakarta", {
    identityOverrides: { website: "https://pta-yogyakarta.go.id" },
    regions: ["Yogyakarta", "DI Yogyakarta"],
    aliases: ["pta diy", "pta jogja"],
  }),
  buildCourtEntry("pt-yogyakarta", "Pengadilan Tinggi Yogyakarta", {
    identityOverrides: { website: "https://pt-yogyakarta.go.id" },
    regions: ["Yogyakarta", "DI Yogyakarta"],
    aliases: ["pt diy", "pt jogja"],
  }),
  buildCourtEntry("pa-yogyakarta", "Pengadilan Agama Yogyakarta", {
    regions: ["Yogyakarta", "DI Yogyakarta"],
    aliases: ["pa jogja"],
  }),
  buildCourtEntry("pn-yogyakarta", "Pengadilan Negeri Yogyakarta", {
    regions: ["Yogyakarta", "DI Yogyakarta"],
    aliases: ["pn jogja"],
  }),
  buildCourtEntry("pa-bantul", "Pengadilan Agama Bantul", { regions: ["Bantul", "DI Yogyakarta"] }),
  buildCourtEntry("pa-sleman", "Pengadilan Agama Sleman", { regions: ["Sleman", "DI Yogyakarta"] }),
  buildCourtEntry("pa-wates", "Pengadilan Agama Wates", { regions: ["Wates", "Kulonprogo", "DI Yogyakarta"] }),
  buildCourtEntry("pa-wonosari-diy", "Pengadilan Agama Wonosari", {
    jurisdiction: "Wonosari",
    regions: ["Wonosari", "Gunung Kidul", "DI Yogyakarta"],
  }),

  // ─── JAWA TIMUR ──────────────────────────────────────────────────────────────
  buildCourtEntry("pta-surabaya", "Pengadilan Tinggi Agama Surabaya", {
    identityOverrides: { website: "https://pta-surabaya.go.id" },
    regions: ["Surabaya", "Jawa Timur"],
    aliases: ["pta jatim"],
  }),
  buildCourtEntry("pt-surabaya", "Pengadilan Tinggi Surabaya", {
    identityOverrides: { website: "https://pt-surabaya.go.id" },
    regions: ["Surabaya", "Jawa Timur"],
    aliases: ["pt jatim"],
  }),
  buildCourtEntry("pa-surabaya", "Pengadilan Agama Surabaya", { regions: ["Surabaya", "Jawa Timur"] }),
  buildCourtEntry("pn-surabaya", "Pengadilan Negeri Surabaya", { regions: ["Surabaya", "Jawa Timur"] }),
  buildCourtEntry("pa-sidoarjo", "Pengadilan Agama Sidoarjo", { regions: ["Sidoarjo", "Jawa Timur"] }),
  buildCourtEntry("pn-sidoarjo", "Pengadilan Negeri Sidoarjo", { regions: ["Sidoarjo", "Jawa Timur"] }),
  buildCourtEntry("pa-malang", "Pengadilan Agama Malang", { regions: ["Malang", "Jawa Timur"] }),
  buildCourtEntry("pn-malang", "Pengadilan Negeri Malang", { regions: ["Malang", "Jawa Timur"] }),
  buildCourtEntry("pa-mojokerto", "Pengadilan Agama Mojokerto", { regions: ["Mojokerto", "Jawa Timur"] }),
  buildCourtEntry("pa-pasuruan", "Pengadilan Agama Pasuruan", { regions: ["Pasuruan", "Jawa Timur"] }),
  buildCourtEntry("pa-probolinggo", "Pengadilan Agama Probolinggo", { regions: ["Probolinggo", "Jawa Timur"] }),
  buildCourtEntry("pa-banyuwangi", "Pengadilan Agama Banyuwangi", { regions: ["Banyuwangi", "Jawa Timur"] }),
  buildCourtEntry("pa-jember", "Pengadilan Agama Jember", { regions: ["Jember", "Jawa Timur"] }),
  buildCourtEntry("pa-jombang", "Pengadilan Agama Jombang", { regions: ["Jombang", "Jawa Timur"] }),
  buildCourtEntry("pa-kediri", "Pengadilan Agama Kediri", { regions: ["Kediri", "Jawa Timur"] }),
  buildCourtEntry("pa-lumajang", "Pengadilan Agama Lumajang", { regions: ["Lumajang", "Jawa Timur"] }),
  buildCourtEntry("pa-madiun", "Pengadilan Agama Madiun", { regions: ["Madiun", "Jawa Timur"] }),
  buildCourtEntry("pa-ngawi", "Pengadilan Agama Ngawi", { regions: ["Ngawi", "Jawa Timur"] }),
  buildCourtEntry("pa-blitar", "Pengadilan Agama Blitar", { regions: ["Blitar", "Jawa Timur"] }),
  buildCourtEntry("pa-bojonegoro", "Pengadilan Agama Bojonegoro", { regions: ["Bojonegoro", "Jawa Timur"] }),
  buildCourtEntry("pa-gresik", "Pengadilan Agama Gresik", { regions: ["Gresik", "Jawa Timur"] }),
  buildCourtEntry("pa-lamongan", "Pengadilan Agama Lamongan", { regions: ["Lamongan", "Jawa Timur"] }),
  buildCourtEntry("pa-magetan", "Pengadilan Agama Magetan", { regions: ["Magetan", "Jawa Timur"] }),
  buildCourtEntry("pa-nganjuk", "Pengadilan Agama Nganjuk", { regions: ["Nganjuk", "Jawa Timur"] }),
  buildCourtEntry("pa-pamekasan", "Pengadilan Agama Pamekasan", { regions: ["Pamekasan", "Madura", "Jawa Timur"] }),
  buildCourtEntry("pa-ponorogo", "Pengadilan Agama Ponorogo", { regions: ["Ponorogo", "Jawa Timur"] }),
  buildCourtEntry("pa-situbondo", "Pengadilan Agama Situbondo", { regions: ["Situbondo", "Jawa Timur"] }),
  buildCourtEntry("pa-sumenep", "Pengadilan Agama Sumenep", { regions: ["Sumenep", "Madura", "Jawa Timur"] }),
  buildCourtEntry("pa-trenggalek", "Pengadilan Agama Trenggalek", { regions: ["Trenggalek", "Jawa Timur"] }),
  buildCourtEntry("pa-tuban", "Pengadilan Agama Tuban", { regions: ["Tuban", "Jawa Timur"] }),
  buildCourtEntry("pa-tulungagung", "Pengadilan Agama Tulungagung", { regions: ["Tulungagung", "Jawa Timur"] }),
  buildCourtEntry("pa-bangkalan", "Pengadilan Agama Bangkalan", { regions: ["Bangkalan", "Madura", "Jawa Timur"] }),
  buildCourtEntry("pa-sampang", "Pengadilan Agama Sampang", { regions: ["Sampang", "Madura", "Jawa Timur"] }),

  // ─── BALI ────────────────────────────────────────────────────────────────────
  buildCourtEntry("pta-denpasar", "Pengadilan Tinggi Agama Denpasar", {
    identityOverrides: { website: "https://pta-denpasar.go.id" },
    regions: ["Denpasar", "Bali"],
    aliases: ["pta bali"],
  }),
  buildCourtEntry("pt-denpasar", "Pengadilan Tinggi Denpasar", {
    identityOverrides: { website: "https://pt-denpasar.go.id" },
    regions: ["Denpasar", "Bali"],
    aliases: ["pt bali"],
  }),
  buildCourtEntry("pa-denpasar", "Pengadilan Agama Denpasar", { regions: ["Denpasar", "Bali"] }),
  buildCourtEntry("pn-denpasar", "Pengadilan Negeri Denpasar", { regions: ["Denpasar", "Bali"] }),
  buildCourtEntry("pa-singaraja", "Pengadilan Agama Singaraja", { regions: ["Singaraja", "Buleleng", "Bali"] }),
  buildCourtEntry("pa-gianyar", "Pengadilan Agama Gianyar", { regions: ["Gianyar", "Bali"] }),

  // ─── NUSA TENGGARA BARAT ─────────────────────────────────────────────────────
  buildCourtEntry("pta-mataram", "Pengadilan Tinggi Agama Mataram", {
    identityOverrides: { website: "https://pta-mataram.go.id" },
    regions: ["Mataram", "NTB", "Nusa Tenggara Barat"],
    aliases: ["pta ntb"],
  }),
  buildCourtEntry("pt-mataram", "Pengadilan Tinggi Mataram", {
    identityOverrides: { website: "https://pt-mataram.go.id" },
    regions: ["Mataram", "NTB", "Nusa Tenggara Barat"],
    aliases: ["pt ntb"],
  }),
  buildCourtEntry("pa-mataram", "Pengadilan Agama Mataram", { regions: ["Mataram", "NTB", "Nusa Tenggara Barat"] }),
  buildCourtEntry("pn-mataram", "Pengadilan Negeri Mataram", { regions: ["Mataram", "NTB", "Nusa Tenggara Barat"] }),
  buildCourtEntry("pa-praya", "Pengadilan Agama Praya", { regions: ["Praya", "Lombok Tengah", "NTB"] }),
  buildCourtEntry("pa-selong", "Pengadilan Agama Selong", { regions: ["Selong", "Lombok Timur", "NTB"] }),
  buildCourtEntry("pa-sumbawa-besar", "Pengadilan Agama Sumbawa Besar", { regions: ["Sumbawa Besar", "Sumbawa", "NTB"] }),
  buildCourtEntry("pa-dompu", "Pengadilan Agama Dompu", { regions: ["Dompu", "NTB"] }),
  buildCourtEntry("pa-bima", "Pengadilan Agama Bima", { regions: ["Bima", "NTB"] }),
  buildCourtEntry("pa-tanjung-ntb", "Pengadilan Agama Tanjung", {
    jurisdiction: "Tanjung",
    regions: ["Tanjung", "Lombok Utara", "NTB"],
  }),

  // ─── NUSA TENGGARA TIMUR ─────────────────────────────────────────────────────
  buildCourtEntry("pta-kupang", "Pengadilan Tinggi Agama Kupang", {
    identityOverrides: { website: "https://pta-kupang.go.id" },
    regions: ["Kupang", "NTT", "Nusa Tenggara Timur"],
    aliases: ["pta ntt"],
  }),
  buildCourtEntry("pt-kupang", "Pengadilan Tinggi Kupang", {
    identityOverrides: { website: "https://pt-kupang.go.id" },
    regions: ["Kupang", "NTT", "Nusa Tenggara Timur"],
    aliases: ["pt ntt"],
  }),
  buildCourtEntry("pa-kupang", "Pengadilan Agama Kupang", { regions: ["Kupang", "NTT"] }),
  buildCourtEntry("pn-kupang", "Pengadilan Negeri Kupang", { regions: ["Kupang", "NTT"] }),
  buildCourtEntry("pn-ende", "Pengadilan Negeri Ende", { regions: ["Ende", "Flores", "NTT"] }),
  buildCourtEntry("pn-maumere", "Pengadilan Negeri Maumere", { regions: ["Maumere", "Sikka", "NTT"] }),
  buildCourtEntry("pn-ruteng", "Pengadilan Negeri Ruteng", { regions: ["Ruteng", "Manggarai", "NTT"] }),
  buildCourtEntry("pn-labuan-bajo", "Pengadilan Negeri Labuan Bajo", { regions: ["Labuan Bajo", "Manggarai Barat", "NTT"] }),
  buildCourtEntry("pn-waikabubak", "Pengadilan Negeri Waikabubak", { regions: ["Waikabubak", "Sumba Barat", "NTT"] }),

  // ─── KALIMANTAN BARAT ────────────────────────────────────────────────────────
  buildCourtEntry("pta-pontianak", "Pengadilan Tinggi Agama Pontianak", {
    identityOverrides: { website: "https://pta-pontianak.go.id" },
    regions: ["Pontianak", "Kalimantan Barat"],
    aliases: ["pta kalbar"],
  }),
  buildCourtEntry("pt-pontianak", "Pengadilan Tinggi Pontianak", {
    identityOverrides: { website: "https://pt-pontianak.go.id" },
    regions: ["Pontianak", "Kalimantan Barat"],
    aliases: ["pt kalbar"],
  }),
  buildCourtEntry("pa-pontianak", "Pengadilan Agama Pontianak", { regions: ["Pontianak", "Kalimantan Barat"] }),
  buildCourtEntry("pn-pontianak", "Pengadilan Negeri Pontianak", { regions: ["Pontianak", "Kalimantan Barat"] }),
  buildCourtEntry("pa-ketapang", "Pengadilan Agama Ketapang", { regions: ["Ketapang", "Kalimantan Barat"] }),
  buildCourtEntry("pa-mempawah", "Pengadilan Agama Mempawah", { regions: ["Mempawah", "Kalimantan Barat"] }),
  buildCourtEntry("pa-sambas", "Pengadilan Agama Sambas", { regions: ["Sambas", "Kalimantan Barat"] }),
  buildCourtEntry("pa-singkawang", "Pengadilan Agama Singkawang", { regions: ["Singkawang", "Kalimantan Barat"] }),
  buildCourtEntry("pa-sanggau", "Pengadilan Agama Sanggau", { regions: ["Sanggau", "Kalimantan Barat"] }),
  buildCourtEntry("pa-sintang", "Pengadilan Agama Sintang", { regions: ["Sintang", "Kalimantan Barat"] }),
  buildCourtEntry("pa-putussibau", "Pengadilan Agama Putussibau", { regions: ["Putussibau", "Kapuas Hulu", "Kalimantan Barat"] }),
  buildCourtEntry("pa-ngabang", "Pengadilan Agama Ngabang", { regions: ["Ngabang", "Landak", "Kalimantan Barat"] }),

  // ─── KALIMANTAN TENGAH ───────────────────────────────────────────────────────
  buildCourtEntry("pta-palangkaraya", "Pengadilan Tinggi Agama Palangka Raya", {
    jurisdiction: "Palangka Raya",
    identityOverrides: { website: "https://pta-palangkaraya.go.id" },
    regions: ["Palangka Raya", "Palangkaraya", "Kalimantan Tengah"],
    aliases: ["pta kalteng", "pta palangkaraya"],
  }),
  buildCourtEntry("pt-palangkaraya", "Pengadilan Tinggi Palangka Raya", {
    jurisdiction: "Palangka Raya",
    identityOverrides: { website: "https://pt-palangkaraya.go.id" },
    regions: ["Palangka Raya", "Palangkaraya", "Kalimantan Tengah"],
    aliases: ["pt kalteng", "pt palangkaraya"],
  }),
  buildCourtEntry("pa-palangkaraya", "Pengadilan Agama Palangka Raya", {
    jurisdiction: "Palangka Raya",
    regions: ["Palangka Raya", "Palangkaraya", "Kalimantan Tengah"],
    aliases: ["pa palangkaraya"],
  }),
  buildCourtEntry("pn-palangkaraya", "Pengadilan Negeri Palangka Raya", {
    jurisdiction: "Palangka Raya",
    regions: ["Palangka Raya", "Palangkaraya", "Kalimantan Tengah"],
    aliases: ["pn palangkaraya"],
  }),
  buildCourtEntry("pa-sampit", "Pengadilan Agama Sampit", { regions: ["Sampit", "Kotawaringin Timur", "Kalimantan Tengah"] }),
  buildCourtEntry("pa-kuala-kapuas", "Pengadilan Agama Kuala Kapuas", { regions: ["Kuala Kapuas", "Kapuas", "Kalimantan Tengah"] }),
  buildCourtEntry("pa-buntok", "Pengadilan Agama Buntok", { regions: ["Buntok", "Barito Selatan", "Kalimantan Tengah"] }),
  buildCourtEntry("pa-pangkalan-bun", "Pengadilan Agama Pangkalan Bun", { regions: ["Pangkalan Bun", "Kotawaringin Barat", "Kalimantan Tengah"] }),
  buildCourtEntry("pa-muara-teweh", "Pengadilan Agama Muara Teweh", { regions: ["Muara Teweh", "Barito Utara", "Kalimantan Tengah"] }),
  buildCourtEntry("pa-kasongan", "Pengadilan Agama Kasongan", { regions: ["Kasongan", "Katingan", "Kalimantan Tengah"] }),
  buildCourtEntry("pa-sukamara", "Pengadilan Agama Sukamara", { regions: ["Sukamara", "Kalimantan Tengah"] }),
  buildCourtEntry("pa-tamiang-layang", "Pengadilan Agama Tamiang Layang", { regions: ["Tamiang Layang", "Barito Timur", "Kalimantan Tengah"] }),

  // ─── KALIMANTAN SELATAN ──────────────────────────────────────────────────────
  buildCourtEntry("pta-banjarmasin", "Pengadilan Tinggi Agama Banjarmasin", {
    identityOverrides: { website: "https://pta-banjarmasin.go.id" },
    regions: ["Banjarmasin", "Kalimantan Selatan"],
    aliases: ["pta kalsel"],
  }),
  buildCourtEntry("pt-banjarmasin", "Pengadilan Tinggi Banjarmasin", {
    identityOverrides: { website: "https://pt-banjarmasin.go.id" },
    regions: ["Banjarmasin", "Kalimantan Selatan"],
    aliases: ["pt kalsel"],
  }),
  buildCourtEntry("pa-banjarmasin", "Pengadilan Agama Banjarmasin", { regions: ["Banjarmasin", "Kalimantan Selatan"] }),
  buildCourtEntry("pn-banjarmasin", "Pengadilan Negeri Banjarmasin", { regions: ["Banjarmasin", "Kalimantan Selatan"] }),
  buildCourtEntry("pa-martapura", "Pengadilan Agama Martapura", { regions: ["Martapura", "Banjar", "Kalimantan Selatan"] }),
  buildCourtEntry("pa-rantau-kalsel", "Pengadilan Agama Rantau", {
    jurisdiction: "Rantau",
    regions: ["Rantau", "Tapin", "Kalimantan Selatan"],
  }),
  buildCourtEntry("pa-tanjung-tabalong", "Pengadilan Agama Tanjung", {
    jurisdiction: "Tanjung",
    regions: ["Tanjung", "Tabalong", "Kalimantan Selatan"],
  }),
  buildCourtEntry("pa-pelaihari", "Pengadilan Agama Pelaihari", { regions: ["Pelaihari", "Tanah Laut", "Kalimantan Selatan"] }),
  buildCourtEntry("pa-kandangan", "Pengadilan Agama Kandangan", { regions: ["Kandangan", "Hulu Sungai Selatan", "Kalimantan Selatan"] }),
  buildCourtEntry("pa-amuntai", "Pengadilan Agama Amuntai", { regions: ["Amuntai", "Hulu Sungai Utara", "Kalimantan Selatan"] }),
  buildCourtEntry("pa-marabahan", "Pengadilan Agama Marabahan", { regions: ["Marabahan", "Barito Kuala", "Kalimantan Selatan"] }),
  buildCourtEntry("pa-kotabaru", "Pengadilan Agama Kotabaru", { regions: ["Kotabaru", "Kalimantan Selatan"] }),
  buildCourtEntry("pa-batulicin", "Pengadilan Agama Batulicin", { regions: ["Batulicin", "Tanah Bumbu", "Kalimantan Selatan"] }),
  buildCourtEntry("pa-barabai", "Pengadilan Agama Barabai", { regions: ["Barabai", "Hulu Sungai Tengah", "Kalimantan Selatan"] }),

  // ─── KALIMANTAN TIMUR ────────────────────────────────────────────────────────
  buildCourtEntry("pta-samarinda", "Pengadilan Tinggi Agama Samarinda", {
    identityOverrides: { website: "https://pta-samarinda.go.id" },
    regions: ["Samarinda", "Kalimantan Timur"],
    aliases: ["pta kaltim"],
  }),
  buildCourtEntry("pt-samarinda", "Pengadilan Tinggi Samarinda", {
    identityOverrides: { website: "https://pt-samarinda.go.id" },
    regions: ["Samarinda", "Kalimantan Timur"],
    aliases: ["pt kaltim"],
  }),
  buildCourtEntry("pa-samarinda", "Pengadilan Agama Samarinda", { regions: ["Samarinda", "Kalimantan Timur"] }),
  buildCourtEntry("pn-samarinda", "Pengadilan Negeri Samarinda", { regions: ["Samarinda", "Kalimantan Timur"] }),
  buildCourtEntry("pa-balikpapan", "Pengadilan Agama Balikpapan", { regions: ["Balikpapan", "Kalimantan Timur"] }),
  buildCourtEntry("pn-balikpapan", "Pengadilan Negeri Balikpapan", { regions: ["Balikpapan", "Kalimantan Timur"] }),
  buildCourtEntry("pa-tenggarong", "Pengadilan Agama Tenggarong", { regions: ["Tenggarong", "Kutai Kartanegara", "Kalimantan Timur"] }),
  buildCourtEntry("pa-sangatta", "Pengadilan Agama Sangatta", { regions: ["Sangatta", "Kutai Timur", "Kalimantan Timur"] }),
  buildCourtEntry("pa-tanjung-redeb", "Pengadilan Agama Tanjung Redeb", { regions: ["Tanjung Redeb", "Berau", "Kalimantan Timur"] }),
  buildCourtEntry("pa-sendawar", "Pengadilan Agama Sendawar", { regions: ["Sendawar", "Kutai Barat", "Kalimantan Timur"] }),

  // ─── KALIMANTAN UTARA ────────────────────────────────────────────────────────
  buildCourtEntry("pta-tanjung-selor", "Pengadilan Tinggi Agama Tanjung Selor", {
    identityOverrides: { website: "https://pta-tanjungselor.go.id" },
    regions: ["Tanjung Selor", "Kalimantan Utara"],
    aliases: ["pta kaltara"],
  }),
  buildCourtEntry("pt-tanjung-selor", "Pengadilan Tinggi Tanjung Selor", {
    identityOverrides: { website: "https://pt-tanjungselor.go.id" },
    regions: ["Tanjung Selor", "Kalimantan Utara"],
    aliases: ["pt kaltara"],
  }),
  buildCourtEntry("pa-tanjung-selor", "Pengadilan Agama Tanjung Selor", { regions: ["Tanjung Selor", "Bulungan", "Kalimantan Utara"] }),
  buildCourtEntry("pn-tanjung-selor", "Pengadilan Negeri Tanjung Selor", { regions: ["Tanjung Selor", "Bulungan", "Kalimantan Utara"] }),
  buildCourtEntry("pa-nunukan", "Pengadilan Agama Nunukan", { regions: ["Nunukan", "Kalimantan Utara"] }),
  buildCourtEntry("pa-tarakan", "Pengadilan Agama Tarakan", { regions: ["Tarakan", "Kalimantan Utara"] }),

  // ─── SULAWESI UTARA ──────────────────────────────────────────────────────────
  buildCourtEntry("pta-manado", "Pengadilan Tinggi Agama Manado", {
    identityOverrides: { website: "https://pta-manado.go.id" },
    regions: ["Manado", "Sulawesi Utara"],
    aliases: ["pta sulut"],
  }),
  buildCourtEntry("pt-manado", "Pengadilan Tinggi Manado", {
    identityOverrides: { website: "https://pt-manado.go.id" },
    regions: ["Manado", "Sulawesi Utara"],
    aliases: ["pt sulut"],
  }),
  buildCourtEntry("pa-manado", "Pengadilan Agama Manado", { regions: ["Manado", "Sulawesi Utara"] }),
  buildCourtEntry("pn-manado", "Pengadilan Negeri Manado", { regions: ["Manado", "Sulawesi Utara"] }),
  buildCourtEntry("pa-kotamobagu", "Pengadilan Agama Kotamobagu", { regions: ["Kotamobagu", "Sulawesi Utara"] }),
  buildCourtEntry("pa-amurang", "Pengadilan Agama Amurang", { regions: ["Amurang", "Minahasa Selatan", "Sulawesi Utara"] }),
  buildCourtEntry("pn-bitung", "Pengadilan Negeri Bitung", { regions: ["Bitung", "Sulawesi Utara"] }),

  // ─── GORONTALO ───────────────────────────────────────────────────────────────
  buildCourtEntry("pta-gorontalo", "Pengadilan Tinggi Agama Gorontalo", {
    identityOverrides: { website: "https://pta-gorontalo.go.id" },
    regions: ["Gorontalo", "Kota Gorontalo"],
  }),
  buildCourtEntry("pt-gorontalo", "Pengadilan Tinggi Gorontalo", {
    identityOverrides: { website: "https://pt-gorontalo.go.id" },
    regions: ["Gorontalo", "Kota Gorontalo"],
  }),
  buildCourtEntry("pa-gorontalo", "Pengadilan Agama Gorontalo", { regions: ["Gorontalo", "Kota Gorontalo"] }),
  buildCourtEntry("pn-gorontalo", "Pengadilan Negeri Gorontalo", { regions: ["Gorontalo", "Kota Gorontalo"] }),
  buildCourtEntry("pa-limboto", "Pengadilan Agama Limboto", { regions: ["Limboto", "Gorontalo", "Kabupaten Gorontalo"] }),
  buildCourtEntry("pa-marisa", "Pengadilan Agama Marisa", { regions: ["Marisa", "Pohuwato", "Gorontalo"] }),
  buildCourtEntry("pa-isimu", "Pengadilan Agama Isimu", { regions: ["Isimu", "Gorontalo Utara", "Gorontalo"] }),
  buildCourtEntry("pa-tilamuta", "Pengadilan Agama Tilamuta", { regions: ["Tilamuta", "Boalemo", "Gorontalo"] }),
  buildCourtEntry("pa-kwandang", "Pengadilan Agama Kwandang", { regions: ["Kwandang", "Gorontalo Utara", "Gorontalo"] }),

  // ─── SULAWESI TENGAH (existing + additional) ─────────────────────────────────
  buildCourtEntry("pta-palu", "Pengadilan Tinggi Agama Palu", {
    identityOverrides: {
      courtShortName: "PTA Palu",
      address: "Jln. Prof. Moh. Yamin No. 36, Palu, Sulawesi Tengah",
      phoneNumber: "(0451) 487285",
      website: "https://pta-palu.go.id",
      mapUrl: "https://maps.google.com/?q=Pengadilan+Tinggi+Agama+Palu",
    },
    regions: ["Palu", "Kota Palu", "Sulawesi Tengah"],
    aliases: ["pta palu", "pengadilan tinggi agama palu", "palu", "pta sulteng"],
  }),
  buildCourtEntry("pa-palu", "Pengadilan Agama Palu Kelas IA", {
    jurisdiction: "Palu",
    identityOverrides: {
      courtShortName: "PA Palu",
      address: "Jl. WR. Supratman No. 10, Kelurahan Lere, Kecamatan Palu Barat, Kota Palu, Sulawesi Tengah",
      phoneNumber: "(0451) 421156",
      website: "https://pa-palu.go.id",
      mapUrl: "https://maps.google.com/?q=Pengadilan+Agama+Palu",
    },
    regions: ["Palu", "Kota Palu", "Sulawesi Tengah"],
    aliases: ["pa palu", "pengadilan agama palu", "palu barat"],
  }),
  buildCourtEntry("pn-palu", "Pengadilan Negeri Palu", {
    identityOverrides: {
      courtShortName: "PN Palu",
      address: "Jl. Dr. Samratulangi No. 46, Palu, Sulawesi Tengah",
      phoneNumber: "(0451) 421250",
      email: "pnpalu@gmail.com",
      instagram: "@pengadilan_negeri_palu",
      facebook: "Pengadilan Negeri Palu",
      youtube: "Pengadilan Negeri Palu",
      website: "https://www.pn-palu.go.id",
      mapUrl: "https://maps.google.com/?q=Pengadilan+Negeri+Palu",
    },
    regions: ["Palu", "Kota Palu", "Sulawesi Tengah"],
    aliases: ["pn palu", "pengadilan negeri palu", "palu", "kelas ia phi tipikor"],
  }),
  buildCourtEntry("pt-sulteng", "Pengadilan Tinggi Sulawesi Tengah", {
    identityOverrides: {
      courtShortName: "PT Sulteng",
      address: "Jl. Prof. Moh. Yamin, S.H. No. 1, Kel. Tanamodindi, Kec. Mantikulore, Kota Palu, Prov. Sulawesi Tengah",
      phoneNumber: "(0451) 424784",
      mobilePhone: "082352178980",
      instagram: "@pengadilantinggi.sulteng",
      facebook: "@pengadilantinggi.sulteng",
      youtube: "Pengadilan Tinggi Sulawesi Tengah",
      website: "https://www.pt-palu.go.id",
      mapUrl: "https://maps.google.com/?q=Pengadilan+Tinggi+Sulawesi+Tengah",
    },
    regions: ["Palu", "Kota Palu", "Sulawesi Tengah", "Sulteng"],
    aliases: ["pt palu", "pengadilan tinggi palu", "pengadilan tinggi sulawesi tengah", "pt sulteng", "palu"],
  }),
  buildCourtEntry("pa-donggala", "Pengadilan Agama Donggala", {
    identityOverrides: {
      courtShortName: "PA Donggala",
      mapUrl: "https://maps.google.com/?q=Pengadilan+Agama+Donggala",
    },
    regions: ["Donggala", "Sulawesi Tengah"],
    aliases: ["pa donggala", "donggala", "pengadilan agama donggala"],
  }),
  buildCourtEntry("pa-sigi", "Pengadilan Agama Sigi", { regions: ["Sigi", "Sigi Biromaru", "Sulawesi Tengah"] }),
  buildCourtEntry("pa-tolitoli", "Pengadilan Agama Tolitoli", {
    regions: ["Tolitoli", "Toli-Toli", "Sulawesi Tengah"],
    aliases: ["pa toli-toli", "pa toli toli"],
  }),
  buildCourtEntry("pa-buol", "Pengadilan Agama Buol", { regions: ["Buol", "Sulawesi Tengah"] }),
  buildCourtEntry("pa-poso", "Pengadilan Agama Poso", { regions: ["Poso", "Sulawesi Tengah"] }),
  buildCourtEntry("pa-parigi", "Pengadilan Agama Parigi", { regions: ["Parigi", "Parigi Moutong", "Sulawesi Tengah"] }),
  buildCourtEntry("pa-luwuk", "Pengadilan Agama Luwuk", { regions: ["Luwuk", "Banggai", "Sulawesi Tengah"] }),
  buildCourtEntry("pa-ampana", "Pengadilan Agama Ampana", { regions: ["Ampana", "Tojo Una-Una", "Sulawesi Tengah"] }),
  buildCourtEntry("pa-morowali", "Pengadilan Agama Morowali", { regions: ["Morowali", "Bungku", "Sulawesi Tengah"] }),
  buildCourtEntry("pa-kolonedale", "Pengadilan Agama Kolonedale", { regions: ["Kolonedale", "Morowali Utara", "Sulawesi Tengah"] }),
  buildCourtEntry("pn-donggala", "Pengadilan Negeri Donggala", { regions: ["Donggala", "Sulawesi Tengah"] }),
  buildCourtEntry("pn-poso", "Pengadilan Negeri Poso", { regions: ["Poso", "Sulawesi Tengah"] }),
  buildCourtEntry("pn-luwuk", "Pengadilan Negeri Luwuk", { regions: ["Luwuk", "Banggai", "Sulawesi Tengah"] }),
  buildCourtEntry("pn-tolitoli", "Pengadilan Negeri Toli-Toli", {
    jurisdiction: "Toli-Toli",
    regions: ["Toli-Toli", "Tolitoli", "Sulawesi Tengah"],
    aliases: ["pn tolitoli"],
  }),

  // ─── SULAWESI SELATAN (existing + additional) ────────────────────────────────
  buildCourtEntry("pta-makassar", "Pengadilan Tinggi Agama Makassar", {
    identityOverrides: {
      courtShortName: "PTA Makassar",
      address: "Jl. Perintis Kemerdekaan Km. 14, Makassar, Sulawesi Selatan",
      website: "https://pta-makassar.go.id",
      mapUrl: "https://maps.google.com/?q=Pengadilan+Tinggi+Agama+Makassar",
    },
    regions: ["Makassar", "Sulawesi Selatan"],
    aliases: ["pta makassar", "makassar", "pta sulsel"],
  }),
  buildCourtEntry("pt-makassar", "Pengadilan Tinggi Makassar", {
    identityOverrides: { website: "https://pt-makassar.go.id" },
    regions: ["Makassar", "Sulawesi Selatan"],
    aliases: ["pt sulsel"],
  }),
  buildCourtEntry("pa-makassar", "Pengadilan Agama Makassar Kelas IA", {
    jurisdiction: "Makassar",
    identityOverrides: {
      courtShortName: "PA Makassar",
      address: "Jl. Perintis Kemerdekaan Km. 14, Makassar, Sulawesi Selatan",
      phoneNumber: "(0411) 554122",
      mobilePhone: "0811-4411-2200",
      email: "pa.makassar@pta-makassar.go.id",
      instagram: "@pa_makassar",
      facebook: "Pengadilan Agama Makassar",
      youtube: "PA Makassar Official",
      website: "https://pa-makassar.go.id",
      mapUrl: "https://maps.google.com/?q=Pengadilan+Agama+Makassar",
    },
    regions: ["Makassar", "Sulawesi Selatan"],
    aliases: ["pa makassar", "pengadilan agama makassar", "makassar"],
  }),
  buildCourtEntry("pn-makassar", "Pengadilan Negeri Makassar", {
    identityOverrides: {
      courtShortName: "PN Makassar",
      website: "https://pn-makassar.go.id",
      mapUrl: "https://maps.google.com/?q=Pengadilan+Negeri+Makassar",
    },
    regions: ["Makassar", "Sulawesi Selatan"],
    aliases: ["pn makassar", "pengadilan negeri makassar", "makassar"],
  }),
  buildCourtEntry("pa-sungguminasa", "Pengadilan Agama Sungguminasa", {
    identityOverrides: { website: "https://pa-sungguminasa.go.id" },
    regions: ["Sungguminasa", "Gowa", "Sulawesi Selatan"],
    aliases: ["pa sungguminasa", "sungguminasa"],
  }),
  buildCourtEntry("pn-sungguminasa", "Pengadilan Negeri Sungguminasa", {
    regions: ["Sungguminasa", "Gowa", "Sulawesi Selatan"],
  }),
  buildCourtEntry("pa-maros", "Pengadilan Agama Maros", {
    identityOverrides: { website: "https://pa-maros.go.id" },
    regions: ["Maros", "Sulawesi Selatan"],
    aliases: ["pa maros", "maros"],
  }),
  buildCourtEntry("pa-pangkajene", "Pengadilan Agama Pangkajene", {
    identityOverrides: { website: "https://pa-pangkajene.go.id" },
    regions: ["Pangkajene", "Pangkep", "Sulawesi Selatan"],
    aliases: ["pa pangkajene", "pangkajene"],
  }),
  buildCourtEntry("pa-barru", "Pengadilan Agama Barru", {
    identityOverrides: { website: "https://pa-barru.go.id" },
    regions: ["Barru", "Sulawesi Selatan"],
    aliases: ["pa barru", "barru"],
  }),
  buildCourtEntry("pa-parepare", "Pengadilan Agama Parepare", {
    identityOverrides: { website: "https://pa-parepare.go.id" },
    regions: ["Parepare", "Sulawesi Selatan"],
    aliases: ["pa parepare", "pare pare", "parepare"],
  }),
  buildCourtEntry("pa-sidrap", "Pengadilan Agama Sidrap", {
    identityOverrides: { website: "https://pa-sidrap.go.id" },
    regions: ["Sidrap", "Sidenreng Rappang", "Sulawesi Selatan"],
    aliases: ["pa sidrap", "sidrap", "sidenreng rappang"],
  }),
  buildCourtEntry("pa-pinrang", "Pengadilan Agama Pinrang", {
    identityOverrides: { website: "https://pa-pinrang.go.id" },
    regions: ["Pinrang", "Sulawesi Selatan"],
    aliases: ["pa pinrang", "pinrang"],
  }),
  buildCourtEntry("pa-sengkang", "Pengadilan Agama Sengkang", {
    identityOverrides: { website: "https://pa-sengkang.go.id" },
    regions: ["Sengkang", "Wajo", "Sulawesi Selatan"],
    aliases: ["pa sengkang", "sengkang", "wajo"],
  }),
  buildCourtEntry("pa-soppeng", "Pengadilan Agama Soppeng", {
    identityOverrides: { website: "https://pa-soppeng.go.id" },
    regions: ["Soppeng", "Sulawesi Selatan"],
    aliases: ["pa soppeng", "soppeng"],
  }),
  buildCourtEntry("pa-watampone", "Pengadilan Agama Watampone", {
    identityOverrides: { website: "https://pa-watampone.go.id" },
    regions: ["Watampone", "Bone", "Sulawesi Selatan"],
    aliases: ["pa watampone", "watampone", "bone"],
  }),
  buildCourtEntry("pa-sinjai", "Pengadilan Agama Sinjai", {
    identityOverrides: { website: "https://pa-sinjai.go.id" },
    regions: ["Sinjai", "Sulawesi Selatan"],
    aliases: ["pa sinjai", "sinjai"],
  }),
  buildCourtEntry("pa-bulukumba", "Pengadilan Agama Bulukumba", {
    identityOverrides: { website: "https://pa-bulukumba.go.id" },
    regions: ["Bulukumba", "Sulawesi Selatan"],
    aliases: ["pa bulukumba", "bulukumba"],
  }),
  buildCourtEntry("pa-bantaeng", "Pengadilan Agama Bantaeng", {
    identityOverrides: { website: "https://pa-bantaeng.go.id" },
    regions: ["Bantaeng", "Sulawesi Selatan"],
    aliases: ["pa bantaeng", "bantaeng"],
  }),
  buildCourtEntry("pa-jeneponto", "Pengadilan Agama Jeneponto", {
    identityOverrides: { website: "https://pa-jeneponto.go.id" },
    regions: ["Jeneponto", "Sulawesi Selatan"],
    aliases: ["pa jeneponto", "jeneponto"],
  }),
  buildCourtEntry("pa-takalar", "Pengadilan Agama Takalar", {
    identityOverrides: { website: "https://pa-takalar.go.id" },
    regions: ["Takalar", "Sulawesi Selatan"],
    aliases: ["pa takalar", "takalar"],
  }),
  buildCourtEntry("pa-selayar", "Pengadilan Agama Selayar", {
    identityOverrides: { website: "https://pa-selayar.go.id" },
    regions: ["Kepulauan Selayar", "Selayar", "Sulawesi Selatan"],
    aliases: ["pa selayar", "kepulauan selayar", "selayar"],
  }),
  buildCourtEntry("pa-malino", "Pengadilan Agama Malino", {
    identityOverrides: { website: "https://pa-malino.go.id" },
    regions: ["Malino", "Gowa", "Sulawesi Selatan"],
    aliases: ["pa malino", "malino", "gowa"],
  }),
  buildCourtEntry("pa-palopo", "Pengadilan Agama Palopo", { regions: ["Palopo", "Luwu", "Sulawesi Selatan"] }),
  buildCourtEntry("pn-palopo", "Pengadilan Negeri Palopo", { regions: ["Palopo", "Luwu", "Sulawesi Selatan"] }),
  buildCourtEntry("pa-masamba", "Pengadilan Agama Masamba", { regions: ["Masamba", "Luwu Utara", "Sulawesi Selatan"] }),
  buildCourtEntry("pa-makale", "Pengadilan Agama Makale", { regions: ["Makale", "Tana Toraja", "Sulawesi Selatan"] }),
  buildCourtEntry("pa-enrekang", "Pengadilan Agama Enrekang", { regions: ["Enrekang", "Sulawesi Selatan"] }),
  buildCourtEntry("pa-mamasa", "Pengadilan Agama Mamasa", { regions: ["Mamasa", "Sulawesi Barat"] }),

  // ─── SULAWESI BARAT ──────────────────────────────────────────────────────────
  buildCourtEntry("pta-mamuju", "Pengadilan Tinggi Agama Mamuju", {
    identityOverrides: { website: "https://pta-mamuju.go.id" },
    regions: ["Mamuju", "Sulawesi Barat"],
    aliases: ["pta sulbar"],
  }),
  buildCourtEntry("pt-mamuju", "Pengadilan Tinggi Mamuju", {
    identityOverrides: { website: "https://pt-mamuju.go.id" },
    regions: ["Mamuju", "Sulawesi Barat"],
    aliases: ["pt sulbar"],
  }),
  buildCourtEntry("pa-mamuju", "Pengadilan Agama Mamuju", { regions: ["Mamuju", "Sulawesi Barat"] }),
  buildCourtEntry("pn-mamuju", "Pengadilan Negeri Mamuju", { regions: ["Mamuju", "Sulawesi Barat"] }),
  buildCourtEntry("pa-polewali", "Pengadilan Agama Polewali", { regions: ["Polewali", "Polewali Mandar", "Sulawesi Barat"] }),
  buildCourtEntry("pa-majene", "Pengadilan Agama Majene", { regions: ["Majene", "Sulawesi Barat"] }),
  buildCourtEntry("pa-pasangkayu", "Pengadilan Agama Pasangkayu", { regions: ["Pasangkayu", "Mamuju Utara", "Sulawesi Barat"] }),

  // ─── SULAWESI TENGGARA ───────────────────────────────────────────────────────
  buildCourtEntry("pta-kendari", "Pengadilan Tinggi Agama Kendari", {
    identityOverrides: { website: "https://pta-kendari.go.id" },
    regions: ["Kendari", "Sulawesi Tenggara"],
    aliases: ["pta sultra"],
  }),
  buildCourtEntry("pt-kendari", "Pengadilan Tinggi Kendari", {
    identityOverrides: { website: "https://pt-kendari.go.id" },
    regions: ["Kendari", "Sulawesi Tenggara"],
    aliases: ["pt sultra"],
  }),
  buildCourtEntry("pa-kendari", "Pengadilan Agama Kendari", { regions: ["Kendari", "Sulawesi Tenggara"] }),
  buildCourtEntry("pn-kendari", "Pengadilan Negeri Kendari", { regions: ["Kendari", "Sulawesi Tenggara"] }),
  buildCourtEntry("pa-raha", "Pengadilan Agama Raha", { regions: ["Raha", "Muna", "Sulawesi Tenggara"] }),
  buildCourtEntry("pa-bau-bau", "Pengadilan Agama Bau-Bau", {
    jurisdiction: "Bau-Bau",
    regions: ["Bau-Bau", "Buton", "Sulawesi Tenggara"],
    aliases: ["pa baubau"],
  }),
  buildCourtEntry("pa-unaaha", "Pengadilan Agama Unaaha", { regions: ["Unaaha", "Konawe", "Sulawesi Tenggara"] }),
  buildCourtEntry("pa-kolaka", "Pengadilan Agama Kolaka", { regions: ["Kolaka", "Sulawesi Tenggara"] }),
  buildCourtEntry("pa-lasusua", "Pengadilan Agama Lasusua", { regions: ["Lasusua", "Kolaka Utara", "Sulawesi Tenggara"] }),
  buildCourtEntry("pa-andoolo", "Pengadilan Agama Andoolo", { regions: ["Andoolo", "Konawe Selatan", "Sulawesi Tenggara"] }),

  // ─── MALUKU ──────────────────────────────────────────────────────────────────
  buildCourtEntry("pta-ambon", "Pengadilan Tinggi Agama Ambon", {
    identityOverrides: { website: "https://pta-ambon.go.id" },
    regions: ["Ambon", "Maluku"],
    aliases: ["pta maluku"],
  }),
  buildCourtEntry("pt-ambon", "Pengadilan Tinggi Ambon", {
    identityOverrides: { website: "https://pt-ambon.go.id" },
    regions: ["Ambon", "Maluku"],
    aliases: ["pt maluku"],
  }),
  buildCourtEntry("pa-ambon", "Pengadilan Agama Ambon", { regions: ["Ambon", "Maluku"] }),
  buildCourtEntry("pn-ambon", "Pengadilan Negeri Ambon", { regions: ["Ambon", "Maluku"] }),
  buildCourtEntry("pa-masohi", "Pengadilan Agama Masohi", { regions: ["Masohi", "Maluku Tengah", "Maluku"] }),
  buildCourtEntry("pa-saumlaki", "Pengadilan Agama Saumlaki", { regions: ["Saumlaki", "Kepulauan Tanimbar", "Maluku"] }),
  buildCourtEntry("pa-langgur", "Pengadilan Agama Langgur", { regions: ["Langgur", "Maluku Tenggara", "Maluku"] }),
  buildCourtEntry("pa-bula", "Pengadilan Agama Bula", { regions: ["Bula", "Seram Bagian Timur", "Maluku"] }),
  buildCourtEntry("pa-namlea", "Pengadilan Agama Namlea", { regions: ["Namlea", "Buru", "Maluku"] }),

  // ─── MALUKU UTARA ────────────────────────────────────────────────────────────
  buildCourtEntry("pta-ternate", "Pengadilan Tinggi Agama Ternate", {
    identityOverrides: { website: "https://pta-ternate.go.id" },
    regions: ["Ternate", "Maluku Utara"],
    aliases: ["pta malut"],
  }),
  buildCourtEntry("pt-ternate", "Pengadilan Tinggi Ternate", {
    identityOverrides: { website: "https://pt-ternate.go.id" },
    regions: ["Ternate", "Maluku Utara"],
    aliases: ["pt malut"],
  }),
  buildCourtEntry("pa-ternate", "Pengadilan Agama Ternate", { regions: ["Ternate", "Maluku Utara"] }),
  buildCourtEntry("pn-ternate", "Pengadilan Negeri Ternate", { regions: ["Ternate", "Maluku Utara"] }),
  buildCourtEntry("pa-tobelo", "Pengadilan Agama Tobelo", { regions: ["Tobelo", "Halmahera Utara", "Maluku Utara"] }),
  buildCourtEntry("pa-labuha", "Pengadilan Agama Labuha", { regions: ["Labuha", "Halmahera Selatan", "Maluku Utara"] }),
  buildCourtEntry("pa-sofifi", "Pengadilan Agama Sofifi", { regions: ["Sofifi", "Halmahera Barat", "Maluku Utara"] }),
  buildCourtEntry("pa-sanana", "Pengadilan Agama Sanana", { regions: ["Sanana", "Kepulauan Sula", "Maluku Utara"] }),
  buildCourtEntry("pa-jailolo", "Pengadilan Agama Jailolo", { regions: ["Jailolo", "Halmahera Barat", "Maluku Utara"] }),

  // ─── PAPUA ───────────────────────────────────────────────────────────────────
  buildCourtEntry("pta-jayapura", "Pengadilan Tinggi Agama Jayapura", {
    identityOverrides: { website: "https://pta-jayapura.go.id" },
    regions: ["Jayapura", "Papua"],
    aliases: ["pta papua"],
  }),
  buildCourtEntry("pt-jayapura", "Pengadilan Tinggi Jayapura", {
    identityOverrides: { website: "https://pt-jayapura.go.id" },
    regions: ["Jayapura", "Papua"],
    aliases: ["pt papua"],
  }),
  buildCourtEntry("pa-jayapura", "Pengadilan Agama Jayapura", { regions: ["Jayapura", "Papua"] }),
  buildCourtEntry("pn-jayapura", "Pengadilan Negeri Jayapura", { regions: ["Jayapura", "Papua"] }),
  buildCourtEntry("pn-timika", "Pengadilan Negeri Timika", { regions: ["Timika", "Mimika", "Papua"] }),
  buildCourtEntry("pn-merauke", "Pengadilan Negeri Merauke", { regions: ["Merauke", "Papua"] }),
  buildCourtEntry("pn-biak", "Pengadilan Negeri Biak", { regions: ["Biak", "Biak Numfor", "Papua"] }),
  buildCourtEntry("pn-nabire", "Pengadilan Negeri Nabire", { regions: ["Nabire", "Papua"] }),
  buildCourtEntry("pn-wamena", "Pengadilan Negeri Wamena", { regions: ["Wamena", "Pegunungan Bintang", "Papua"] }),

  // ─── PAPUA BARAT ─────────────────────────────────────────────────────────────
  buildCourtEntry("pta-manokwari", "Pengadilan Tinggi Agama Manokwari", {
    identityOverrides: { website: "https://pta-manokwari.go.id" },
    regions: ["Manokwari", "Papua Barat"],
    aliases: ["pta papbar", "pta papua barat"],
  }),
  buildCourtEntry("pt-manokwari", "Pengadilan Tinggi Manokwari", {
    identityOverrides: { website: "https://pt-manokwari.go.id" },
    regions: ["Manokwari", "Papua Barat"],
    aliases: ["pt papbar", "pt papua barat"],
  }),
  buildCourtEntry("pa-manokwari", "Pengadilan Agama Manokwari", { regions: ["Manokwari", "Papua Barat"] }),
  buildCourtEntry("pn-manokwari", "Pengadilan Negeri Manokwari", { regions: ["Manokwari", "Papua Barat"] }),
  buildCourtEntry("pa-sorong", "Pengadilan Agama Sorong", { regions: ["Sorong", "Papua Barat"] }),
  buildCourtEntry("pn-sorong", "Pengadilan Negeri Sorong", { regions: ["Sorong", "Papua Barat"] }),
  buildCourtEntry("pa-fakfak", "Pengadilan Agama Fakfak", { regions: ["Fakfak", "Papua Barat"] }),
  buildCourtEntry("pa-bintuni", "Pengadilan Agama Bintuni", { regions: ["Bintuni", "Teluk Bintuni", "Papua Barat"] }),
];

function normalizeQuery(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function computeAliasScore(alias: string, query: string) {
  if (!alias || !query) return 0;

  const queryTokens = query.split(" ");
  const aliasTokens = alias.split(" ");

  if (alias === query) return 220;
  if (alias.startsWith(query)) return 180;
  if (alias.includes(query)) return 145;

  const exactTokenHits = queryTokens.filter((token) => aliasTokens.includes(token)).length;
  if (exactTokenHits === queryTokens.length) {
    return 120 + exactTokenHits * 5;
  }

  const partialTokenHits = queryTokens.filter((token) =>
    aliasTokens.some((aliasToken) => aliasToken.includes(token))
  ).length;

  if (partialTokenHits === queryTokens.length) {
    return 95 + partialTokenHits * 4;
  }

  if (partialTokenHits > 0) {
    return 55 + partialTokenHits * 3;
  }

  return 0;
}

function buildSearchTerms(entry: CourtDirectoryEntry) {
  return Array.from(
    new Set(
      [
        entry.courtName,
        entry.identity.courtShortName,
        entry.jurisdiction,
        ...entry.regions,
        ...entry.aliases,
        entry.satkerLabel,
        entry.identity.website ?? "",
        entry.identity.email ?? "",
      ]
        .map((value) => normalizeQuery(value))
        .filter(Boolean)
    )
  );
}

export function searchCourtDirectory(query: string) {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return [];
  }

  return courtDirectoryCatalog
    .map((entry) => {
      const searchTerms = buildSearchTerms(entry);
      const joinedTerms = searchTerms.join(" ");
      const tokenCoverageBonus =
        normalizedQuery.split(" ").every((token) => joinedTerms.includes(token)) ? 20 : 0;
      const haystackScore = Math.max(...searchTerms.map((term) => computeAliasScore(term, normalizedQuery)));

      return {
        entry,
        score: haystackScore + tokenCoverageBonus,
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      return left.entry.courtName.localeCompare(right.entry.courtName);
    })
    .map((item) => item.entry);
}

export function getCourtDirectoryEntryByName(courtName: string) {
  const normalizedName = normalizeQuery(courtName);
  if (!normalizedName) return null;

  return (
    courtDirectoryCatalog.find((entry) =>
      buildSearchTerms(entry).some((term) => term === normalizedName)
    ) ?? null
  );
}

export function getCourtDirectoryEntryById(courtId: string) {
  return courtDirectoryCatalog.find((entry) => entry.id === courtId) ?? null;
}

export function buildDerivedCourtIdentity(courtName: string): InstitutionIdentity {
  return buildIdentity(courtName, {
    courtShortName: deriveCourtShortName(courtName),
    website: courtName ? `https://${slugifyCourtName(courtName)}.go.id` : "",
    mapUrl: courtName ? `https://maps.google.com/?q=${encodeURIComponent(courtName)}` : "",
  });
}
