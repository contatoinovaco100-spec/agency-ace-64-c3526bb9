/**
 * Gerador de BR Code Pix (Pix Copia e Cola) seguindo o padrão EMV/BACEN.
 * Sem dependências externas.
 */

function emv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

// CRC16-CCITT (polinômio 0x1021, init 0xFFFF) – padrão Pix
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function sanitize(text: string, max: number): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .slice(0, max);
}

export interface PixPayloadInput {
  pixKey: string;
  receiverName: string;
  city: string;
  amount: number;
  txid?: string;
  description?: string;
}

export function generatePixPayload(input: PixPayloadInput): string {
  const { pixKey, receiverName, city, amount } = input;
  const txid = sanitize(input.txid || '***', 25) || '***';

  // Merchant Account Information
  const gui = emv('00', 'br.gov.bcb.pix');
  const key = emv('01', pixKey.trim());
  const merchantAccount = emv('26', gui + key);

  const payloadFormat = emv('00', '01');
  const merchantCategory = emv('52', '0000');
  const currency = emv('53', '986'); // BRL
  const amountStr = amount > 0 ? emv('54', amount.toFixed(2)) : '';
  const country = emv('58', 'BR');
  const name = emv('59', sanitize(receiverName, 25) || 'RECEBEDOR');
  const cityStr = emv('60', sanitize(city, 15) || 'BRASIL');
  const additional = emv('62', emv('05', txid));

  let payload =
    payloadFormat +
    merchantAccount +
    merchantCategory +
    currency +
    amountStr +
    country +
    name +
    cityStr +
    additional +
    '6304';

  const crc = crc16(payload);
  return payload + crc;
}
