import * as XLSX from 'xlsx';

export interface ParsedExcel {
  columns: string[];
  data: Record<string, unknown>[];
  sheetName: string;
}

export interface ValidationIssue {
  row: number;
  field: string;
  value: unknown;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  stats: {
    totalRows: number;
    invalidEmails: number;
    missingRequired: number;
    duplicateEmails: number;
  };
}

// Cell-level validation for comprehensive data quality checks
export interface CellIssue {
  row: number;
  column: string;
  value: unknown;
  expectedType: string;
  actualType: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface CellValidationResult {
  totalCells: number;
  issueCount: number;
  issues: CellIssue[];
  columnStats: Record<string, {
    totalValues: number;
    nullCount: number;
    typeDistribution: Record<string, number>;
    suspiciousValues: number;
  }>;
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate email format
 */
export function isValidEmail(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  const strValue = String(value).trim();
  return EMAIL_REGEX.test(strValue);
}

/**
 * Validate mapped data before import
 */
export function validateMappedData(
  data: Record<string, unknown>[],
  mapping: Record<string, string | null>
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const emailCounts = new Map<string, number[]>(); // email -> row numbers

  // Find which Excel column maps to email
  const emailColumn = Object.entries(mapping).find(([, field]) => field === 'email')?.[0];
  const firstNameColumn = Object.entries(mapping).find(([, field]) => field === 'firstName')?.[0];
  const lastNameColumn = Object.entries(mapping).find(([, field]) => field === 'lastName')?.[0];

  let invalidEmails = 0;
  let missingRequired = 0;

  data.forEach((row, index) => {
    const rowNum = index + 2; // +2 for header and 0-indexing

    // Check email
    if (emailColumn) {
      const email = row[emailColumn];
      if (!email || email === '') {
        issues.push({
          row: rowNum,
          field: 'Email',
          value: email,
          message: 'Email is missing',
          severity: 'error',
        });
        missingRequired++;
      } else if (!isValidEmail(email)) {
        issues.push({
          row: rowNum,
          field: 'Email',
          value: email,
          message: `Invalid email format: "${email}" - looks like a ${detectValueType(email)}`,
          severity: 'error',
        });
        invalidEmails++;
      } else {
        // Track for duplicates
        const emailLower = String(email).toLowerCase().trim();
        const existing = emailCounts.get(emailLower) || [];
        existing.push(rowNum);
        emailCounts.set(emailLower, existing);
      }
    }

    // Check first name
    if (firstNameColumn) {
      const firstName = row[firstNameColumn];
      if (!firstName || firstName === '') {
        issues.push({
          row: rowNum,
          field: 'First Name',
          value: firstName,
          message: 'First name is missing',
          severity: 'error',
        });
        missingRequired++;
      }
    }

    // Check last name
    if (lastNameColumn) {
      const lastName = row[lastNameColumn];
      if (!lastName || lastName === '') {
        issues.push({
          row: rowNum,
          field: 'Last Name',
          value: lastName,
          message: 'Last name is missing',
          severity: 'error',
        });
        missingRequired++;
      }
    }
  });

  // Check for duplicate emails
  let duplicateEmails = 0;
  emailCounts.forEach((rows, email) => {
    if (rows.length > 1) {
      duplicateEmails++;
      issues.push({
        row: rows[0],
        field: 'Email',
        value: email,
        message: `Duplicate email found in rows: ${rows.join(', ')}`,
        severity: 'warning',
      });
    }
  });

  return {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    stats: {
      totalRows: data.length,
      invalidEmails,
      missingRequired,
      duplicateEmails,
    },
  };
}

/**
 * Detect what type of value was incorrectly placed in a field
 */
function detectValueType(value: unknown): string {
  const strValue = String(value).trim();

  // Check if it looks like a date/time
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(strValue)) return 'date';
  if (/^\d{1,2}:\d{2}/.test(strValue)) return 'time';
  if (/^\d{4}-\d{2}-\d{2}/.test(strValue)) return 'date';

  // Check if it's a number
  if (/^\d+$/.test(strValue)) return 'number';
  if (/^\d+\.\d+$/.test(strValue)) return 'decimal number';

  // Check if it looks like a phone number
  if (/^[\d\s\-\+\(\)]+$/.test(strValue) && strValue.length >= 7) return 'phone number';

  return 'invalid value';
}

/**
 * Detect the data type of a cell value
 */
function detectCellType(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'empty';

  const strValue = String(value).trim();

  // Check for email
  if (EMAIL_REGEX.test(strValue)) return 'email';

  // Check for date formats
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}(\s+\d{1,2}:\d{2}(:\d{2})?)?$/.test(strValue)) return 'date';
  if (/^\d{4}-\d{2}-\d{2}/.test(strValue)) return 'date';
  if (/^\d{1,2}\/[A-Za-z]{3}\/\d{4}$/.test(strValue)) return 'date'; // 18/Jan/2026
  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(strValue)) return 'date'; // 1/18/26

  // Check for time
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(strValue)) return 'time';
  if (/^-?\d{1,2}:\d{2}$/.test(strValue)) return 'time'; // negative time like -0:10

  // Check for number
  if (/^-?\d+$/.test(strValue)) return 'number';
  if (/^-?\d+\.\d+$/.test(strValue)) return 'decimal';

  // Check for boolean-like values
  if (['yes', 'no', 'true', 'false', 'y', 'n', '0', '1'].includes(strValue.toLowerCase())) return 'boolean';

  // Check for null-like values
  if (['null', 'n/a', 'na', 'none', '-'].includes(strValue.toLowerCase())) return 'null';

  // Default to text
  return 'text';
}

