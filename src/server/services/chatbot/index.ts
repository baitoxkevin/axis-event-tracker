// Main Chatbot Service with AI-powered query generation
import type { SupabaseClient } from '@supabase/supabase-js';
import { SYSTEM_PROMPT, QUERY_GENERATION_PROMPT, QUICK_RESPONSES } from './prompts';
import { validateQuery, buildSafeQuery } from './query-validator';
import {
  generateQuery,
  generateResponse,
  handleConversation,
  isOpenRouterConfigured,
} from './openrouter';
import {
  processWithTools,
  handleGreeting,
  isConfigured as isMcpToolsConfigured,
} from './openrouter-tools';
import type {
  ChatMessage,
  ChatbotResponse,
  QueryType,
  AllowedTable
} from './types';
import { format, parseISO, isValid, addDays } from 'date-fns';

interface ChatbotServiceConfig {
  supabase: SupabaseClient;
  useAI?: boolean; // Enable AI-powered responses
  useMcpTools?: boolean; // Use MCP-style tool calling (recommended)
}

// Pattern-based query handlers for common questions (no AI needed)
const PATTERN_HANDLERS: Array<{
  patterns: RegExp[];
  handler: (match: RegExpMatchArray, supabase: SupabaseClient) => Promise<ChatbotResponse>;
}> = [
  {
    // How many guests total / count all guests
    patterns: [
      /how many (total\s+)?guests?/i,
      /count (all\s+)?guests?/i,
      /total (number of\s+)?guests?/i,
    ],
    handler: async (_match, supabase) => {
      const { count, error } = await supabase
        .from('guests')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);

      if (error) throw error;
      return {
        message: `There are **${count || 0} guests** registered in the system.`,
        metadata: { queryType: 'count', resultCount: count || 0 },
      };
    },
  },
  {
    // Guests arriving today/tomorrow/on specific date
    patterns: [
      /(?:who|guests?|how many).*arriv(?:ing|e|al).*today/i,
      /today['s]?\s+arrivals?/i,
    ],
    handler: async (_match, supabase) => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, count, error } = await supabase
        .from('guests')
        .select('first_name, last_name, arrival_time, arrival_flight_number, arrival_airport', { count: 'exact' })
        .eq('arrival_date', today)
        .is('deleted_at', null)
        .order('arrival_time');

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          message: `No guests are arriving today (${format(new Date(), 'MMMM d, yyyy')}).`,
          metadata: { queryType: 'list', resultCount: 0 },
        };
      }

      const guestList = data.map((g, i) =>
        `${i + 1}. **${g.first_name} ${g.last_name}** - ${g.arrival_time || 'Time TBD'}${g.arrival_flight_number ? ` (${g.arrival_flight_number})` : ''}`
      ).join('\n');

      return {
        message: `**${count} guest${count !== 1 ? 's' : ''} arriving today** (${format(new Date(), 'MMMM d, yyyy')}):\n\n${guestList}`,
        metadata: { queryType: 'list', resultCount: count || 0 },
      };
    },
  },
  {
    // Guests arriving tomorrow
    patterns: [
      /(?:who|guests?|how many).*arriv(?:ing|e|al).*tomorrow/i,
      /tomorrow['s]?\s+arrivals?/i,
    ],
    handler: async (_match, supabase) => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      const { data, count, error } = await supabase
        .from('guests')
        .select('first_name, last_name, arrival_time, arrival_flight_number', { count: 'exact' })
        .eq('arrival_date', tomorrow)
        .is('deleted_at', null)
        .order('arrival_time');

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          message: `No guests are arriving tomorrow (${format(addDays(new Date(), 1), 'MMMM d, yyyy')}).`,
          metadata: { queryType: 'list', resultCount: 0 },
        };
      }

      const guestList = data.slice(0, 10).map((g, i) =>
        `${i + 1}. **${g.first_name} ${g.last_name}** - ${g.arrival_time || 'Time TBD'}${g.arrival_flight_number ? ` (${g.arrival_flight_number})` : ''}`
      ).join('\n');

      const moreText = count && count > 10 ? `\n\n_...and ${count - 10} more_` : '';

      return {
        message: `**${count} guest${count !== 1 ? 's' : ''} arriving tomorrow** (${format(addDays(new Date(), 1), 'MMMM d, yyyy')}):\n\n${guestList}${moreText}`,
        metadata: { queryType: 'list', resultCount: count || 0 },
      };
    },
  },
  {
    // Guests departing today/tomorrow
    patterns: [
      /(?:who|guests?|how many).*depart(?:ing|ure).*today/i,
      /today['s]?\s+departures?/i,
    ],
    handler: async (_match, supabase) => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, count, error } = await supabase
        .from('guests')
        .select('first_name, last_name, departure_time, departure_flight_number', { count: 'exact' })
        .eq('departure_date', today)
        .is('deleted_at', null)
        .order('departure_time');

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          message: `No guests are departing today (${format(new Date(), 'MMMM d, yyyy')}).`,
          metadata: { queryType: 'list', resultCount: 0 },
        };
      }

      const guestList = data.map((g, i) =>
        `${i + 1}. **${g.first_name} ${g.last_name}** - ${g.departure_time || 'Time TBD'}${g.departure_flight_number ? ` (${g.departure_flight_number})` : ''}`
      ).join('\n');

      return {
        message: `**${count} guest${count !== 1 ? 's' : ''} departing today** (${format(new Date(), 'MMMM d, yyyy')}):\n\n${guestList}`,
        metadata: { queryType: 'list', resultCount: count || 0 },
      };
    },
  },
  {
    // Guests needing transfer
    patterns: [
      /(?:who|guests?|how many).*need.*transfer/i,
      /transfer.*(?:list|needs?)/i,
      /airport.*(?:pickup|transfer)/i,
    ],
    handler: async (_match, supabase) => {
      const { data, count, error } = await supabase
        .from('guests')
        .select('first_name, last_name, arrival_date, arrival_time, departure_date, departure_time, needs_arrival_transfer, needs_departure_transfer', { count: 'exact' })
        .is('deleted_at', null)
        .or('needs_arrival_transfer.eq.true,needs_departure_transfer.eq.true')
        .order('arrival_date');

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          message: 'No guests currently need airport transfer.',
          metadata: { queryType: 'list', resultCount: 0 },
        };
      }

      const arrivalTransfers = data.filter(g => g.needs_arrival_transfer);
      const departureTransfers = data.filter(g => g.needs_departure_transfer);

      let message = `**${count} guest${count !== 1 ? 's' : ''} need transfer**\n\n`;

      if (arrivalTransfers.length > 0) {
        message += `**Arrival transfers (${arrivalTransfers.length}):**\n`;
        message += arrivalTransfers.slice(0, 5).map((g, i) =>
          `${i + 1}. ${g.first_name} ${g.last_name}${g.arrival_date ? ` - ${g.arrival_date}` : ''}`
        ).join('\n');
        if (arrivalTransfers.length > 5) message += `\n_...and ${arrivalTransfers.length - 5} more_`;
        message += '\n\n';
      }

      if (departureTransfers.length > 0) {
        message += `**Departure transfers (${departureTransfers.length}):**\n`;
        message += departureTransfers.slice(0, 5).map((g, i) =>
          `${i + 1}. ${g.first_name} ${g.last_name}${g.departure_date ? ` - ${g.departure_date}` : ''}`
        ).join('\n');
        if (departureTransfers.length > 5) message += `\n_...and ${departureTransfers.length - 5} more_`;
      }

      return {
        message,
        metadata: { queryType: 'list', resultCount: count || 0 },
      };
    },
  },
  {
    // Registration status breakdown
    patterns: [
      /registration.*status/i,
      /status.*breakdown/i,
      /(?:confirmed|pending|cancelled).*guests?/i,
    ],
    handler: async (_match, supabase) => {
      const { data, error } = await supabase
        .from('guests')
        .select('registration_status')
        .is('deleted_at', null);

      if (error) throw error;

      const counts = {
        confirmed: 0,
        pending: 0,
        cancelled: 0,
        waitlisted: 0,
      };

      (data || []).forEach(g => {
        const status = g.registration_status as keyof typeof counts;
        if (status in counts) counts[status]++;
      });

      const total = Object.values(counts).reduce((a, b) => a + b, 0);

      return {
        message: `**Registration Status Summary**\n\nTotal: ${total} guests\n\n` +
          `- **Confirmed:** ${counts.confirmed} (${total > 0 ? Math.round(counts.confirmed / total * 100) : 0}%)\n` +
          `- **Pending:** ${counts.pending} (${total > 0 ? Math.round(counts.pending / total * 100) : 0}%)\n` +
          `- **Cancelled:** ${counts.cancelled} (${total > 0 ? Math.round(counts.cancelled / total * 100) : 0}%)\n` +
          `- **Waitlisted:** ${counts.waitlisted} (${total > 0 ? Math.round(counts.waitlisted / total * 100) : 0}%)`,
        metadata: { queryType: 'stats', resultCount: total },
      };
    },
  },
  {
    // Search for specific guest
    patterns: [
      /find\s+(?:guest\s+)?(.+)/i,
      /search\s+(?:for\s+)?(?:guest\s+)?(.+)/i,
      /who\s+is\s+(.+)/i,
      /show\s+(?:me\s+)?(.+?)(?:'s)?\s+(?:info|details|information)/i,
    ],
    handler: async (match, supabase) => {
      const searchTerm = match[1]?.trim();
      if (!searchTerm || searchTerm.length < 2) {
        return {
          message: 'Please provide a name to search for.',
          metadata: { queryType: 'search', resultCount: 0 },
        };
      }

      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .is('deleted_at', null)
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(10);

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          message: `No guests found matching "${searchTerm}". Try a different spelling or search term.`,
          metadata: { queryType: 'search', resultCount: 0 },
        };
      }

      if (data.length === 1) {
        const g = data[0];
        return {
          message: `**${g.first_name} ${g.last_name}**\n\n` +
            `- **Email:** ${g.email}\n` +
            `- **Status:** ${g.registration_status || 'Unknown'}\n` +
            `- **Department:** ${g.reporting_level_1 || 'N/A'}\n` +
            `- **Arrival:** ${g.arrival_date || 'N/A'}${g.arrival_time ? ` at ${g.arrival_time}` : ''}${g.arrival_flight_number ? ` (${g.arrival_flight_number})` : ''}\n` +
            `- **Departure:** ${g.departure_date || 'N/A'}${g.departure_time ? ` at ${g.departure_time}` : ''}${g.departure_flight_number ? ` (${g.departure_flight_number})` : ''}\n` +
            `- **Hotel:** ${g.hotel_checkin_date ? `${g.hotel_checkin_date} to ${g.hotel_checkout_date}` : 'N/A'}\n` +
            `- **Transfer needed:** ${g.needs_arrival_transfer ? 'Arrival ' : ''}${g.needs_departure_transfer ? 'Departure' : ''}${!g.needs_arrival_transfer && !g.needs_departure_transfer ? 'No' : ''}`,
          metadata: { queryType: 'search', resultCount: 1 },
        };
      }

      const guestList = data.map((g, i) =>
        `${i + 1}. **${g.first_name} ${g.last_name}** (${g.email}) - ${g.registration_status || 'Unknown status'}`
      ).join('\n');

      return {
        message: `Found **${data.length} guests** matching "${searchTerm}":\n\n${guestList}\n\n_Ask me about a specific guest for more details._`,
        metadata: { queryType: 'search', resultCount: data.length },
      };
    },
  },
  {
    // Vehicles list
    patterns: [
      /(?:list|show|all).*vehicles?/i,
      /what vehicles?.*(?:available|have)/i,
      /vehicle.*(?:list|info)/i,
    ],
    handler: async (_match, supabase) => {
      const { data, count, error } = await supabase
        .from('vehicles')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          message: 'No active vehicles in the system.',
          metadata: { queryType: 'list', resultCount: 0 },
        };
      }

      const vehicleList = data.map((v, i) =>
        `${i + 1}. **${v.name}** (${v.type}) - Capacity: ${v.capacity}${v.driver_name ? ` | Driver: ${v.driver_name}` : ''}`
      ).join('\n');

      return {
        message: `**${count} Active Vehicle${count !== 1 ? 's' : ''}**\n\n${vehicleList}`,
        metadata: { queryType: 'list', resultCount: count || 0 },
      };
    },
  },
  {
    // Department/team breakdown
    patterns: [
      /(?:guests?|breakdown|list).*(?:by\s+)?(?:department|team|reporting)/i,
      /department.*(?:breakdown|summary)/i,
    ],
    handler: async (_match, supabase) => {
      const { data, error } = await supabase
        .from('guests')
        .select('reporting_level_1')
        .is('deleted_at', null);

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach(g => {
        const dept = g.reporting_level_1 || 'Unassigned';
        counts[dept] = (counts[dept] || 0) + 1;
      });

      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const total = sorted.reduce((sum, [, count]) => sum + count, 0);

      const breakdown = sorted.map(([dept, count], i) =>
        `${i + 1}. **${dept}:** ${count} (${Math.round(count / total * 100)}%)`
      ).join('\n');

      return {
        message: `**Guests by Department**\n\nTotal: ${total}\n\n${breakdown}`,
        metadata: { queryType: 'stats', resultCount: total },
      };
    },
  },
];

