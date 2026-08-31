let activeTask: Promise<void> = Promise.resolve();

export function runExclusively<T>(task: () => Promise<T>): Promise<T> {
  const run = activeTask.then(task, task);
  activeTask = run.then(() => undefined, () => undefined);
  return run;
}
