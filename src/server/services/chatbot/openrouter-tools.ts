/**
 * OpenRouter Service with Tool Calling Support
 *
 * This service integrates MCP-style tools with OpenRouter's tool calling API,
 * allowing the LLM to decide which tools to call based on user queries.
 */

import { getToolsForLLM, executeTool, type ToolResult } from './tools';
import type { SupabaseClient } from '@supabase/supabase-js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Primary model with fallback
const PRIMARY_MODEL = 'anthropic/claude-3.5-haiku';
const FALLBACK_MODEL = 'google/gemini-2.0-flash-001';

// Get model to use
function getModel(): string {
  return process.env.OPENROUTER_MODEL || PRIMARY_MODEL;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
  error?: {
    message: string;
  };
}

// System prompt for the tool-enabled chatbot
const SYSTEM_PROMPT = `You are an AI assistant for the Axis Event Tracker system. You help transport managers and event staff with guest and transport data.

You have access to the following tools:

**Query Tools:**
- count_guests: Count guests with optional filters (location, status, transfer needs, dates)
- get_guests: Get guest details with filters and search
- get_busiest_arrival_day: Find the busiest arrival day(s)
- get_guest_stats: Get comprehensive guest statistics
- get_vehicles: Get vehicle fleet information
- get_transport_schedules: Get transport schedules for a specific date

**Update Tools:**
- find_guest: Search for a specific guest by name or email to verify their details
- update_guest: Update a guest's information (flights, transfers, hotel dates, etc.)

IMPORTANT RULES:
1. ALWAYS use tools to get data - never make up numbers or dates
2. Use the most specific tool for the user's question
3. For counts, use count_guests with appropriate filters
4. For "how many guests from [location]", use count_guests with location filter
5. For "busiest day", use get_busiest_arrival_day
6. For transport info, use get_vehicles or get_transport_schedules
7. After getting tool results, provide a natural, helpful response
8. Format numbers clearly (e.g., "252 guests" not just "252")
9. Include relevant context in your response

**For guest updates:**
10. When asked to update a guest, FIRST use find_guest to verify the guest exists and get their current data
11. Then use update_guest with the search_name matching the exact name from find_guest
12. Always confirm the changes after updating
13. For flight updates, include flight number, date (YYYY-MM-DD format), and time (HH:MM format)
14. For transfer needs, set needs_arrival_transfer or needs_departure_transfer to true/false

Current date: ${new Date().toISOString().split('T')[0]}`;

/**
 * Process a message with tool calling support
 */
export async function processWithTools(
  userMessage: string,
  supabase: SupabaseClient,
  conversationHistory: ChatMessage[] = []
): Promise<{ response: string; toolsUsed: string[] }> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const tools = getToolsForLLM();
  const toolsUsed: string[] = [];

  // Build messages array
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  // First API call - may return tool calls
  let response = await callOpenRouter(apiKey, messages, tools);
  let assistantMessage = response.choices[0]?.message;

  // Handle tool calls (loop in case of multiple sequential calls)
  let iterations = 0;
  const maxIterations = 5; // Prevent infinite loops

  while (assistantMessage?.tool_calls && iterations < maxIterations) {
    iterations++;

    // Add assistant message with tool calls to history
    messages.push({
      role: 'assistant',
      content: assistantMessage.content || '',
      tool_calls: assistantMessage.tool_calls,
    });

    // Execute each tool call
    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;
      toolsUsed.push(toolName);

      console.log(`[Tool Call] ${toolName}:`, toolCall.function.arguments);

      let toolResult: ToolResult;
      try {
        const params = JSON.parse(toolCall.function.arguments);
        toolResult = await executeTool(toolName, params, supabase);
      } catch (error) {
        toolResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to parse arguments',
        };
      }

      console.log(`[Tool Result] ${toolName}:`, toolResult);

      // Add tool result to messages
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolName,
        content: JSON.stringify(toolResult),
      });
    }

    // Call API again with tool results
    response = await callOpenRouter(apiKey, messages, tools);
    assistantMessage = response.choices[0]?.message;
  }

  // Return final response
  const finalContent = assistantMessage?.content || 'I apologize, but I encountered an issue processing your request.';

  return {
    response: finalContent,
    toolsUsed,
  };
}