export class ChatbotService {
  private supabase: SupabaseClient;
  private useAI: boolean;
  private useMcpTools: boolean;

  constructor(config: ChatbotServiceConfig) {
    this.supabase = config.supabase;
    // Enable AI if configured and not explicitly disabled
    this.useAI = config.useAI !== false && isOpenRouterConfigured();
    // Use MCP-style tools by default when available (recommended approach)
    this.useMcpTools = config.useMcpTools !== false && isMcpToolsConfigured();
  }

  async processMessage(userMessage: string, conversationHistory: ChatMessage[] = []): Promise<ChatbotResponse> {
    // Normalize the message
    const normalizedMessage = userMessage.trim().toLowerCase();

    // Check for simple greetings - use AI for more natural responses if available
    if (/^(hi|hello|hey|good\s+(morning|afternoon|evening)|greetings|what can you do|help)$/i.test(normalizedMessage)) {
      if (this.useMcpTools) {
        try {
          const response = await handleGreeting(userMessage);
          return { message: response };
        } catch (error) {
          console.error('MCP greeting error:', error);
          return { message: QUICK_RESPONSES.greeting };
        }
      } else if (this.useAI) {
        try {
          const response = await handleConversation(userMessage);
          return { message: response };
        } catch (error) {
          console.error('AI greeting error:', error);
          return { message: QUICK_RESPONSES.greeting };
        }
      }
      return { message: QUICK_RESPONSES.greeting };
    }

    // Use MCP-style tool calling (recommended approach)
    if (this.useMcpTools) {
      try {
        return await this.processWithMcpTools(userMessage, conversationHistory);
      } catch (error) {
        console.error('MCP tools error:', error);
        // Fall back to SQL generation if MCP tools fail
      }
    }

    // Fall back to SQL generation approach
    if (this.useAI) {
      try {
        return await this.processWithAI(userMessage, conversationHistory);
      } catch (error) {
        console.error('AI processing error:', error);
        // Fall back to pattern matching if AI fails
      }
    }

    // Try pattern-based handlers (fallback or when AI is disabled)
    for (const { patterns, handler } of PATTERN_HANDLERS) {
      for (const pattern of patterns) {
        const match = userMessage.match(pattern);
        if (match) {
          try {
            return await handler(match, this.supabase);
          } catch (error) {
            console.error('Pattern handler error:', error);
            break;
          }
        }
      }
    }

    // Fallback response when no pattern matches
    return {
      message: "I'm not sure how to answer that question. Here are some things you can ask me:\n\n" +
        "- **Guest counts:** \"How many guests total?\"\n" +
        "- **Arrivals/Departures:** \"Who's arriving today?\" or \"Tomorrow's departures\"\n" +
        "- **Find guests:** \"Find John Smith\" or \"Search for engineering\"\n" +
        "- **Transfers:** \"Who needs airport transfer?\"\n" +
        "- **Status:** \"Registration status breakdown\"\n" +
        "- **Vehicles:** \"List all vehicles\"\n" +
        "- **Departments:** \"Guests by department\"",
    };
  }

