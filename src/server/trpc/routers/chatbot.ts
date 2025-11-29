import { z } from 'zod';
import { router, protectedProcedure } from '../init';
import { createChatbotService } from '@/server/services/chatbot';
import { chatbotConversations, chatbotMessages } from '@/server/db/schema';
import { eq, desc } from 'drizzle-orm';

// Input schemas
const sendMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().optional(),
});

const getConversationSchema = z.object({
  sessionId: z.string(),
});

const clearHistorySchema = z.object({
  sessionId: z.string().optional(),
});

// Mock responses for demo mode
const DEMO_RESPONSES: Record<string, string> = {
  default: "Hello! I'm your Axis Event Tracker assistant. I can help you with:\n- Finding guest information\n- Checking arrival and departure schedules\n- Transport and vehicle assignments\n- Event statistics and summaries\n\nWhat would you like to know?",
  guests: "There are **42 guests** registered in the system.\n\n- **Confirmed:** 35 (83%)\n- **Pending:** 5 (12%)\n- **Cancelled:** 2 (5%)",
  arriving: "**3 guests arriving today** (November 27, 2025):\n\n1. **Sarah Johnson** - 14:30 (AA123)\n2. **Michael Chen** - 16:45 (UA456)\n3. **Emma Williams** - 18:20 (DL789)",
  transfer: "**8 guests need transfer**\n\n**Arrival transfers (5):**\n1. Sarah Johnson - Nov 27\n2. Michael Chen - Nov 27\n3. David Brown - Nov 28\n4. Lisa Anderson - Nov 28\n5. James Wilson - Nov 29\n\n**Departure transfers (3):**\n1. Emma Williams - Nov 30\n2. Robert Taylor - Dec 1\n3. Jennifer Davis - Dec 1",
  vehicles: "**3 Active Vehicles**\n\n1. **Mercedes Sprinter** (Van) - Capacity: 12 | Driver: John Driver\n2. **Toyota Hiace** (Van) - Capacity: 8 | Driver: Mike Smith\n3. **Lincoln Navigator** (SUV) - Capacity: 6 | Driver: Bob Johnson",
};

function getDemoResponse(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (/how many.*guests?|count.*guests?|total.*guests?/i.test(lowerMessage)) {
    return DEMO_RESPONSES.guests;
  }
  if (/arriv.*today|today.*arriv/i.test(lowerMessage)) {
    return DEMO_RESPONSES.arriving;
  }
  if (/transfer|pickup/i.test(lowerMessage)) {
    return DEMO_RESPONSES.transfer;
  }
  if (/vehicle/i.test(lowerMessage)) {
    return DEMO_RESPONSES.vehicles;
  }
  if (/^(hi|hello|hey|help)/i.test(lowerMessage)) {
    return DEMO_RESPONSES.default;
  }

  return "I can help you with guest information, arrivals, departures, transfers, and vehicle assignments. Try asking:\n- \"How many guests?\"\n- \"Who's arriving today?\"\n- \"Who needs transfer?\"\n- \"List all vehicles\"";
}

