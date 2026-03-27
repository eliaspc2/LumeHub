export interface NavigationItem {
  readonly route: string;
  readonly label: string;
}

export type UiTone = 'neutral' | 'positive' | 'warning' | 'danger';

export interface UiMetric {
  readonly label: string;
  readonly value: string | number | boolean;
  readonly tone?: UiTone;
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

export interface UiBadgeSpec {
  readonly label: string;
  readonly tone?: UiTone;
  readonly style?: 'pill' | 'chip';
}

export interface UiToggleButtonSpec {
  readonly label: string;
  readonly value: string;
  readonly active: boolean;
  readonly kind: string;
}

export interface UiActionButtonSpec {
  readonly label: string;
  readonly href?: string;
  readonly variant?: 'primary' | 'secondary';
  readonly dataAttributes?: Readonly<Record<string, string | undefined>>;
}

export interface UiFieldOption {
  readonly value: string;
  readonly label: string;
}

export interface UiInputFieldSpec {
  readonly label: string;
  readonly value: string;
  readonly dataKey: string;
  readonly type?: 'text' | 'time' | 'number';
  readonly placeholder?: string;
  readonly hint?: string;
}

export interface UiSelectFieldSpec {
  readonly label: string;
  readonly value: string;
  readonly dataKey: string;
  readonly options: readonly UiFieldOption[];
  readonly hint?: string;
}

export interface UiTextAreaFieldSpec {
  readonly label: string;
  readonly value: string;
  readonly dataKey: string;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly rows?: number;
}

export interface UiMetricCardSpec {
  readonly title: string;
  readonly value: string;
  readonly description: string;
  readonly tone?: UiTone;
}

export interface UiPanelCardSpec {
  readonly title: string;
  readonly badgeLabel?: string;
  readonly badgeTone?: UiTone;
  readonly contentHtml: string;
  readonly eyebrow?: string;
}

export interface UiRecordCardSpec {
  readonly title: string;
  readonly subtitle?: string;
  readonly badgeLabel?: string;
  readonly badgeTone?: UiTone;
  readonly chips?: readonly UiBadgeSpec[];
  readonly bodyHtml?: string;
  readonly detailsSummary?: string;
  readonly detailsHtml?: string;
}

export function escapeHtml(value: unknown): string {
  const normalized = value == null ? '' : String(value);

  return normalized
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderUiBadge(spec: UiBadgeSpec): string {
  const style = spec.style ?? 'pill';
  const tone = spec.tone ?? 'neutral';

  return `<span class="ui-${style} ui-${style}--${tone}">${escapeHtml(spec.label)}</span>`;
}

export function renderUiToggleButton(spec: UiToggleButtonSpec): string {
  return `<button class="ui-toggle ${spec.active ? 'is-active' : ''}" data-${escapeHtml(spec.kind)}="${escapeHtml(spec.value)}">${escapeHtml(spec.label)}</button>`;
}

export function renderUiActionButton(spec: UiActionButtonSpec): string {
  const variant = spec.variant ?? 'primary';
  const attributeList = Object.entries(spec.dataAttributes ?? {})
    .filter(([, value]) => value != null)
    .map(([key, value]) => ` data-${escapeHtml(key)}="${escapeHtml(value)}"`)
    .join('');

  if (spec.href) {
    return `<a class="ui-button ui-button--${variant}" href="${escapeHtml(spec.href)}"${attributeList}>${escapeHtml(spec.label)}</a>`;
  }

  return `<button class="ui-button ui-button--${variant}" type="button"${attributeList}>${escapeHtml(spec.label)}</button>`;
}

export function renderUiInputField(spec: UiInputFieldSpec): string {
  return `
    <label class="ui-field">
      <span class="ui-field__label">${escapeHtml(spec.label)}</span>
      <input
        class="ui-control"
        type="${escapeHtml(spec.type ?? 'text')}"
        value="${escapeHtml(spec.value)}"
        data-field-key="${escapeHtml(spec.dataKey)}"
        ${spec.placeholder ? `placeholder="${escapeHtml(spec.placeholder)}"` : ''}
      />
      ${spec.hint ? `<span class="ui-field__hint">${escapeHtml(spec.hint)}</span>` : ''}
    </label>
  `;
}

export function renderUiSelectField(spec: UiSelectFieldSpec): string {
  return `
    <label class="ui-field">
      <span class="ui-field__label">${escapeHtml(spec.label)}</span>
      <select class="ui-control" data-field-key="${escapeHtml(spec.dataKey)}">
        ${spec.options
          .map(
            (option) =>
              `<option value="${escapeHtml(option.value)}"${option.value === spec.value ? ' selected' : ''}>${escapeHtml(option.label)}</option>`,
          )
          .join('')}
      </select>
      ${spec.hint ? `<span class="ui-field__hint">${escapeHtml(spec.hint)}</span>` : ''}
    </label>
  `;
}

export function renderUiTextAreaField(spec: UiTextAreaFieldSpec): string {
  return `
    <label class="ui-field">
      <span class="ui-field__label">${escapeHtml(spec.label)}</span>
      <textarea
        class="ui-control ui-control--textarea"
        rows="${String(spec.rows ?? 4)}"
        data-field-key="${escapeHtml(spec.dataKey)}"
        ${spec.placeholder ? `placeholder="${escapeHtml(spec.placeholder)}"` : ''}
      >${escapeHtml(spec.value)}</textarea>
      ${spec.hint ? `<span class="ui-field__hint">${escapeHtml(spec.hint)}</span>` : ''}
    </label>
  `;
}

export function renderUiMetricCard(spec: UiMetricCardSpec): string {
  return `
    <article class="surface ui-card ui-card--metric">
      <div class="ui-card__header">
        <h3 class="ui-card__title">${escapeHtml(spec.title)}</h3>
        ${renderUiBadge({ label: spec.title, tone: spec.tone ?? 'neutral', style: 'chip' })}
      </div>
      <strong class="ui-metric__value">${escapeHtml(spec.value)}</strong>
      <p class="ui-card__text">${escapeHtml(spec.description)}</p>
    </article>
  `;
}

export function renderUiPanelCard(spec: UiPanelCardSpec): string {
  return `
    <article class="surface ui-card ui-card--panel">
      <div class="ui-card__header">
        <div>
          ${spec.eyebrow ? `<p class="ui-card__eyebrow">${escapeHtml(spec.eyebrow)}</p>` : ''}
          <h3 class="ui-card__title">${escapeHtml(spec.title)}</h3>
        </div>
        ${spec.badgeLabel ? renderUiBadge({ label: spec.badgeLabel, tone: spec.badgeTone ?? 'neutral' }) : ''}
      </div>
      <div class="ui-card__content">${spec.contentHtml}</div>
    </article>
  `;
}

export function renderUiRecordCard(spec: UiRecordCardSpec): string {
  return `
    <article class="surface ui-card ui-card--record">
      <div class="ui-card__header">
        <div>
          <h3 class="ui-card__title">${escapeHtml(spec.title)}</h3>
          ${spec.subtitle ? `<p class="ui-card__subtitle">${escapeHtml(spec.subtitle)}</p>` : ''}
        </div>
        ${spec.badgeLabel ? renderUiBadge({ label: spec.badgeLabel, tone: spec.badgeTone ?? 'neutral' }) : ''}
      </div>
      ${
        spec.chips && spec.chips.length > 0
          ? `<div class="ui-card__chips">${spec.chips.map((chip) => renderUiBadge({ ...chip, style: 'chip' })).join('')}</div>`
          : ''
      }
      ${spec.bodyHtml ? `<div class="ui-card__content">${spec.bodyHtml}</div>` : ''}
      ${
        spec.detailsHtml
          ? `
            <details class="ui-details">
              <summary>${escapeHtml(spec.detailsSummary ?? 'Detalhes')}</summary>
              <div class="ui-details__content">${spec.detailsHtml}</div>
            </details>
          `
          : ''
      }
    </article>
  `;
}
