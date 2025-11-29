/**
 * OpenRouter AI Service for Grok 4.1-fast
 * Provides natural language understanding and SQL query generation
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'x-ai/grok-4.1-fast';

// Database schema context for the AI
const DATABASE_SCHEMA = `
You are an AI assistant for the Axis Event Tracker system. You help users query event and guest data.

DATABASE SCHEMA:

1. guests - Main guest information table
   Columns:
   - id (uuid, primary key)
   - email (varchar, unique)
   - first_name (varchar)
   - last_name (varchar)
   - axis_email (varchar, nullable)
   - reporting_level_1, reporting_level_2, reporting_level_3 (varchar, organization hierarchy)
   - function (varchar, job function/department)
   - location (varchar, office location)
   - arrival_date (date), arrival_time (time)
   - arrival_flight_number (varchar), arrival_airport (varchar)
   - arrival_flight_status (enum: 'scheduled', 'active', 'landed', 'cancelled', 'diverted', 'unknown')
   - departure_date (date), departure_time (time)
   - departure_flight_number (varchar), departure_airport (varchar)
   - departure_flight_status (enum: same as arrival)
   - hotel_checkin_date (date), hotel_checkout_date (date)
   - needs_arrival_transfer (boolean) - true if guest needs pickup from airport
   - needs_departure_transfer (boolean) - true if guest needs dropoff to airport
   - registration_status (enum: 'pending', 'confirmed', 'cancelled', 'waitlisted')
   - travel_type (varchar)
   - is_duplicate (boolean), is_removed (boolean)
   - created_at, updated_at, deleted_at (timestamps)

2. vehicles - Transport vehicles
   Columns:
   - id (uuid, primary key)
   - name (varchar)
   - type (varchar, e.g., 'van', 'bus', 'sedan')
   - capacity (integer)
   - driver_name, driver_phone (varchar)
   - license_plate (varchar)
   - is_active (boolean)

3. transport_schedules - Scheduled transport trips
   Columns:
   - id (uuid, primary key)
   - vehicle_id (uuid, references vehicles)
   - direction (enum: 'arrival', 'departure')
   - schedule_date (date)
   - pickup_time (time)
   - pickup_location, dropoff_location (varchar)
   - status (enum: 'scheduled', 'in_progress', 'completed', 'cancelled')
   - notes (text)

4. guest_transport_assignments - Links guests to transport schedules
   Columns:
   - id (uuid, primary key)
   - guest_id (uuid, references guests)
   - schedule_id (uuid, references transport_schedules)
   - assignment_type (enum: 'arrival', 'departure')
   - status (enum: 'assigned', 'completed', 'no_show')

IMPORTANT RULES:
1. ONLY generate SELECT queries - never INSERT, UPDATE, DELETE, DROP, or any modifying statements
2. Use PostgreSQL syntax
3. Always use lowercase column names with underscores (e.g., first_name, not firstName)
4. For date comparisons, use CURRENT_DATE for today, CURRENT_DATE + 1 for tomorrow
5. When counting guests needing transport, check needs_arrival_transfer OR needs_departure_transfer
6. Exclude removed guests: WHERE is_removed = false OR is_removed IS NULL
7. For name searches, use ILIKE for case-insensitive matching
8. Limit results to 50 rows max unless specifically asked for more
`;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
  };
}

interface QueryGenerationResult {
  query: string | null;
  explanation: string;
  isReadOnly: boolean;
}

interface ResponseGenerationResult {
  response: string;
}

/**
 * Call OpenRouter API with Grok 4.1-fast model
 */
async function callOpenRouter(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Axis Event Tracker',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.3, // Lower temperature for more consistent SQL generation
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as OpenRouterResponse;

  if (data.error) {
    throw new Error(`OpenRouter error: ${data.error.message}`);
  }

  return data.choices[0]?.message?.content || '';
}

/**
 * Generate a SQL query from natural language
 */
export async function generateQuery(userMessage: string): Promise<QueryGenerationResult> {
  const systemPrompt = `${DATABASE_SCHEMA}

Your task is to generate a PostgreSQL SELECT query based on the user's question.

RESPONSE FORMAT (JSON only, no markdown):
{
  "query": "SELECT ... FROM ...",
  "explanation": "Brief explanation of what this query does",
  "isReadOnly": true
}

If the user's question cannot be answered with a database query, or is a greeting/general question, respond with:
{
  "query": null,
  "explanation": "This is a conversational question, not a data query",
  "isReadOnly": true
}

Remember: ONLY SELECT queries are allowed. If asked to modify data, set query to null.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  try {
    const response = await callOpenRouter(messages);

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        query: null,
        explanation: 'Could not parse AI response',
        isReadOnly: true,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as QueryGenerationResult;

    // Security: Validate the query is read-only
    if (parsed.query) {
      const queryUpper = parsed.query.toUpperCase().trim();
      const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'GRANT', 'REVOKE'];

      for (const keyword of dangerousKeywords) {
        if (queryUpper.startsWith(keyword) || queryUpper.includes(` ${keyword} `)) {
          return {
            query: null,
            explanation: 'Query rejected: Only SELECT queries are allowed',
            isReadOnly: false,
          };
        }
      }

      // Ensure it starts with SELECT
      if (!queryUpper.startsWith('SELECT')) {
        return {
          query: null,
          explanation: 'Query rejected: Must be a SELECT query',
          isReadOnly: false,
        };
      }
    }

    return parsed;
  } catch (error) {
    console.error('Error generating query:', error);
    return {
      query: null,
      explanation: error instanceof Error ? error.message : 'Unknown error',
      isReadOnly: true,
    };
  }
}

/**
 * Generate a natural language response from query results
 */
export async function generateResponse(
  userMessage: string,
  queryResults: unknown,
  queryExplanation: string
): Promise<ResponseGenerationResult> {
  const systemPrompt = `You are a helpful assistant for the Axis Event Tracker system.
You help transport managers and event staff understand guest and transport data.

Guidelines:
- Be concise and friendly
- Format numbers clearly (e.g., "339 guests" not "339")
- Use bullet points for lists
- Highlight important information with **bold**
- Include relevant dates when discussing arrivals/departures
- If the data is empty, explain it clearly (e.g., "No guests are arriving today")
- Don't mention SQL queries or technical details to the user
- Use natural language, not code

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

  const userPrompt = `User asked: "${userMessage}"

Query explanation: ${queryExplanation}

Query results (JSON):
${JSON.stringify(queryResults, null, 2)}

Please provide a helpful, natural language response to the user's question based on these results.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const response = await callOpenRouter(messages);
    return { response };
  } catch (error) {
    console.error('Error generating response:', error);
    return {
      response: 'I apologize, but I encountered an error processing your request. Please try again.',
    };
  }
}

/**
 * Handle conversational messages (greetings, help, etc.)
 */
export async function handleConversation(userMessage: string): Promise<string> {
  const systemPrompt = `You are a friendly AI assistant for the Axis Event Tracker system.
You help transport managers and event registration staff with:
- Finding guest information
- Checking arrival and departure schedules
- Transport and vehicle assignments
- Event statistics and summaries

If the user greets you or asks what you can do, explain your capabilities briefly.
If they ask a data question, encourage them to ask specifically.

Be concise, friendly, and professional. Use bullet points when listing capabilities.
Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  try {
    return await callOpenRouter(messages);
  } catch (error) {
    console.error('Error in conversation:', error);
    return "Hello! I'm your Axis Event Tracker assistant. I can help you with guest information, arrivals, departures, and transport assignments. What would you like to know?";
  }
}

/**
 * Check if OpenRouter is configured
 */
export function isOpenRouterConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}
