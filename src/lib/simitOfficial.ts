export const OFFICIAL_SIMIT_BASE_URL = 'https://fcm.org.co/simit/';

/** Official SIMIT navigation handoff. */
export type OfficialSimitHandoff = {
  provider: 'official-navigation';
  source: 'SIMIT';
  officialUrl: string;
  documentType: string;
  documentNumber: string;
  automatedExtractionAvailable: false;
};

export function createOfficialSimitHandoff(documentType: string, documentNumber: string): OfficialSimitHandoff {
  const cleanDocument = documentNumber.replace(/\D/g, '');
  const officialUrl = `${OFFICIAL_SIMIT_BASE_URL}#/estado-cuenta?numDocPlacaProp=${encodeURIComponent(cleanDocument)}`;
  return {
    provider: 'official-navigation',
    source: 'SIMIT',
    officialUrl,
    documentType: documentType || 'CC',
    documentNumber: cleanDocument,
    automatedExtractionAvailable: false,
  };
}
