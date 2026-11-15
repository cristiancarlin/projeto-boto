import { valuesTreatment } from '../src/popup/src/utils/valuesTreatment';

describe('valuesTreatment (comandos de voz)', () => {
  test('reconhece aumentar brilho com valor', () => {
    const result = valuesTreatment('aumentar brilho 20');
    expect(result.type).toBe('aumentar');
    expect(result.element).toBe('brilho');
    expect(result.value).toEqual(expect.arrayContaining(['20']));
  });

  test('reconhece diminuir contraste', () => {
    const result = valuesTreatment('diminuir contraste');
    expect(result.type).toBe('diminuir');
    expect(result.element).toBe('contraste');
  });

  test('reconhece marcar máscara', () => {
    const result = valuesTreatment('marcar máscara');
    expect(result.type).toBe('marcar');
    expect(result.element).toBe('máscara');
  });

  test('reconhece desmarcar bionic/negrito', () => {
    expect(valuesTreatment('desmarcar bionic').element).toBe('bionic');
    expect(valuesTreatment('marcar negrito').element).toBe('bionic');
  });

  test('reconhece ativar e sinônimos novos dos extras', () => {
    expect(valuesTreatment('ativar bionic reading')).toMatchObject({
      type: 'marcar',
      element: 'bionic'
    });
    expect(valuesTreatment('ativar máscara de leitura')).toMatchObject({
      type: 'marcar',
      element: 'máscara'
    });
    expect(valuesTreatment('ativar pausar')).toMatchObject({
      type: 'marcar',
      element: 'mídia'
    });
  });

  test('reconhece cronômetro e sinônimos', () => {
    expect(valuesTreatment('marcar cronômetro').element).toBe('cronometro');
    expect(valuesTreatment('marcar temporizador').element).toBe('cronometro');
    expect(valuesTreatment('marcar timer').element).toBe('cronometro');
  });

  test('reconhece silenciar mídias', () => {
    const result = valuesTreatment('marcar silenciar');
    expect(result.type).toBe('marcar');
    expect(result.element).toBe('mídia');
  });

  test('reconhece ir para extras', () => {
    const result = valuesTreatment('ir para extras');
    expect(result.type).toBe('mudar');
    expect(result.element).toBe('extras');
  });

  test('valor padrão 10 quando não há número', () => {
    expect(valuesTreatment('aumentar zoom').value).toBe(10);
  });
});
