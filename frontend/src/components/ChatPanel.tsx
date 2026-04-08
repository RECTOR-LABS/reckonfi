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
import { Send, Zap } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ─── Quick action suggestions ─────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: 'Check Balance', prompt: 'What is my current portfolio balance?' },
  { label: 'Analyze Portfolio', prompt: 'Analyze my portfolio risk and diversification.' },
  { label: 'Move to Stables', prompt: 'How should I move my positions to stablecoins?' },
] as const;

// ─── Timestamp formatter ──────────────────────────────────────────────────────

function formatMessageTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-1',
        isUser ? 'items-end' : 'items-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'rounded-tl-sm text-foreground'
        )}
        style={
          isUser
            ? undefined
            : {
                background:
                  'linear-gradient(135deg, hsl(var(--muted)) 0%, oklch(0.24 0.02 280) 100%)',
              }
        }
      >
        {message.content}
      </div>
      <span className="text-[10px] text-muted-foreground px-1">
        {formatMessageTime(message.timestamp)}
      </span>
    </div>
  );
}

// ─── Thinking indicator ───────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div className="flex justify-start items-start gap-2">
      <div
        className="rounded-2xl rounded-tl-sm px-3.5 py-3 flex items-center gap-1.5"
        style={{
          background:
            'linear-gradient(135deg, hsl(var(--muted)) 0%, oklch(0.24 0.02 280) 100%)',
        }}
      >
        <span className="text-xs text-muted-foreground">Thinking</span>
        <span className="flex gap-0.5 items-center">
          {[0, 200, 400].map((delay) => (
            <span
              key={delay}
              className="size-1.5 rounded-full bg-violet-400"
              style={{
                animation: `pulse-dot 1.2s ease-in-out ${delay}ms infinite`,
              }}
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
  timestamp: new Date(),
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

  const handleSend = useCallback(async (overrideContent?: string) => {
    const content = (overrideContent ?? input).trim();
    if (!content || isSending) return;

    setSendError(null);
    if (!overrideContent) setInput('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
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
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      setSendError(msg);

      // Remove the optimistically-added user message on failure
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      if (!overrideContent) setInput(content); // restore input so the user can retry
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

      {/* Quick action chips */}
      <div className="px-4 pb-2 flex gap-2 flex-wrap border-t pt-3">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground self-center mr-1">
          <Zap className="size-3" aria-hidden="true" />
          Quick
        </span>
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={isSending}
            onClick={() => handleSend(action.prompt)}
            className={cn(
              'text-[11px] px-2.5 py-1 rounded-full border border-border',
              'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
              'transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
            )}
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="px-4 pb-4 flex items-center gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your portfolio…"
          disabled={isSending}
          className="flex-1 h-10 bg-muted/40 border-border focus-visible:ring-violet-500/50"
          aria-label="Chat input"
        />
        <Button
          onClick={() => handleSend()}
          disabled={isSending || !input.trim()}
          size="sm"
          className="h-10 px-3 gap-1.5"
          aria-label="Send message"
        >
          <Send className="size-3.5" aria-hidden="true" />
          Send
        </Button>
      </div>
    </div>
  );
}
