import { HostLifecycleModule } from '@lume-hub/host-lifecycle';
import { SystemPowerModule } from '@lume-hub/system-power';

export class HostModuleLoader {
  load() {
    return [new HostLifecycleModule(), new SystemPowerModule()];
  }
}
