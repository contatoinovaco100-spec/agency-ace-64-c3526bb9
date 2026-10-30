/** Nicho da empresa como aparece nas abas ("clínicas odontológicas" → "Clínicas odontológicas") */
export const nicheLabel = (raw: string | null | undefined) => {
  const t = String(raw ?? '').trim().replace(/\s+/g, ' ');
  return t ? t[0].toUpperCase() + t.slice(1) : 'Sem nicho';
};

/** Chave para agrupar nichos sem diferenciar maiúsculas e minúsculas */
export const nicheKey = (raw: string | null | undefined) => nicheLabel(raw).toLocaleLowerCase('pt-BR');
