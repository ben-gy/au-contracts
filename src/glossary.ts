// Domain glossary. Every jargon term surfaced in the UI should have an entry
// here so an inline info icon can explain it to a first-time reader.

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  austender: {
    term: 'AusTender',
    definition:
      'The Australian Government’s central procurement information system. Federal agencies are required to publish a "contract notice" on AusTender for most reportable purchases, which is where this data comes from.',
  },
  'contract-notice': {
    term: 'Contract Notice (CN)',
    definition:
      'The public record an agency publishes when it enters into a contract. It lists the supplier, the value, the dates, the category of goods or services, and how the contract was awarded.',
  },
  'procuring-entity': {
    term: 'Procuring entity / Agency',
    definition:
      'The government body that awarded and pays for the contract — for example the Department of Defence or the Australian Taxation Office.',
  },
  supplier: {
    term: 'Supplier',
    definition:
      'The company, individual or organisation awarded the contract and paid by the agency.',
  },
  'limited-tender': {
    term: 'Limited tender',
    definition:
      'A contract awarded without an open competitive process — the agency approached one or a limited number of suppliers directly. Sometimes justified (e.g. only one capable supplier), but a high share of limited tenders can be a transparency red flag.',
  },
  'open-tender': {
    term: 'Open tender',
    definition:
      'A contract awarded after an open, publicly advertised competitive process that any eligible supplier could bid for.',
  },
  'prequalified-tender': {
    term: 'Prequalified tender',
    definition:
      'A contract awarded from a pre-approved panel or shortlist of suppliers that were assessed in advance.',
  },
  unspsc: {
    term: 'UNSPSC category',
    definition:
      'The United Nations Standard Products and Services Code — a global classification system for what was purchased. We group contracts by the top-level "segment" (e.g. Information Technology, Management Services, Defence Equipment).',
  },
  'contract-value': {
    term: 'Contract value',
    definition:
      'The total value of the contract in Australian dollars as reported on AusTender, including the value of any published amendments. It is the committed value, not necessarily the amount spent to date.',
  },
  ocds: {
    term: 'Open Contracting (OCDS)',
    definition:
      'The Open Contracting Data Standard — an international format for publishing procurement data. AusTender publishes its contract notices in this standard, which is the exact dataset shown here.',
  },
  'per-limited': {
    term: 'Share via limited tender',
    definition:
      'The proportion of an entity’s total contract value that was awarded through limited (non-competitive) tenders rather than open competition.',
  },
  amendment: {
    term: 'Amendment',
    definition:
      'A change to an existing contract — often extending its term or increasing its value. Amendment values are rolled into the contract value shown here.',
  },
};

/** Lookup helper used by the tooltip component. */
export function lookup(key: string): GlossaryEntry | undefined {
  return GLOSSARY[key];
}
