/**
 * ElizaOS messaging API client.
 *
 * Manages a single session per page load. Session is created lazily on first
 * `sendMessage` call and reused for subsequent calls within the same session.
 */

const BASE_URL = import.meta.env.VITE_ELIZAOS_API_URL ?? 'http://localhost:3000';

// Module-level session state — one session per browser session
let sessionId: string | null = null;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  agentId: string;
  createdAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface SendMessageResponse {
  message: Message;
  response: Message;
}

// ─── Session management ───────────────────────────────────────────────────────

/**
 * Creates a new messaging session for the given agent.
 * Stores the session ID at module level for subsequent calls.
 */
export async function createSession(agentId: string): Promise<Session> {
  const res = await fetch(`${BASE_URL}/api/messaging/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create session (${res.status}): ${text}`);
  }

  const session: Session = await res.json();
  sessionId = session.id;
  return session;
}

/**
 * Returns the active session ID, throwing if no session has been created.
 */
export function getActiveSessionId(): string {
  if (!sessionId) {
    throw new Error('No active session. Call createSession() first.');
  }
  return sessionId;
}

// ─── Messaging ────────────────────────────────────────────────────────────────

/**
 * Sends a message to the active session and returns both the user message
 * and the agent's response.
 */
export async function sendMessage(content: string): Promise<SendMessageResponse> {
  const id = getActiveSessionId();

  const res = await fetch(`${BASE_URL}/api/messaging/sessions/${id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to send message (${res.status}): ${text}`);
  }

  return res.json() as Promise<SendMessageResponse>;
}

/**
 * Retrieves message history for the active session.
 *
 * @param limit - Maximum number of messages to return (default: 50)
 */
export async function getMessages(limit = 50): Promise<Message[]> {
  const id = getActiveSessionId();

  const url = new URL(`${BASE_URL}/api/messaging/sessions/${id}/messages`);
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString());

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch messages (${res.status}): ${text}`);
  }

  return res.json() as Promise<Message[]>;
}
