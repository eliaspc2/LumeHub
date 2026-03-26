export interface NavigationItem {
  readonly route: string;
  readonly label: string;
}

export interface UiMetric {
  readonly label: string;
  readonly value: string | number | boolean;
  readonly tone?: 'neutral' | 'positive' | 'warning' | 'danger';
}

export interface UiSection {
  readonly title: string;
  readonly lines: readonly string[];
  readonly metrics?: readonly UiMetric[];
}

export interface UiPage<TData = unknown> {
  readonly route: string;
  readonly title: string;
  readonly description: string;
  readonly sections: readonly UiSection[];
  readonly data: TData;
}

export interface SharedUiUiModuleConfig {
  readonly route: string;
}

export class SharedUiUiModule {
  constructor(readonly config: SharedUiUiModuleConfig = { route: '/shared-ui' }) {}
}

export function createListSection(title: string, lines: readonly string[], emptyMessage: string): UiSection {
  return {
    title,
    lines: lines.length > 0 ? lines : [emptyMessage],
  };
}
