export interface LlmModelDescriptor {
  readonly providerId: string;
  readonly modelId: string;
  readonly label: string;
  readonly capabilities: {
    readonly chat: boolean;
    readonly scheduling: boolean;
    readonly weeklyPlanning: boolean;
    readonly streaming: boolean;
  };
}

export interface LlmChatInput {
  readonly text: string;
  readonly intent?: string | null;
  readonly contextSummary?: readonly string[];
  readonly domainFacts?: readonly string[];
  readonly memoryScope?: LlmMemoryScope | null;
  readonly providerId?: string | null;
}

export interface LlmChatResult {
  readonly runId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly text: string;
}

export type LlmScheduleConfidence = 'low' | 'medium' | 'high';

export interface LlmMemoryDocumentRef {
  readonly documentId: string;
  readonly title: string;
  readonly filePath: string;
  readonly score?: number;
  readonly matchedTerms?: readonly string[];
}

export interface LlmMemoryScope {
  readonly scope: 'none' | 'group';
  readonly groupJid: string | null;
  readonly groupLabel: string | null;
  readonly instructionsSource: 'llm_instructions' | 'missing' | null;
  readonly instructionsApplied: boolean;
  readonly instructionsContent?: string | null;
  readonly knowledgeSnippetCount: number;
  readonly knowledgeDocuments: readonly LlmMemoryDocumentRef[];
}

export interface LlmScheduleCandidate {
  readonly title: string;
  readonly dateHint: string | null;
  readonly timeHint: string | null;
  readonly confidence: LlmScheduleConfidence;
  readonly notes: readonly string[];
}

export interface LlmScheduleParseInput {
  readonly text: string;
  readonly referenceDate?: string | null;
  readonly timezone?: string | null;
  readonly contextSummary?: readonly string[];
  readonly domainFacts?: readonly string[];
  readonly memoryScope?: LlmMemoryScope | null;
}

export interface LlmScheduleParseResult {
  readonly candidates: readonly LlmScheduleCandidate[];
  readonly notes: readonly string[];
}

export interface WeeklyPromptPlanningInput {
  readonly weekId: string;
  readonly items?: readonly {
    readonly title: string;
    readonly dueAt: string;
    readonly groupLabel?: string | null;
  }[];
  readonly requestedCount?: number;
}

export interface WeeklyPromptPlan {
  readonly weekId: string;
  readonly prompts: readonly string[];
}

export interface LlmRunLogEntry {
  readonly runId: string;
  readonly operation: 'chat' | 'parse_schedules' | 'plan_weekly_prompts';
  readonly providerId: string;
  readonly modelId: string;
  readonly inputSummary: string;
  readonly outputSummary: string;
  readonly memoryScope?: LlmMemoryScope | null;
  readonly createdAt: string;
}

export interface LlmRunLogFile {
  readonly schemaVersion: 1;
  readonly entries: readonly LlmRunLogEntry[];
}

export interface LlmProvider {
  readonly providerId: string;
  readonly defaultModelId: string;

  chat(input: LlmChatInput): Promise<LlmChatResult>;
  parseSchedules(input: LlmScheduleParseInput): Promise<LlmScheduleParseResult>;
  planWeeklyPrompts(input: WeeklyPromptPlanningInput): Promise<WeeklyPromptPlan>;
  listModels(): readonly LlmModelDescriptor[];
}

export interface LlmModelCatalogRefreshResult {
  readonly providerId: string;
  readonly models: readonly LlmModelDescriptor[];
}

export interface LlmRefreshableProvider extends LlmProvider {
  refreshModels(): Promise<LlmModelCatalogRefreshResult>;
}
