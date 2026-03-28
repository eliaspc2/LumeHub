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
const { GroupPathResolver } = await import(
  '../packages/adapters/persistence-group-files/dist/index.js'
);

const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave25-'));

try {
  const dataRootPath = join(sandboxPath, 'data');
  const groupSeedFilePath = join(sandboxPath, 'group-seed.json');
  const groupJid = '120363400000000001@g.us';
  const resolver = new GroupPathResolver({
    dataRootPath,
  });

  await writeFile(
    groupSeedFilePath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        groups: [
          {
            groupJid,
            preferredSubject: 'Turma A',
            aliases: ['Aula A'],
            courseId: 'course-a',
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

  await mkdir(dirname(resolver.resolveGroupPromptPath(groupJid)), { recursive: true });
  await writeFile(
    resolver.resolveGroupPromptPath(groupJid),
    'Legacy prompt do grupo para compatibilidade.\n',
    'utf8',
  );

  const groupDirectory = new GroupDirectoryModule({
    dataRootPath,
    groupSeedFilePath,
  });
  const assistantContext = new AssistantContextModule({
    dataRootPath,
    groupDirectory,
  });

  const workspace = await groupDirectory.getGroupWorkspace(groupJid);
  assert.equal(workspace.llmRootPath, resolver.resolveGroupLlmRootPath(groupJid));
  assert.equal(workspace.llmInstructionsPath, resolver.resolveGroupLlmInstructionsPath(groupJid));
  assert.equal(workspace.knowledgeRootPath, resolver.resolveGroupKnowledgeRootPath(groupJid));
  assert.equal(workspace.knowledgeIndexPath, resolver.resolveGroupKnowledgeIndexPath(groupJid));

  const knowledgeWorkspace = await groupDirectory.getGroupKnowledgeWorkspace(groupJid);
  assert.equal(knowledgeWorkspace.rootPath, workspace.knowledgeRootPath);
  assert.equal(knowledgeWorkspace.indexPath, workspace.knowledgeIndexPath);

  const legacyInstructions = await groupDirectory.getGroupLlmInstructions(groupJid);
  assert.equal(legacyInstructions.exists, true);
  assert.equal(legacyInstructions.source, 'legacy_prompt');
  assert.equal(legacyInstructions.content, 'Legacy prompt do grupo para compatibilidade.\n');
  assert.equal(legacyInstructions.resolvedFilePath, resolver.resolveGroupPromptPath(groupJid));

  const legacyContext = await assistantContext.buildChatContext({
    chatJid: groupJid,
    chatType: 'group',
    groupJid,
    text: 'Qual e a norma da Aula 1?',
  });
  assert.equal(legacyContext.groupInstructionsSource, 'legacy_prompt');
  assert.equal(legacyContext.groupInstructions, 'Legacy prompt do grupo para compatibilidade.\n');
  assert.equal(legacyContext.groupPrompt, legacyContext.groupInstructions);

  await mkdir(dirname(resolver.resolveGroupLlmInstructionsPath(groupJid)), { recursive: true });
  await mkdir(resolver.resolveGroupKnowledgeRootPath(groupJid), { recursive: true });
  await writeFile(
    resolver.resolveGroupLlmInstructionsPath(groupJid),
    'Instrucoes LLM canonicas do grupo.\n',
    'utf8',
  );
  await writeFile(
    resolver.resolveGroupKnowledgeIndexPath(groupJid),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        documents: [],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const canonicalInstructions = await groupDirectory.getGroupLlmInstructions(groupJid);
  assert.equal(canonicalInstructions.exists, true);
  assert.equal(canonicalInstructions.source, 'llm_instructions');
  assert.equal(canonicalInstructions.content, 'Instrucoes LLM canonicas do grupo.\n');
  assert.equal(canonicalInstructions.resolvedFilePath, resolver.resolveGroupLlmInstructionsPath(groupJid));

  const canonicalContext = await assistantContext.buildChatContext({
    chatJid: groupJid,
    chatType: 'group',
    groupJid,
    text: 'Qual e a norma da Aula 1?',
  });
  assert.equal(canonicalContext.groupInstructionsSource, 'llm_instructions');
  assert.equal(canonicalContext.groupInstructions, 'Instrucoes LLM canonicas do grupo.\n');
  assert.equal(canonicalContext.groupPrompt, canonicalContext.groupInstructions);

  console.log('Wave 25 validation passed: canonical group intelligence storage is active with legacy prompt fallback.');
} finally {
  await rm(sandboxPath, { recursive: true, force: true });
}
