import { z } from 'zod';
import { router, protectedProcedure, crewOnlyProcedure } from '../init';
import { auditLogs, users, importSessions } from '@/server/db/schema';
import { eq, and, desc, gte, lte, count } from 'drizzle-orm';

const auditFilterSchema = z.object({
  entityType: z.enum(['guest', 'vehicle', 'transport_schedule', 'assignment']).optional(),
  entityId: z.string().uuid().optional(),
  action: z.enum(['create', 'update', 'delete', 'restore']).optional(),
  changeSource: z.enum(['import', 'manual', 'system']).optional(),
  performedBy: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(50),
});

export const auditRouter = router({
  // List audit logs with filters
  list: protectedProcedure
    .input(auditFilterSchema)
    .query(async ({ ctx, input }) => {
      const {
        entityType,
        entityId,
        action,
        changeSource,
        performedBy,
        dateFrom,
        dateTo,
        page,
        pageSize,
      } = input;

      // Build conditions based on user role
      const conditions = [];

      // Transport arrangers can only see transport-related logs
      if (ctx.user?.role === 'transport_arranger') {
        conditions.push(
          eq(auditLogs.entityType, 'transport_schedule')
        );
      }

      if (entityType) {
        conditions.push(eq(auditLogs.entityType, entityType));
      }
      if (entityId) {
        conditions.push(eq(auditLogs.entityId, entityId));
      }
      if (action) {
        conditions.push(eq(auditLogs.action, action));
      }
      if (changeSource) {
        conditions.push(eq(auditLogs.changeSource, changeSource));
      }
      if (performedBy) {
        conditions.push(eq(auditLogs.performedBy, performedBy));
      }
      if (dateFrom) {
        conditions.push(gte(auditLogs.performedAt, new Date(dateFrom)));
      }
      if (dateTo) {
        conditions.push(lte(auditLogs.performedAt, new Date(dateTo)));
      }

      // Get total count
      const [{ total }] = await ctx.db
        .select({ total: count() })
        .from(auditLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      // Get paginated results
      const offset = (page - 1) * pageSize;

      const results = await ctx.db.query.auditLogs.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        limit: pageSize,
        offset,
        orderBy: desc(auditLogs.performedAt),
        with: {
          performedByUser: true,
          importSession: true,
        },
      });

      return {
        data: results,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    }),

  // Get audit logs for specific entity
  getByEntity: protectedProcedure
    .input(
      z.object({
        entityType: z.enum(['guest', 'vehicle', 'transport_schedule', 'assignment']),
        entityId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.query.auditLogs.findMany({
        where: and(
          eq(auditLogs.entityType, input.entityType),
          eq(auditLogs.entityId, input.entityId)
        ),
        orderBy: desc(auditLogs.performedAt),
        with: {
          performedByUser: true,
          importSession: true,
        },
      });
    }),

  // Export audit logs (crew only)
  export: crewOnlyProcedure
    .input(auditFilterSchema.omit({ page: true, pageSize: true }))
    .query(async ({ ctx, input }) => {
      const {
        entityType,
        entityId,
        action,
        changeSource,
        performedBy,
        dateFrom,
        dateTo,
      } = input;

      const conditions = [];

      if (entityType) {
        conditions.push(eq(auditLogs.entityType, entityType));
      }
      if (entityId) {
        conditions.push(eq(auditLogs.entityId, entityId));
      }
      if (action) {
        conditions.push(eq(auditLogs.action, action));
      }
      if (changeSource) {
        conditions.push(eq(auditLogs.changeSource, changeSource));
      }
      if (performedBy) {
        conditions.push(eq(auditLogs.performedBy, performedBy));
      }
      if (dateFrom) {
        conditions.push(gte(auditLogs.performedAt, new Date(dateFrom)));
      }
      if (dateTo) {
        conditions.push(lte(auditLogs.performedAt, new Date(dateTo)));
      }

      return ctx.db.query.auditLogs.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: desc(auditLogs.performedAt),
        with: {
          performedByUser: true,
          importSession: true,
        },
      });
    }),

  // Get users for filter dropdown
  getUsers: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.users.findMany({
      columns: {
        id: true,
        name: true,
        email: true,
      },
    });
  }),
});
