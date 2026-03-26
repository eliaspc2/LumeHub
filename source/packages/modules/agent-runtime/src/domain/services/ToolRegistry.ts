import type { AgentTool } from '../entities/AgentRuntime.js';

const DEFAULT_TOOLS: readonly AgentTool[] = [
  {
    name: 'owner_command',
    description: 'Executa comandos especiais do app owner ou group owner.',
  },
  {
    name: 'fanout_preview',
    description: 'Resolve e mostra os alvos declarativos de fan-out.',
  },
  {
    name: 'fanout_execute',
    description: 'Enfileira uma distribuicao confirmada quando a politica permitir.',
  },
  {
    name: 'schedule_parse',
    description: 'Interpreta linguagem natural de scheduling sem alterar o dominio.',
  },
  {
    name: 'chat_reply',
    description: 'Formula uma resposta conversacional apoiada no contexto e nos factos do dominio.',
  },
];

export class ToolRegistry {
  constructor(private readonly tools: readonly AgentTool[] = DEFAULT_TOOLS) {}

  listTools(): readonly AgentTool[] {
    return this.tools;
  }
}
