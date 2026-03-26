import type { FrontendUiEvent } from '@lume-hub/frontend-api-client';
import type { NavigationItem, UiPage } from '@lume-hub/shared-ui';

import { AppRouter } from '../app/AppRouter.js';

export interface RenderedAppShell {
  readonly navigation: readonly NavigationItem[];
  readonly pages: readonly UiPage[];
  readonly contextPanel: readonly string[];
}

export class AppShell {
  constructor(
    private readonly router: AppRouter,
    private readonly liveEvents: readonly FrontendUiEvent[] = [],
  ) {}

  async render(): Promise<RenderedAppShell> {
    return {
      navigation: this.router.navigation(),
      pages: await this.router.renderPages(),
      contextPanel: this.liveEvents.map((event) => `${event.topic} @ ${event.emittedAt}`),
    };
  }

  async renderText(): Promise<string> {
    const rendered = await this.render();

    return [
      `nav: ${rendered.navigation.map((item) => `${item.label}(${item.route})`).join(' | ')}`,
      ...rendered.pages.map(
        (page) =>
          `${page.title}: ${page.sections
            .map((section) => `${section.title}[${section.lines.join(' ; ')}]`)
            .join(' | ')}`,
      ),
      `context: ${rendered.contextPanel.join(' | ') || 'no live events'}`,
    ].join('\n');
  }
}
