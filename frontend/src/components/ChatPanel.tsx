/**
 * ChatPanel — conversational interface with the ReckonFi AI agent.
 * Uses the ElizaOS messaging API via @/lib/api.
 * Session is created lazily on first message send.
 */

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from 'react';
import { createSession, sendMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted text-foreground rounded-tl-sm'
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

// ─── Thinking indicator ───────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center gap-1">
        <span className="text-xs text-muted-foreground">Thinking</span>
        <span className="flex gap-0.5 items-end pb-0.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="size-1 rounded-full bg-muted-foreground animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hello! I'm ReckonFi, your AI-powered DeFi portfolio advisor. Ask me about your positions, market conditions, or risk analysis.",
};

// Module-level flag: session creation attempted per page load
let sessionInitialized = false;

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom whenever messages change or thinking state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Eagerly init session in the background so first send is faster
  useEffect(() => {
    if (sessionInitialized) return;
    sessionInitialized = true;

    const agentId = import.meta.env.VITE_AGENT_ID ?? 'default';
    createSession(agentId).catch(() => {
      // Non-fatal: will retry implicitly on send
      sessionInitialized = false;
    });
  }, []);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || isSending) return;

    setSendError(null);
    setInput('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      // Ensure session exists — createSession is idempotent if already set
      const agentId = import.meta.env.VITE_AGENT_ID ?? 'default';
      if (!sessionInitialized) {
        sessionInitialized = true;
        await createSession(agentId);
      }

      const { response } = await sendMessage(content);

      const assistantMsg: ChatMessage = {
        id: response.id,
        role: 'assistant',
        content: response.content,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      setSendError(msg);

      // Remove the optimistically-added user message on failure
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setInput(content); // restore input so the user can retry
    } finally {
      setIsSending(false);
      // Refocus input after response
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [input, isSending]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Message area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-4 space-y-3">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isSending && <ThinkingIndicator />}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Error banner */}
      {sendError && (
        <div
          role="alert"
          className="mx-4 mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {sendError}
        </div>
      )}

      {/* Input row */}
      <div className="border-t px-4 py-3 flex items-center gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your portfolio…"
          disabled={isSending}
          className="flex-1"
          aria-label="Chat input"
        />
        <Button
          onClick={handleSend}
          disabled={isSending || !input.trim()}
          size="sm"
          aria-label="Send message"
        >
          Send
        </Button>
      </div>
    </div>
  );
}
