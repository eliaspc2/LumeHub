import test from 'node:test';
import assert from 'node:assert/strict';

const { RuleBasedIntentClassifier } = await import(
  '../../packages/modules/intent-classifier/dist/modules/intent-classifier/src/public/index.js'
);

test('classifier treats imperative scheduling commands as read/write', () => {
  const classifier = new RuleBasedIntentClassifier();

  for (const text of [
    '@lume cria este agendamento para quinta as 21:00',
    '@lume agenda desta maneira ja',
    '@lume atualiza o link da VC para https://meet.google.com/abc-defg-hij',
    '@lume mete este link na aula de hoje',
  ]) {
    const result = classifier.classify({
      text,
      chatType: 'group',
      wasTagged: true,
      isReplyToBot: false,
    });

    assert.equal(result.intent, 'scheduling_request', text);
    assert.equal(result.requestedAccessMode, 'read_write', text);
  }
});

test('classifier keeps agenda listing requests in read mode', () => {
  const classifier = new RuleBasedIntentClassifier();

  for (const text of [
    '@lume cronograma esta semana',
    '@lume proximas aulas',
    '@lume mostra todos os agendamentos da semana',
  ]) {
    const result = classifier.classify({
      text,
      chatType: 'group',
      wasTagged: true,
      isReplyToBot: false,
    });

    assert.equal(result.intent, 'scheduling_request', text);
    assert.equal(result.requestedAccessMode, 'read', text);
  }
});
