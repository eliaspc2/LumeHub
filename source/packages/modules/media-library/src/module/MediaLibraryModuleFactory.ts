import type { ModuleContext } from '@lume-hub/kernel';

import { MediaLibraryModule } from './MediaLibraryModule.js';
import type { MediaLibraryModuleConfig } from './MediaLibraryModuleConfig.js';

export class MediaLibraryModuleFactory {
  create(_context: ModuleContext, config: MediaLibraryModuleConfig = {}): MediaLibraryModule {
    return new MediaLibraryModule(config);
  }
}
