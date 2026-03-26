import { KernelFactory } from './KernelFactory.js';

export class RuntimeBuilder {
  constructor(private readonly kernelFactory = new KernelFactory()) {}

  build() {
    return this.kernelFactory.create();
  }
}
