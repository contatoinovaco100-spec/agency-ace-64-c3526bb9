export interface Niche {
  label: string;
  cnaes: string[];
}

// CNAEs (subclasse sem pontuação) agrupados por nicho comercial
export const NICHES: Niche[] = [
  { label: 'Clínicas médicas', cnaes: ['8630501', '8630502', '8610101', '8650003'] },
  { label: 'Odontologia', cnaes: ['8630504'] },
  { label: 'Estética e beleza', cnaes: ['9602501', '9602502', '8690901'] },
  { label: 'Academias e fitness', cnaes: ['9313100', '8591300'] },
  { label: 'Restaurantes e lanchonetes', cnaes: ['5611201', '5611203', '5611204', '5611205'] },
  { label: 'Padarias e confeitarias', cnaes: ['4721102', '1091102'] },
  { label: 'Advocacia', cnaes: ['6911701', '6911702'] },
  { label: 'Contabilidade', cnaes: ['6920601', '6920602'] },
  { label: 'Imobiliárias', cnaes: ['6821801', '6821802', '6822600'] },
  { label: 'Construção civil', cnaes: ['4120400', '4110700', '4399103'] },
  { label: 'Moda e vestuário', cnaes: ['4781400', '1412601', '4782201'] },
  { label: 'Pet shop e veterinária', cnaes: ['4789004', '7500100'] },
  { label: 'Automotivo', cnaes: ['4520001', '4511101', '4530703'] },
  { label: 'Educação e cursos', cnaes: ['8599604', '8513900', '8531700'] },
  { label: 'Turismo e hotelaria', cnaes: ['5510801', '7911200'] },
  { label: 'Tecnologia e software', cnaes: ['6201501', '6202300', '6209100'] },
  { label: 'Marketing e publicidade', cnaes: ['7311400', '7319002', '7490104'] },
  { label: 'Eventos e festas', cnaes: ['8230001', '8230002', '9001999'] },
  { label: 'Supermercados e mercearias', cnaes: ['4711302', '4712100'] },
  { label: 'Farmácias', cnaes: ['4771701', '4771702'] },
  { label: 'Móveis e decoração', cnaes: ['4754701', '3101200'] },
  { label: 'Transporte e logística', cnaes: ['4930202', '5320202', '4923002'] },
  { label: 'Agronegócio', cnaes: ['0111301', '0151201', '4623199'] },
  { label: 'Indústria alimentícia', cnaes: ['1091101', '1052000', '1099699'] },
];

export const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];
