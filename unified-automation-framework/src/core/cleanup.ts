import type { Logger } from '../logging/logger';

interface CleanupTask {
  description: string;
  run: () => Promise<unknown>;
}

/**
 * Tests register how to undo the data they create, right after creating it.
 * Tasks run in reverse order (an order before its customer) and one failure
 * does not stop the rest.
 */
export class CleanupRegistry {
  private readonly tasks: CleanupTask[] = [];

  add(description: string, run: () => Promise<unknown>): void {
    this.tasks.push({ description, run });
  }

  /** Runs every task and returns the descriptions of those that failed. */
  async runAll(logger: Logger): Promise<string[]> {
    const failed: string[] = [];
    for (const task of this.tasks.splice(0).reverse()) {
      try {
        await task.run();
      } catch (error) {
        failed.push(task.description);
        logger.warn(`Cleanup failed: ${task.description}`, { error });
      }
    }
    return failed;
  }
}
