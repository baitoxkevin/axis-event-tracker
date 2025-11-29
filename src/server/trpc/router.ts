import { router } from './init';
import { guestsRouter } from './routers/guests';
import { transportRouter } from './routers/transport';
import { auditRouter } from './routers/audit';
import { importRouter } from './routers/import';
import { flightsRouter } from './routers/flights';
import { chatbotRouter } from './routers/chatbot';

export const appRouter = router({
  guests: guestsRouter,
  transport: transportRouter,
  audit: auditRouter,
  import: importRouter,
  flights: flightsRouter,
  chatbot: chatbotRouter,
});

export type AppRouter = typeof appRouter;
