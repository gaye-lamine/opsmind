import { ERROR_CODES } from "../constants";
import { AgentError } from "../validators";

/**
 * Wraps a promise with a timeout.
 * If the promise does not resolve within the specified time, it rejects with an AgentError.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
  errorCode: string = ERROR_CODES.AGENT_TIMEOUT
): Promise<T> {
  let timeoutHandle: any;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new AgentError(errorMessage, errorCode));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return result as T;
  } catch (error) {
    clearTimeout(timeoutHandle!);
    throw error;
  }
}
