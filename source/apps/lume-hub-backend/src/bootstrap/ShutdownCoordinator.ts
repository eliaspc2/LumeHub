export class ShutdownCoordinator {
  install(_shutdown: () => Promise<void>): void {
    // Wave 0 leaves process signal wiring intentionally thin.
  }
}
