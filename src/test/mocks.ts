import type {
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  Content,
} from "@elizaos/core";

// Stable placeholder UUIDs for test fixtures
const MOCK_ENTITY_ID = "00000000-0000-0000-0000-000000000001" as const;
const MOCK_ROOM_ID = "00000000-0000-0000-0000-000000000002" as const;
const MOCK_AGENT_ID = "00000000-0000-0000-0000-000000000003" as const;

type UUID = `${string}-${string}-${string}-${string}-${string}`;

/** Default setting values returned by mock runtime */
const DEFAULT_SETTINGS: Record<string, string> = {
  WALLET_ADDRESS: "FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr",
  HELIUS_API_KEY: "mock-helius-api-key",
  SOLANA_RPC_URL: "https://api.devnet.solana.com",
};

/**
 * Creates a minimal mock IAgentRuntime for unit tests.
 * getSetting returns DEFAULT_SETTINGS values by key; overrides are merged on top.
 */
export function createMockRuntime(
  overrides: Partial<IAgentRuntime> & { settings?: Record<string, string> } = {}
): IAgentRuntime {
  const { settings: settingOverrides = {}, ...runtimeOverrides } = overrides;
  const mergedSettings = { ...DEFAULT_SETTINGS, ...settingOverrides };

  const base = {
    agentId: MOCK_AGENT_ID as UUID,
    getSetting: (key: string): string | boolean | number | null =>
      mergedSettings[key] ?? null,
  } as unknown as IAgentRuntime;

  return Object.assign(base, runtimeOverrides);
}

/**
 * Creates a minimal mock Memory object with the given text.
 * entityId and roomId are required by the Memory interface and are set to stable test UUIDs.
 */
export function createMockMessage(text: string): Memory {
  return {
    entityId: MOCK_ENTITY_ID as UUID,
    roomId: MOCK_ROOM_ID as UUID,
    agentId: MOCK_AGENT_ID as UUID,
    content: { text } satisfies Content,
  };
}

/**
 * Creates a minimal valid State object.
 * State requires `values`, `data`, and `text` fields.
 */
export function createMockState(): State {
  return {
    values: {},
    data: {},
    text: "",
  };
}

/**
 * Creates a mock HandlerCallback that tracks all calls and responses.
 * Access `.calls` to inspect invocations in tests.
 */
export function createMockCallback(): HandlerCallback & {
  calls: Content[];
} {
  const calls: Content[] = [];

  const callback = async (response: Content): Promise<Memory[]> => {
    calls.push(response);
    return [];
  };

  (callback as typeof callback & { calls: Content[] }).calls = calls;

  return callback as HandlerCallback & { calls: Content[] };
}
