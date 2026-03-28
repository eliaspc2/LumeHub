import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const { AssistantContextModule } = await import(
  '../packages/modules/assistant-context/dist/modules/assistant-context/src/public/index.js'
);
const { GroupDirectoryModule } = await import(
  '../packages/modules/group-directory/dist/modules/group-directory/src/public/index.js'
);
const { GroupKnowledgeModule } = await import(
  '../packages/modules/group-knowledge/dist/modules/group-knowledge/src/public/index.js'
);
const { GroupPathResolver } = await import(
  '../packages/adapters/persistence-group-files/dist/index.js'
);

const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave26-'));

try {
  const dataRootPath = join(sandboxPath, 'data');
  const groupSeedFilePath = join(sandboxPath, 'group-seed.json');
  const resolver = new GroupPathResolver({
    dataRootPath,
  });
  const groupA = '120363400000000101@g.us';
  const groupB = '120363400000000102@g.us';
  const groupC = '120363400000000103@g.us';

  await writeFile(
    groupSeedFilePath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        groups: [
          {
            groupJid: groupA,
            preferredSubject: 'Turma Anatomia',
            aliases: ['Anatomia A'],
            courseId: 'course-a',
            groupOwners: [],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read_write',
              appOwner: 'read_write',
            },
            lastRefreshedAt: null,
          },
          {
            groupJid: groupB,
            preferredSubject: 'Turma Algebra',
            aliases: ['Algebra B'],
            courseId: 'course-b',
            groupOwners: [],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read_write',
              appOwner: 'read_write',
            },
            lastRefreshedAt: null,
          },
          {
            groupJid: groupC,
            preferredSubject: 'Turma Sem KB',
            aliases: ['Turma C'],
            courseId: 'course-c',
            groupOwners: [],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read_write',
              appOwner: 'read_write',
            },
            lastRefreshedAt: null,
          },
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  await seedGroupKnowledge(resolver, groupA, {
    instructions: 'Usa Anatomia como contexto canonico para esta turma.\n',
    index: {
      schemaVersion: 1,
      documents: [
        {
          documentId: 'aula-1-anatomia',
          filePath: 'aula-1.md',
          title: 'Aula 1 de Anatomia',
          summary: 'Nesta turma, Aula 1 refere-se a anatomia geral.',
          aliases: ['Aula 1'],
          tags: ['anatomia', 'teorica'],
        },
      ],
    },
    docs: {
      'aula-1.md': `# Aula 1\n\nA Aula 1 desta turma e Anatomia Geral.\n\nLevar atlas anatomico e confirmar sala 3.\n`,
    },
  });

  await seedGroupKnowledge(resolver, groupB, {
    instructions: 'Usa Algebra como contexto canonico para esta turma.\n',
    index: {
      schemaVersion: 1,
      documents: [
        {
          documentId: 'aula-1-algebra',
          filePath: 'aula-1.md',
          title: 'Aula 1 de Algebra',
          summary: 'Nesta turma, Aula 1 refere-se a algebra linear.',
          aliases: ['Aula 1'],
          tags: ['algebra', 'pratica'],
        },
      ],
    },
    docs: {
      'aula-1.md': `# Aula 1\n\nA Aula 1 desta turma e Algebra Linear.\n\nLevar calculadora e folhas de exercicios.\n`,
    },
  });

  const groupDirectory = new GroupDirectoryModule({
    dataRootPath,
    groupSeedFilePath,
  });
  const groupKnowledge = new GroupKnowledgeModule({
    dataRootPath,
    groupDirectory,
  });
  const assistantContext = new AssistantContextModule({
    dataRootPath,
    groupDirectory,
    groupKnowledge,
  });

  const groupAKnowledge = await groupKnowledge.retrieveRelevantSnippets({
    groupJid: groupA,
    query: 'Precisamos de rever a Aula 1',
  });
  const groupBKnowledge = await groupKnowledge.retrieveRelevantSnippets({
    groupJid: groupB,
    query: 'Precisamos de rever a Aula 1',
  });
  const groupCKnowledge = await groupKnowledge.retrieveRelevantSnippets({
    groupJid: groupC,
    query: 'Precisamos de rever a Aula 1',
  });

  assert.equal(groupAKnowledge.length, 1);
  assert.equal(groupBKnowledge.length, 1);
  assert.equal(groupCKnowledge.length, 0);
  assert.match(groupAKnowledge[0].excerpt, /Anatomia Geral/i);
  assert.match(groupBKnowledge[0].excerpt, /Algebra Linear/i);
  assert.notEqual(groupAKnowledge[0].absoluteFilePath, groupBKnowledge[0].absoluteFilePath);
  assert.equal(groupAKnowledge[0].groupJid, groupA);
  assert.equal(groupBKnowledge[0].groupJid, groupB);

  const groupAContext = await assistantContext.buildChatContext({
    chatJid: groupA,
    chatType: 'group',
    groupJid: groupA,
    text: 'A Aula 1 mudou de sala?',
  });
  const groupBContext = await assistantContext.buildChatContext({
    chatJid: groupB,
    chatType: 'group',
    groupJid: groupB,
    text: 'A Aula 1 mudou de sala?',
  });
  const groupCContext = await assistantContext.buildChatContext({
    chatJid: groupC,
    chatType: 'group',
    groupJid: groupC,
    text: 'A Aula 1 mudou de sala?',
  });

  assert.equal(groupAContext.groupInstructionsSource, 'llm_instructions');
  assert.equal(groupBContext.groupInstructionsSource, 'llm_instructions');
  assert.equal(groupAContext.groupKnowledgeSnippets.length, 1);
  assert.equal(groupBContext.groupKnowledgeSnippets.length, 1);
  assert.equal(groupCContext.groupKnowledgeSnippets.length, 0);
  assert.match(groupAContext.groupKnowledgeSnippets[0].excerpt, /Anatomia Geral/i);
  assert.match(groupBContext.groupKnowledgeSnippets[0].excerpt, /Algebra Linear/i);
  assert.notEqual(
    groupAContext.groupKnowledgeSnippets[0].excerpt,
    groupBContext.groupKnowledgeSnippets[0].excerpt,
  );

  console.log('Wave 26 validation passed: group knowledge retrieval stays isolated per group.');
} finally {
  await rm(sandboxPath, { recursive: true, force: true });
}

async function seedGroupKnowledge(resolver, groupJid, payload) {
  await mkdir(dirname(resolver.resolveGroupLlmInstructionsPath(groupJid)), { recursive: true });
  await mkdir(resolver.resolveGroupKnowledgeRootPath(groupJid), { recursive: true });
  await writeFile(resolver.resolveGroupLlmInstructionsPath(groupJid), payload.instructions, 'utf8');
  await writeFile(
    resolver.resolveGroupKnowledgeIndexPath(groupJid),
    `${JSON.stringify(payload.index, null, 2)}\n`,
    'utf8',
  );

  for (const [relativePath, content] of Object.entries(payload.docs)) {
    await writeFile(join(resolver.resolveGroupKnowledgeRootPath(groupJid), relativePath), content, 'utf8');
  }
}
