import { FinancialRecord, MetaRecord } from '@/types/financial';

const regionais = ['Tocantins', 'Goiás', 'Paraná', 'Espírito Santo'];

const unidadesPorRegional: Record<string, string[]> = {
  'Tocantins': ['Palmas Centro', 'Palmas Sul', 'Araguaína'],
  'Goiás': ['Goiânia Norte', 'Goiânia Sul', 'Anápolis'],
  'Paraná': ['Curitiba Centro', 'Londrina', 'Maringá'],
  'Espírito Santo': ['Vitória', 'Vila Velha', 'Serra'],
};

const meses = ['01/2025', '02/2025', '03/2025', '04/2025', '05/2025', '06/2025',
  '07/2025', '08/2025', '09/2025', '10/2025', '11/2025', '12/2025'];

function rand(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

let idCounter = 0;

export const mockFinancialData: FinancialRecord[] = [];

for (const mes of meses) {
  for (const regional of regionais) {
    for (const unidade of unidadesPorRegional[regional]) {
      const receitaBruta = rand(150000, 500000);
      const impostos = Math.round(receitaBruta * (rand(8, 15) / 100));
      const receitaLiquida = receitaBruta - impostos;
      const maoDeObra = Math.round(receitaLiquida * (rand(20, 35) / 100));
      const materiaPrima = Math.round(receitaLiquida * (rand(15, 30) / 100));
      const cmv = materiaPrima + Math.round(receitaLiquida * (rand(5, 15) / 100));
      const despesaTotal = Math.round(receitaLiquida * (rand(10, 25) / 100));
      const margem = Math.round(((receitaLiquida - cmv - maoDeObra - despesaTotal) / receitaLiquida) * 100 * 10) / 10;

      mockFinancialData.push({
        id: `rec-${++idCounter}`,
        data: mes,
        regional,
        unidade,
        receitaBruta,
        impostos,
        receitaLiquida,
        maoDeObra,
        materiaPrima,
        cmv,
        despesaTotal,
        meta: rand(5, 20),
        margem,
      });
    }
  }
}

export const mockMetas: MetaRecord[] = [];
for (const regional of regionais) {
  for (const unidade of unidadesPorRegional[regional]) {
    mockMetas.push({
      regional,
      unidade,
      metaReceita: rand(300000, 600000),
      metaEbitda: rand(50000, 150000),
      metaCmv: rand(30, 40),
      metaMaoDeObra: rand(22, 30),
    });
  }
}

export const getRegionais = () => regionais;
export const getUnidades = (regional?: string) => {
  if (!regional) return Object.values(unidadesPorRegional).flat();
  return unidadesPorRegional[regional] || [];
};
