type ProcessCleanupEvent =
  | NodeJS.Signals
  | "beforeExit"
  | "exit"
  | "uncaughtException"
  | "unhandledRejection"

export function getNewListener(
  signal: ProcessCleanupEvent,
  existingListeners: Function[],
): (...args: Array<unknown>) => void {
  const listeners = signal === "beforeExit"
    ? process.listeners("beforeExit")
    : signal === "exit"
      ? process.listeners("exit")
      : signal === "uncaughtException"
        ? process.listeners("uncaughtException")
        : signal === "unhandledRejection"
          ? process.listeners("unhandledRejection")
          : process.listeners(signal)
  const listener = listeners.find((registeredListener) => !existingListeners.includes(registeredListener))

  if (typeof listener !== "function") {
    throw new Error(`Expected a ${signal} listener to be registered`)
  }

  const nextListener = listener as (...args: Array<unknown>) => void
  return (...args) => nextListener(...args)
}

export async function flushMicrotasks(): Promise<void> {
  for (let iteration = 0; iteration < 10; iteration += 1) {
    await Promise.resolve()
  }
}
