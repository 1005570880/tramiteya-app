export const OFFICIAL_SIMIT_URL = 'https://consulta.simit.org.co/Simit/index.html';

/**
 * Official SIMIT handoff.
 *
 * TrámiteYa does not fabricate or infer SIMIT records. The public SIMIT
 * consultation is the authoritative source. Automated extraction remains
 * disabled until SIMIT/FCM exposes an authorized integration for third parties.
 */
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