/**
 * Infer expected column type from column name
 */
function inferColumnType(columnName: string): string | null {
  const lowerName = columnName.toLowerCase();

  // Email columns
  if (lowerName.includes('email') || lowerName.includes('e-mail')) return 'email';

  // Date columns
  if (lowerName.includes('date') || lowerName.includes('check-in') || lowerName.includes('check-out') ||
      lowerName.includes('checkin') || lowerName.includes('checkout') || lowerName.includes('arrival') ||
      lowerName.includes('departure') || lowerName.includes('start') || lowerName.includes('completion') ||
      lowerName.includes('when')) return 'date';

  // Time columns
  if (lowerName.includes('time') && !lowerName.includes('date')) return 'time';

  // Name columns (should be text)
  if (lowerName.includes('name') || lowerName.includes('first') || lowerName.includes('last')) return 'text';

  // Number columns
  if (lowerName.includes('id') && !lowerName.includes('email')) return 'number';
  if (lowerName.includes('count') || lowerName.includes('number') || lowerName.includes('qty')) return 'number';

  return null; // Can't infer
}

/**
 * Validate ALL cells in the Excel data for data type issues
 */
export function validateAllCells(
  data: Record<string, unknown>[],
  columns: string[]
): CellValidationResult {
  const issues: CellIssue[] = [];
  const columnStats: CellValidationResult['columnStats'] = {};
  let totalCells = 0;

  // Initialize column stats
  columns.forEach(col => {
    columnStats[col] = {
      totalValues: 0,
      nullCount: 0,
      typeDistribution: {},
      suspiciousValues: 0
    };
  });

  // Analyze each cell
  data.forEach((row, rowIndex) => {
    const rowNum = rowIndex + 2; // +2 for header and 0-indexing

    columns.forEach(column => {
      totalCells++;
      const value = row[column];
      const cellType = detectCellType(value);
      const expectedType = inferColumnType(column);
      const stats = columnStats[column];

      stats.totalValues++;

      if (cellType === 'empty') {
        stats.nullCount++;
      }

      // Track type distribution
      stats.typeDistribution[cellType] = (stats.typeDistribution[cellType] || 0) + 1;

      // Check for suspicious values
      if (expectedType && cellType !== 'empty' && cellType !== expectedType) {
        // Special cases that are OK
        const isOk =
          (expectedType === 'text' && ['text', 'email', 'number'].includes(cellType)) ||
          (expectedType === 'date' && cellType === 'text') || // Dates can be text
          (expectedType === 'time' && cellType === 'text') ||
          (expectedType === 'number' && cellType === 'text') ||
          (cellType === 'null'); // null values are OK anywhere

        if (!isOk) {
          stats.suspiciousValues++;

          // High-priority issues
          if (expectedType === 'email' && cellType !== 'email' && cellType !== 'empty') {
            issues.push({
              row: rowNum,
              column,
              value,
              expectedType: 'email',
              actualType: cellType,
              message: `Expected email but found ${cellType}: "${value}"`,
              severity: 'error'
            });
          } else if (expectedType === 'text' && cellType === 'date') {
            // Date in a text field (like name) - warning
            issues.push({
              row: rowNum,
              column,
              value,
              expectedType: 'text',
              actualType: cellType,
              message: `Unexpected date in text column: "${value}"`,
              severity: 'warning'
            });
          } else if (expectedType === 'date' && cellType === 'email') {
            // Email in a date field - error
            issues.push({
              row: rowNum,
              column,
              value,
              expectedType: 'date',
              actualType: cellType,
              message: `Expected date but found email: "${value}"`,
              severity: 'error'
            });
          } else if (expectedType === 'number' && cellType === 'email') {
            // Email in a number field
            issues.push({
              row: rowNum,
              column,
              value,
              expectedType: 'number',
              actualType: cellType,
              message: `Expected number but found email: "${value}"`,
              severity: 'error'
            });
          } else {
            // General mismatch - info level
            issues.push({
              row: rowNum,
              column,
              value,
              expectedType,
              actualType: cellType,
              message: `Possible data type mismatch: expected ${expectedType}, found ${cellType}`,
              severity: 'info'
            });
          }
        }
      }
    });
  });

  // Check for columns with mixed types (data quality warning)
  Object.entries(columnStats).forEach(([column, stats]) => {
    const types = Object.entries(stats.typeDistribution)
      .filter(([type]) => type !== 'empty' && type !== 'null')
      .sort((a, b) => b[1] - a[1]);

    if (types.length > 2) {
      // More than 2 non-empty types in a column - might indicate data issues
      const typesList = types.map(([t, count]) => `${t}(${count})`).join(', ');
      issues.push({
        row: 0, // Column-level issue
        column,
        value: null,
        expectedType: 'consistent',
        actualType: 'mixed',
        message: `Column has mixed data types: ${typesList}`,
        severity: 'info'
      });
    }
  });

  // Sort issues: errors first, then warnings, then info; by row number
  issues.sort((a, b) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return a.row - b.row;
  });

  return {
    totalCells,
    issueCount: issues.length,
    issues: issues.slice(0, 50), // Limit to first 50 issues
    columnStats
  };
}