  /**
   * Process message using MCP-style tool calling
   * This is the recommended approach - the LLM decides which tools to call
   */
  private async processWithMcpTools(userMessage: string, _history: ChatMessage[]): Promise<ChatbotResponse> {
    console.log('[MCP Tools] Processing message:', userMessage);

    const { response, toolsUsed } = await processWithTools(userMessage, this.supabase);

    console.log('[MCP Tools] Tools used:', toolsUsed);
    console.log('[MCP Tools] Response:', response.substring(0, 200) + '...');

    return {
      message: response,
      metadata: {
        queryType: toolsUsed.length > 0 ? 'tool_call' : 'conversation',
        toolsUsed,
      },
    };
  }

  private async processWithAI(userMessage: string, _history: ChatMessage[]): Promise<ChatbotResponse> {
    // Step 1: Use AI to generate a SQL query from the user's natural language
    const queryResult = await generateQuery(userMessage);
    console.log('AI Generated Query:', queryResult.query);
    console.log('Query Explanation:', queryResult.explanation);

    // If no query was generated (e.g., conversational question), use AI for conversation
    if (!queryResult.query) {
      const conversationResponse = await handleConversation(userMessage);
      return { message: conversationResponse };
    }

    // Step 2: Validate the generated query for safety
    const validation = validateQuery(queryResult.query);
    if (!validation.isValid) {
      console.error('Generated query failed validation:', queryResult.query);
      // Fall back to conversation mode
      const conversationResponse = await handleConversation(userMessage);
      return { message: conversationResponse };
    }

    // Step 3: Execute the query against Supabase
    try {
      // Use raw SQL execution via Supabase
      const { data: results, error } = await this.supabase.rpc('execute_readonly_query', {
        query_text: validation.sanitizedQuery || queryResult.query,
      });

      if (error) {
        console.error('Query execution error:', error);

        // Try direct query if RPC not available
        // This uses Supabase's from() for simple queries
        if (queryResult.query.toLowerCase().includes('count(*)')) {
          // Handle count queries
          const tableMatch = queryResult.query.match(/from\s+(\w+)/i);
          if (tableMatch) {
            const tableName = tableMatch[1];
            const { count, error: countError } = await this.supabase
              .from(tableName)
              .select('*', { count: 'exact', head: true });

            if (!countError && count !== null) {
              const response = await generateResponse(
                userMessage,
                [{ count }],
                queryResult.explanation
              );
              return {
                message: response.response,
                metadata: {
                  queryType: 'count' as QueryType,
                  executedQuery: queryResult.query,
                  resultCount: count,
                },
              };
            }
          }
        }

        // If query execution fails, provide a helpful response
        const conversationResponse = await handleConversation(
          `I tried to answer "${userMessage}" but couldn't execute the database query. Please suggest alternative ways to ask this question.`
        );
        return {
          message: conversationResponse,
          metadata: { error: error.message },
        };
      }

      // Step 4: Use AI to generate a natural language response from the results
      const response = await generateResponse(
        userMessage,
        results,
        queryResult.explanation
      );

      return {
        message: response.response,
        metadata: {
          queryType: this.inferQueryType(queryResult.query),
          executedQuery: queryResult.query,
          resultCount: Array.isArray(results) ? results.length : 1,
        },
      };
    } catch (err) {
      console.error('Query execution error:', err);

      // Fallback to pattern-based response
      const conversationResponse = await handleConversation(userMessage);
      return {
        message: conversationResponse,
        metadata: { error: err instanceof Error ? err.message : 'Unknown error' },
      };
    }
  }

