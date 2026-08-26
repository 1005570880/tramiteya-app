export const OFFICIAL_SIMIT_URL = 'https://www.simit.org.co/';

/** Official SIMIT handoff. No third-party paid provider or scraping is used. */
export type OfficialSimitHandoff = {
  provider: 'official-manual';
  source: 'SIMIT';
  officialUrl: string;
  documentType: string;
  documentNumber: string;
  automatedExtractionAvailable: false;
};

export function createOfficialSimitHandoff(documentType: string, documentNumber: string): OfficialSimitHandoff {
  return {
    provider: 'official-manual',
    source: 'SIMIT',
    officialUrl: OFFICIAL_SIMIT_URL,
    documentType: documentType || 'CC',
    documentNumber: documentNumber.replace(/\D/g, ''),
    automatedExtractionAvailable: false,
  };
}
