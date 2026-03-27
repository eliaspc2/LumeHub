import type { BackendRuntimeConfig } from './BackendRuntimeConfig.js';
import { KernelFactory } from './KernelFactory.js';

export interface RuntimeBuilderOptions {
  readonly runtimeConfig?: BackendRuntimeConfig;
  readonly kernelFactory?: KernelFactory;
}

export class RuntimeBuilder {
  private readonly kernelFactory: KernelFactory;

  constructor(private readonly options: RuntimeBuilderOptions = {}) {
    this.kernelFactory =
      options.kernelFactory ??
      new KernelFactory({
        runtimeConfig: options.runtimeConfig,
      });
  }

  build() {
    return this.kernelFactory.create();
  }
}
