import { createLogger } from "@opsmind/shared";
import { type PipelineStepEvent } from "../interfaces/agent.interfaces";

const logger = createLogger("SseEventStore");

/**
 * SSE Event Store — in-memory store of pipeline events per session.
 *
 * Enables real-time streaming of agent pipeline events to connected SSE clients.
 * Events are stored per sessionId and consumed by the SSE endpoint.
 *
 * Design:
 * - Singleton — one store for the entire process
 * - Events are appended as the agent pipeline progresses
 * - Clients poll via cursor (event index) to receive only new events
 * - Sessions are automatically cleaned up after TTL to prevent memory leaks
 *
 * This lives in packages/agent because it is part of the agent runtime —
 * it bridges the agent execution loop and the API streaming layer.
 */

const SESSION_TTL_MS = 10 * 60 * 1000;

interface SessionEventBuffer {
  events: PipelineStepEvent[];
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
}

export class SseEventStore {
  private static instance: SseEventStore | null = null;

  private readonly sessions = new Map<string, SessionEventBuffer>();

  private constructor() {
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  static getInstance(): SseEventStore {
    if (SseEventStore.instance === null) {
      SseEventStore.instance = new SseEventStore();
    }
    return SseEventStore.instance;
  }

  /**
   * Initializes a new event buffer for a session.
   * Must be called before the agent pipeline starts.
   */
  initSession(sessionId: string): void {
    this.sessions.set(sessionId, {
      events: [],
      completed: false,
      createdAt: new Date(),
    });
    logger.debug("SSE session initialized", { sessionId });
  }

  /**
   * Appends a pipeline event to the session buffer.
   * Called by the agent orchestrator via the onEvent callback.
   */
  push(sessionId: string, event: PipelineStepEvent): void {
    const buffer = this.sessions.get(sessionId);
    if (buffer === undefined) {
      logger.warn("SSE push to unknown session", { sessionId, eventType: event.type });
      return;
    }

    buffer.events.push(event);

    // Mark session as completed when terminal event received
    if (event.type === "session_completed" || event.type === "session_failed") {
      buffer.completed = true;
      buffer.completedAt = new Date();
      logger.debug("SSE session marked complete", { sessionId, eventType: event.type });
    }
  }

  /**
   * Returns events for a session starting from the given cursor (index).
   * Returns all events from cursor onwards — client tracks its own cursor.
   */
  getEvents(
    sessionId: string,
    fromIndex: number
  ): { events: PipelineStepEvent[]; completed: boolean; total: number } {
    const buffer = this.sessions.get(sessionId);
    if (buffer === undefined) {
      return { events: [], completed: true, total: 0 };
    }

    return {
      events: buffer.events.slice(fromIndex),
      completed: buffer.completed,
      total: buffer.events.length,
    };
  }

  /**
   * Returns true if the session exists in the store.
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Returns true if the session has completed (success or failure).
   */
  isCompleted(sessionId: string): boolean {
    return this.sessions.get(sessionId)?.completed ?? false;
  }

  /**
   * Removes stale completed sessions past the TTL.
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [sessionId, buffer] of this.sessions.entries()) {
      if (
        buffer.completed &&
        buffer.completedAt !== undefined &&
        now - buffer.completedAt.getTime() > SESSION_TTL_MS
      ) {
        this.sessions.delete(sessionId);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug("SSE event store cleanup", { removed, remaining: this.sessions.size });
    }
  }
}

export function getSseEventStore(): SseEventStore {
  return SseEventStore.getInstance();
}
