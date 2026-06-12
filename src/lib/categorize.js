export const CATEGORIEEN = [
  'Voeding', 'Transport', 'Abonnementen', 'Uit eten', 'Beroepsinkomsten',
  'Gezondheid', 'Wonen', 'Diversen',
]

export const DEFAULT_RULES = [
  { keyword: 'delhaize', categorie: 'Voeding' },
  { keyword: 'carrefour', categorie: 'Voeding' },
  { keyword: 'lidl', categorie: 'Voeding' },
  { keyword: 'aldi', categorie: 'Voeding' },
  { keyword: 'colruyt', categorie: 'Voeding' },
  { keyword: 'uber eats', categorie: 'Uit eten' },
  { keyword: 'deliveroo', categorie: 'Uit eten' },
  { keyword: 'takeaway', categorie: 'Uit eten' },
  { keyword: 'restaurant', categorie: 'Uit eten' },
  { keyword: 'uber', categorie: 'Transport' },
  { keyword: 'de lijn', categorie: 'Transport' },
  { keyword: 'nmbs', categorie: 'Transport' },
  { keyword: 'sncb', categorie: 'Transport' },
  { keyword: 'parking', categorie: 'Transport' },
  { keyword: 'q-park', categorie: 'Transport' },
  { keyword: 'spotify', categorie: 'Abonnementen' },
  { keyword: 'netflix', categorie: 'Abonnementen' },
  { keyword: 'disney', categorie: 'Abonnementen' },
  { keyword: 'ovb', categorie: 'Beroepsinkomsten' },
  { keyword: 'commissie', categorie: 'Beroepsinkomsten' },
  { keyword: 'willemot', categorie: 'Beroepsinkomsten' },
  { keyword: 'apotheek', categorie: 'Gezondheid' },
  { keyword: 'apotheker', categorie: 'Gezondheid' },
  { keyword: 'dokter', categorie: 'Gezondheid' },
  { keyword: 'mutualiteit', categorie: 'Gezondheid' },
  { keyword: 'huur', categorie: 'Wonen' },
  { keyword: 'energie', categorie: 'Wonen' },
  { keyword: 'engie', categorie: 'Wonen' },
  { keyword: 'luminus', categorie: 'Wonen' },
  { keyword: 'water', categorie: 'Wonen' },
  { keyword: 'farys', categorie: 'Wonen' },
]

// Gebruikersregels krijgen voorrang op standaardregels
export function categorize(omschrijving, userRules = []) {
  const t = (omschrijving || '').toLowerCase()
  for (const r of userRules) if (r.keyword && t.includes(r.keyword.toLowerCase())) return r.categorie
  for (const r of DEFAULT_RULES) if (t.includes(r.keyword)) return r.categorie
  return 'Diversen'
}

export const CAT_KLEUREN = {
  Voeding: '#f0b429', Transport: '#60a5fa', Abonnementen: '#a78bfa',
  'Uit eten': '#fb923c', Beroepsinkomsten: '#34d399', Gezondheid: '#f87171',
  Wonen: '#22d3ee', Diversen: '#94a3b8',
}