/**
 * Call OpenRouter API with automatic retry on failure
 */
async function callOpenRouter(
  apiKey: string,
  messages: ChatMessage[],
  tools: ReturnType<typeof getToolsForLLM>,
  model?: string
): Promise<OpenRouterResponse> {
  const modelToUse = model || getModel();

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Axis Event Tracker',
    },
    body: JSON.stringify({
      model: modelToUse,
      messages,
      tools,
      tool_choice: 'auto', // Let the model decide when to use tools
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    // If primary model fails, try fallback
    if (!model && modelToUse !== FALLBACK_MODEL) {
      console.warn(`Primary model ${modelToUse} failed, trying fallback ${FALLBACK_MODEL}`);
      return callOpenRouter(apiKey, messages, tools, FALLBACK_MODEL);
    }

    // Check if response is HTML (gateway error)
    if (errorText.startsWith('<') || errorText.includes('<!DOCTYPE')) {
      throw new Error(`OpenRouter service unavailable (received HTML error page). Status: ${response.status}`);
    }

    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  // Check content type before parsing
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    const text = await response.text();
    // If we got HTML, try fallback
    if (!model && modelToUse !== FALLBACK_MODEL && (text.startsWith('<') || text.includes('<!DOCTYPE'))) {
      console.warn(`Primary model returned HTML, trying fallback ${FALLBACK_MODEL}`);
      return callOpenRouter(apiKey, messages, tools, FALLBACK_MODEL);
    }
    throw new Error(`OpenRouter returned non-JSON response: ${text.substring(0, 100)}...`);
  }

  const data = await response.json() as OpenRouterResponse;

  if (data.error) {
    // Try fallback on API errors
    if (!model && modelToUse !== FALLBACK_MODEL) {
      console.warn(`Model error: ${data.error.message}, trying fallback ${FALLBACK_MODEL}`);
      return callOpenRouter(apiKey, messages, tools, FALLBACK_MODEL);
    }
    throw new Error(`OpenRouter error: ${data.error.message}`);
  }

  return data;
}

/**
 * Handle simple greetings without tools
 */
export async function handleGreeting(userMessage: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const fallbackResponse = "Hello! I'm your Axis Event Tracker assistant. I can help you with guest information, arrivals, departures, and transport assignments. What would you like to know?";

  if (!apiKey) {
    return fallbackResponse;
  }

  const models = [getModel(), FALLBACK_MODEL];

  for (const model of models) {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'Axis Event Tracker',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `You are a friendly AI assistant for the Axis Event Tracker system.
You help transport managers and event staff with:
- Finding guest information
- Checking arrival and departure schedules
- Transport and vehicle assignments
- Event statistics and summaries
- **Updating guest information** (flights, transfers, hotels)

Be concise, friendly, and professional. Use bullet points when listing capabilities.
Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
            },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
          max_tokens: 512,
        }),
      });

      if (!response.ok) {
        console.warn(`Model ${model} returned status ${response.status}, trying next...`);
        continue;
      }

      // Check content type
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        console.warn(`Model ${model} returned non-JSON, trying next...`);
        continue;
      }

      const data = await response.json() as OpenRouterResponse;

      if (data.error) {
        console.warn(`Model ${model} error: ${data.error.message}, trying next...`);
        continue;
      }

      return data.choices[0]?.message?.content || fallbackResponse;
    } catch (error) {
      console.warn(`Model ${model} failed:`, error);
      continue;
    }
  }

  return fallbackResponse;
}

/**
 * Check if OpenRouter is configured
 */
export function isConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}
