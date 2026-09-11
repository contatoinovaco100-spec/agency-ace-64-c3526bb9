export interface ContractMeta {
  contract_type: 'mensal' | 'prolongado' | 'total' | string;
  total_value: number;
  installments_count: number;
  payment_terms: string;
}

export function extractContractMeta(contract: any): any {
  if (!contract) return contract;

  let meta: Partial<ContractMeta> = {};
  const delivs = Array.isArray(contract.deliverables) ? contract.deliverables : [];
  const metaItem = delivs.find((d: any) => d && (d.label === '__META__' || d.label === '__CONTRACT_META__'));
  if (metaItem && metaItem.quantity) {
    try {
      meta = JSON.parse(metaItem.quantity);
    } catch {}
  }

  const cleanDeliverables = delivs.filter((d: any) => d && d.label !== '__META__' && d.label !== '__CONTRACT_META__');

  const contract_type = contract.contract_type || meta.contract_type || 'mensal';
  const duration_months = Number(contract.duration_months) || 12;
  const monthly_value = Number(contract.monthly_value) || 0;
  const total_value = Number(contract.total_value) || Number(meta.total_value) || (contract_type === 'total' ? monthly_value : monthly_value * duration_months);
  const installments_count = Number(contract.installments_count) || Number(meta.installments_count) || duration_months;
  const payment_terms = contract.payment_terms || meta.payment_terms || '';

  return {
    ...contract,
    contract_type,
    total_value,
    installments_count,
    payment_terms,
    deliverables: cleanDeliverables,
  };
}

export function attachContractMetaToDeliverables(deliverables: any[], meta: ContractMeta): any[] {
  const clean = (deliverables || []).filter((d: any) => d && d.label !== '__META__' && d.label !== '__CONTRACT_META__');
  return [
    ...clean,
    {
      label: '__META__',
      quantity: JSON.stringify(meta),
    },
  ];
}
