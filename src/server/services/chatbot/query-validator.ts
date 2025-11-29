// SQL Query Validator for security
import { ALLOWED_TABLES, TABLE_COLUMNS, type AllowedTable } from './types';

// Dangerous SQL keywords that should never be allowed
// Note: We check these as whole words only (using word boundaries)
// to avoid false positives with column names like 'deleted_at'
const DANGEROUS_KEYWORDS = [
  'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'TRUNCATE',
  'CREATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'XP_',
  'SP_', 'SHUTDOWN', 'WAITFOR'
];

// Characters/sequences that indicate multiple statements or comments
const DANGEROUS_CHARS = ['--', '/*', '*/'];

// Dangerous patterns
const DANGEROUS_PATTERNS = [
  /;.*$/i,                    // Multiple statements
  /--.*$/m,                   // SQL comments
  /\/\*[\s\S]*?\*\//g,        // Block comments
  /union\s+all/i,             // UNION attacks
  /union\s+select/i,          // UNION SELECT
  /into\s+outfile/i,          // File operations
  /into\s+dumpfile/i,         // File operations
  /load_file/i,               // File reading
  /benchmark\s*\(/i,          // Timing attacks
  /sleep\s*\(/i,              // Timing attacks
  /pg_sleep/i,                // PostgreSQL sleep
  /information_schema/i,      // Schema inspection
  /pg_catalog/i,              // PostgreSQL catalog
];

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedQuery?: string;
}

export function validateQuery(query: string): ValidationResult {
  const errors: string[] = [];
  const upperQuery = query.toUpperCase().trim();

  // Check if it's a SELECT query only
  if (!upperQuery.startsWith('SELECT')) {
    errors.push('Only SELECT queries are allowed');
    return { isValid: false, errors };
  }

  // Check for dangerous keywords using word boundary matching
  // First, normalize the query by replacing safe column names with placeholders
  const normalizedQuery = upperQuery
    .replace(/DELETED_AT/g, 'COL_PLACEHOLDER')
    .replace(/IS_DELETED/g, 'COL_PLACEHOLDER')
    .replace(/IS_REMOVED/g, 'COL_PLACEHOLDER')
    .replace(/CREATED_AT/g, 'COL_PLACEHOLDER')
    .replace(/UPDATED_AT/g, 'COL_PLACEHOLDER');

  for (const keyword of DANGEROUS_KEYWORDS) {
    // Use word boundary regex to avoid matching substrings
    const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (keywordRegex.test(normalizedQuery)) {
      errors.push(`Dangerous keyword detected: ${keyword}`);
    }
  }

  // Check for dangerous characters (comments, etc.)
  for (const char of DANGEROUS_CHARS) {
    if (query.includes(char)) {
      errors.push(`Dangerous character sequence detected: ${char}`);
    }
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(query)) {
      errors.push('Dangerous pattern detected in query');
      break;
    }
  }

  // Validate tables used in query
  const tableMatches = query.match(/FROM\s+(\w+)/gi) || [];
  const joinMatches = query.match(/JOIN\s+(\w+)/gi) || [];

  const allTableRefs = [...tableMatches, ...joinMatches];
  for (const tableRef of allTableRefs) {
    const tableName = tableRef.replace(/^(FROM|JOIN)\s+/i, '').toLowerCase();
    if (!ALLOWED_TABLES.includes(tableName as AllowedTable)) {
      errors.push(`Table not allowed: ${tableName}`);
    }
  }

  // Validate columns
  const selectMatch = query.match(/SELECT\s+([\s\S]+?)\s+FROM/i);
  if (selectMatch) {
    const selectClause = selectMatch[1];
    // Allow * for simplicity, but we could be more restrictive
    if (selectClause.trim() !== '*') {
      const columns = selectClause.split(',').map(c => c.trim());
      // Extract just the column names (ignore aliases and table prefixes)
      for (const col of columns) {
        const colName = col
          .replace(/\s+AS\s+\w+/i, '')  // Remove AS alias
          .replace(/^\w+\./, '')         // Remove table prefix
          .replace(/COUNT\s*\(\s*\*?\s*\)/i, 'count')  // Handle COUNT(*)
          .replace(/SUM\s*\(\s*\w+\s*\)/i, 'sum')      // Handle SUM()
          .replace(/AVG\s*\(\s*\w+\s*\)/i, 'avg')      // Handle AVG()
          .replace(/MAX\s*\(\s*\w+\s*\)/i, 'max')      // Handle MAX()
          .replace(/MIN\s*\(\s*\w+\s*\)/i, 'min')      // Handle MIN()
          .toLowerCase()
          .trim();

        // Skip aggregate functions and expressions
        if (['count', 'sum', 'avg', 'max', 'min', '*'].includes(colName)) continue;

        // Check if column exists in any allowed table
        const isValidColumn = Object.values(TABLE_COLUMNS).some(cols =>
          cols.includes(colName)
        );

        if (!isValidColumn && colName.length > 0 && !colName.includes('(')) {
          errors.push(`Column not allowed: ${colName}`);
        }
      }
    }
  }

  // Limit results for safety
  let sanitizedQuery = query;
  if (!query.toLowerCase().includes('limit')) {
    sanitizedQuery = `${query.trim()} LIMIT 100`;
  } else {
    // Ensure limit is not too high
    const limitMatch = query.match(/LIMIT\s+(\d+)/i);
    if (limitMatch && parseInt(limitMatch[1]) > 1000) {
      sanitizedQuery = query.replace(/LIMIT\s+\d+/i, 'LIMIT 1000');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedQuery: errors.length === 0 ? sanitizedQuery : undefined
  };
}

// Build a safe query from structured parameters
export function buildSafeQuery(params: {
  table: AllowedTable;
  columns?: string[];
  where?: Record<string, unknown>;
  orderBy?: { column: string; direction: 'ASC' | 'DESC' };
  limit?: number;
}): { query: string; values: unknown[] } {
  const { table, columns = ['*'], where = {}, orderBy, limit = 100 } = params;
  const values: unknown[] = [];

  // Validate table
  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error(`Invalid table: ${table}`);
  }

  // Validate columns
  const validColumns = columns.filter(col =>
    col === '*' || TABLE_COLUMNS[table]?.includes(col)
  );

  let query = `SELECT ${validColumns.join(', ')} FROM ${table}`;

  // Build WHERE clause
  const whereClauses: string[] = [];
  Object.entries(where).forEach(([key, value], index) => {
    if (TABLE_COLUMNS[table]?.includes(key)) {
      whereClauses.push(`${key} = $${index + 1}`);
      values.push(value);
    }
  });

  if (whereClauses.length > 0) {
    query += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  // Add ORDER BY if valid
  if (orderBy && TABLE_COLUMNS[table]?.includes(orderBy.column)) {
    query += ` ORDER BY ${orderBy.column} ${orderBy.direction}`;
  }

  // Add LIMIT
  query += ` LIMIT ${Math.min(limit, 1000)}`;

  return { query, values };
}
