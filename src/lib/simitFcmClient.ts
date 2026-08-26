import { parseOfficialSimitText, type ParsedSimitRecord } from '@/lib/simitOfficialParser';

const BASE = 'https://consultasimit.fcm.org.co/simit/microservices/estado-cuenta-simit/estadocuenta';

const CANDIDATES = [
  'getEstadoCuentaPublic',
  'getEstadoCuenta',
  'consultarEstadoCuentaPublic',
] as const;

type FcmResponse = {
  ok: boolean;
  endpoint?: string;
  status?: number;
  payload?: unknown;
  records: ParsedSimitRecord[];
  raw?: string;
};

function buildPayload(documentType: string, documentNumber: string) {
  return [
    { tipoDocumento: documentType, numeroDocumento: documentNumber },
    { tipoDocumentoIdentidad: documentType, numeroDocumento: documentNumber },
    { numDocPlacaProp: documentNumber, tipoDocumento: documentType },
  ];
}

function extractRecords(payload: unknown): ParsedSimitRecord[] {
  if (!payload) return [];
  if (typeof payload === 'string') return parseOfficialSimitText(payload);
  try {
    return parseOfficialSimitText(JSON.stringify(payload));
  } catch {
    return [];
  }
}

export async function queryOfficialFcmSimit(documentType: string, documentNumber: string): Promise<FcmResponse> {
  const headers = {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json;charset=UTF-8',
    Origin: 'https://www.fcm.org.co',
    Referer: 'https://www.fcm.org.co/simit/',
    'User-Agent': 'Mozilla/5.0 TrámiteYa/1.0',
  };

  const payloads = buildPayload(documentType, documentNumber);

  for (const endpoint of CANDIDATES) {
    for (const body of payloads) {
      try {
        const response = await fetch(`${BASE}/${endpoint}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          cache: 'no-store',
        });
        const raw = await response.text();
        let parsed: unknown = raw;
        try { parsed = JSON.parse(raw); } catch { /* plain response */ }
        const records = extractRecords(parsed);
        if (response.ok) {
          return { ok: true, endpoint, status: response.status, payload: parsed, records, raw };
        }
      } catch {
        // Continue to the next public endpoint shape; no credentials or bypasses are used.
      }
    }
  }

  return { ok: false, records: [] };
}
