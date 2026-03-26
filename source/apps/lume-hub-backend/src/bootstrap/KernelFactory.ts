import { ApplicationKernel } from '@lume-hub/kernel';

export class KernelFactory {
  create(): ApplicationKernel {
    return new ApplicationKernel();
  }
}