  private inferQueryType(query: string): QueryType {
    const queryLower = query.toLowerCase();
    if (queryLower.includes('count(')) return 'count';
    if (queryLower.includes('group by')) return 'stats';
    if (queryLower.includes('where') && (queryLower.includes('ilike') || queryLower.includes('like'))) return 'search';
    return 'list';
  }

  private formatQueryResults(results: unknown[], query: string): ChatbotResponse {
    if (!results || results.length === 0) {
      return {
        message: QUICK_RESPONSES.noResults,
        metadata: { queryType: 'unknown', executedQuery: query, resultCount: 0 },
      };
    }

    // Simple formatting - could be enhanced
    if (results.length === 1 && typeof results[0] === 'object') {
      const row = results[0] as Record<string, unknown>;
      if ('count' in row) {
        return {
          message: `The count is **${row.count}**.`,
          metadata: { queryType: 'count', resultCount: Number(row.count) },
        };
      }
    }

    // Format as a list
    const formatted = results.slice(0, 20).map((row, i) => {
      const r = row as Record<string, unknown>;
      const name = r.first_name && r.last_name
        ? `${r.first_name} ${r.last_name}`
        : r.name || r.email || `Item ${i + 1}`;
      return `${i + 1}. **${name}**`;
    }).join('\n');

    const moreText = results.length > 20 ? `\n\n_...and ${results.length - 20} more_` : '';

    return {
      message: `Found **${results.length} results**:\n\n${formatted}${moreText}`,
      metadata: { queryType: 'list', resultCount: results.length },
    };
  }
}

// Export a factory function
export function createChatbotService(supabase: SupabaseClient): ChatbotService {
  return new ChatbotService({ supabase });
}