export const chatbotRouter = router({
  // Send a message and get a response
  sendMessage: protectedProcedure
    .input(sendMessageSchema)
    .mutation(async ({ ctx, input }) => {
      const { message, sessionId = `session-${Date.now()}` } = input;

      // Demo mode - return mock responses
      if (ctx.isDemoMode || !ctx.supabase) {
        const response = getDemoResponse(message);
        return {
          response,
          sessionId,
          metadata: {
            queryType: 'unknown' as const,
            isDemoMode: true,
          },
        };
      }

      try {
        // Create chatbot service
        const chatbot = createChatbotService(ctx.supabase);

        // Get conversation history if exists
        let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

        if (ctx.db) {
          // Try to find existing conversation
          const existingConversation = await ctx.db.query.chatbotConversations.findFirst({
            where: eq(chatbotConversations.sessionId, sessionId),
            with: {
              messages: {
                orderBy: desc(chatbotMessages.createdAt),
                limit: 10,
              },
            },
          });

          if (existingConversation?.messages) {
            conversationHistory = existingConversation.messages
              .reverse()
              .map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
              }));
          }
        }

        // Process the message
        const result = await chatbot.processMessage(message, conversationHistory);

        // Store conversation in database if available
        if (ctx.db) {
          try {
            // Get or create conversation
            let conversation = await ctx.db.query.chatbotConversations.findFirst({
              where: eq(chatbotConversations.sessionId, sessionId),
            });

            if (!conversation) {
              const [newConversation] = await ctx.db.insert(chatbotConversations).values({
                sessionId,
                userId: ctx.user?.id,
                title: message.slice(0, 100),
              }).returning();
              conversation = newConversation;
            }

            // Store user message
            await ctx.db.insert(chatbotMessages).values({
              conversationId: conversation.id,
              role: 'user',
              content: message,
            });

            // Store assistant response
            await ctx.db.insert(chatbotMessages).values({
              conversationId: conversation.id,
              role: 'assistant',
              content: result.message,
              metadata: result.metadata,
            });
          } catch (dbError) {
            console.error('Error storing conversation:', dbError);
            // Continue without storing - not critical
          }
        }

        return {
          response: result.message,
          sessionId,
          metadata: result.metadata,
        };
      } catch (error) {
        console.error('Chatbot error:', error);
        return {
          response: "I'm sorry, I encountered an error processing your request. Please try again.",
          sessionId,
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    }),

  // Get conversation history
  getConversation: protectedProcedure
    .input(getConversationSchema)
    .query(async ({ ctx, input }) => {
      // Demo mode
      if (ctx.isDemoMode || !ctx.db) {
        return {
          messages: [],
          sessionId: input.sessionId,
        };
      }

      const conversation = await ctx.db.query.chatbotConversations.findFirst({
        where: eq(chatbotConversations.sessionId, input.sessionId),
        with: {
          messages: {
            orderBy: desc(chatbotMessages.createdAt),
            limit: 50,
          },
        },
      });

      if (!conversation) {
        return {
          messages: [],
          sessionId: input.sessionId,
        };
      }

      return {
        messages: conversation.messages.reverse().map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
        sessionId: input.sessionId,
      };
    }),

  // Get all conversations for current user
  getConversations: protectedProcedure.query(async ({ ctx }) => {
    // Demo mode
    if (ctx.isDemoMode || !ctx.db) {
      return [];
    }

    const conversations = await ctx.db.query.chatbotConversations.findMany({
      where: ctx.user?.id ? eq(chatbotConversations.userId, ctx.user.id) : undefined,
      orderBy: desc(chatbotConversations.updatedAt),
      limit: 20,
    });

    return conversations.map(c => ({
      id: c.id,
      sessionId: c.sessionId,
      title: c.title || 'Untitled conversation',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }),

  // Clear conversation history
  clearHistory: protectedProcedure
    .input(clearHistorySchema)
    .mutation(async ({ ctx, input }) => {
      // Demo mode
      if (ctx.isDemoMode || !ctx.db) {
        return { success: true };
      }

      if (input.sessionId) {
        // Delete specific conversation
        const conversation = await ctx.db.query.chatbotConversations.findFirst({
          where: eq(chatbotConversations.sessionId, input.sessionId),
        });

        if (conversation) {
          await ctx.db.delete(chatbotMessages)
            .where(eq(chatbotMessages.conversationId, conversation.id));
          await ctx.db.delete(chatbotConversations)
            .where(eq(chatbotConversations.id, conversation.id));
        }
      } else if (ctx.user?.id) {
        // Delete all conversations for user
        const userConversations = await ctx.db.query.chatbotConversations.findMany({
          where: eq(chatbotConversations.userId, ctx.user.id),
        });

        for (const conv of userConversations) {
          await ctx.db.delete(chatbotMessages)
            .where(eq(chatbotMessages.conversationId, conv.id));
          await ctx.db.delete(chatbotConversations)
            .where(eq(chatbotConversations.id, conv.id));
        }
      }

      return { success: true };
    }),
});
