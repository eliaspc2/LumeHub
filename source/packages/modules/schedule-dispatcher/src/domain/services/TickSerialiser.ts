export class TickSerialiser {
  private current = Promise.resolve();

  runExclusive<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
    const nextRun = this.current.then(operation, operation);
    this.current = nextRun.then(
      () => undefined,
      () => undefined,
    );
    return nextRun;
  }
}