export function parseExcelFile(file: File): Promise<ParsedExcel> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: null,
          raw: false,
        });

        if (jsonData.length === 0) {
          reject(new Error('No data found in Excel file'));
          return;
        }

        // Get column headers
        const columns = Object.keys(jsonData[0]);

        resolve({
          columns,
          data: jsonData,
          sheetName,
        });
      } catch (error) {
        reject(new Error('Failed to parse Excel file: ' + String(error)));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

export function transformBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') return null;

  const strValue = String(value).toLowerCase().trim();

  if (['yes', 'true', '1', 'y'].includes(strValue)) return true;
  if (['no', 'false', '0', 'n'].includes(strValue)) return false;

  return null;
}

export function transformDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  // If it's already a Date object
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }

  // Try to parse string date
  const strValue = String(value).trim();

  // Try ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(strValue)) {
    return strValue.split('T')[0];
  }

  // Try DD/MM/YYYY format
  const dmyMatch = strValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try MM/DD/YYYY format
  const mdyMatch = strValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
}

export function transformTime(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  const strValue = String(value).trim();

  // Match HH:MM or HH:MM:SS format
  const timeMatch = strValue.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    const [, hours, minutes] = timeMatch;
    return `${hours.padStart(2, '0')}:${minutes}`;
  }

  return null;
}

export function applyColumnMapping(
  data: Record<string, unknown>[],
  mapping: Record<string, string | null>
): Record<string, unknown>[] {
  return data.map((row) => {
    const mappedRow: Record<string, unknown> = {};

    for (const [excelCol, guestField] of Object.entries(mapping)) {
      if (guestField && row[excelCol] !== undefined) {
        let value = row[excelCol];

        // Apply transformations based on field type
        if (guestField.includes('Date')) {
          value = transformDate(value);
        } else if (guestField.includes('Time')) {
          value = transformTime(value);
        } else if (
          guestField.startsWith('needs') ||
          guestField.startsWith('extend') ||
          guestField === 'isDuplicate' ||
          guestField === 'isRemoved'
        ) {
          value = transformBoolean(value);
        } else if (typeof value === 'string') {
          value = value.trim();
        }

        mappedRow[guestField] = value;
      }
    }

    return mappedRow;
  });
}
