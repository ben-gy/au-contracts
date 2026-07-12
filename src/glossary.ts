// Domain glossary. Every jargon term used in the UI has an entry here.
export const GLOSSARY: Record<string, string> = {
  'AusTender': 'The Australian Government’s central procurement portal (tenders.gov.au). By law, most Commonwealth entities must publish the contracts they award there. This site is built from AusTender’s open data.',
  'Contract Notice': 'A record published on AusTender for each contract a government entity awards. It lists the supplier, the buying agency, the value, the category and the contract dates. Abbreviated "CN".',
  'Procuring entity': 'The government department or agency that bought the goods or services — the buyer. Also called the "agency" on this site.',
  'Supplier': 'The company, individual or organisation that won the contract and is paid to deliver the goods or services.',
  'ABN': 'Australian Business Number — an 11-digit identifier for a business. Used here to help distinguish suppliers with similar names.',
  'UNSPSC': 'United Nations Standard Products and Services Code — an international system for classifying what was bought. This site groups the 8-digit codes into readable top-level categories (e.g. "IT & Telecommunications").',
  'Consultancy': 'A contract for professional advice or services delivered by an external firm — strategy, audit, legal, technical or management advice. On this site "professional & consulting services" groups the UNSPSC categories that typically cover this work.',
  'Procurement method': 'How the contract was awarded. "Open tender" means it was openly advertised and competed. "Limited tender" means the agency approached one or more suppliers directly without open competition. "Prequalified" means suppliers were drawn from a pre-approved panel.',
  'Open tender': 'A procurement openly advertised so any eligible supplier could bid — generally the most competitive method.',
  'Limited tender': 'A procurement where the agency approached suppliers directly without open competition. Sometimes justified (e.g. only one supplier can deliver), but a high share can signal reduced competition.',
  'Financial year': 'The Australian Government’s budget year, running 1 July to 30 June. "2024-25" means 1 July 2024 to 30 June 2025.',
  'Contract value': 'The total value of the contract as reported to AusTender, in Australian dollars. It reflects the agreed contract amount, which may differ from what is ultimately spent.',
  'Amendment': 'A change to an existing contract (e.g. extending it or increasing its value). This site keeps the latest version of each contract so amendments are not double-counted.',
  'Per-supplier concentration': 'The share of an agency’s total spend that goes to its single largest supplier. A high figure means the agency’s spending is concentrated in one provider.',
  'SME': 'Small-to-medium enterprise — a smaller business. Governments often set targets for the share of contracts awarded to SMEs.',
};

export const GLOSSARY_TERMS = Object.keys(GLOSSARY);
