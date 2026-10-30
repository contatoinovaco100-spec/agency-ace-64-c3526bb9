/** Nicho da empresa como aparece nas abas ("clínicas odontológicas" → "Clínicas odontológicas") */
export const nicheLabel = (raw: string | null | undefined) => {
  const t = String(raw ?? '').trim().replace(/\s+/g, ' ');
  return t ? t[0].toUpperCase() + t.slice(1) : 'Sem nicho';
};

/** Chave para agrupar nichos sem diferenciar maiúsculas e minúsculas */
export const nicheKey = (raw: string | null | undefined) => nicheLabel(raw).toLocaleLowerCase('pt-BR');

/** Chave do telefone para achar repetidos: DDD + últimos 8 dígitos (ignora 55, o 9 a mais e a formatação) */
export const phoneKey = (raw: string | null | undefined) => {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  return d.length < 10 ? null : d.slice(0, 2) + d.slice(-8);
};
