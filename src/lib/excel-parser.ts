import * as XLSX from 'xlsx';

export interface ParsedExcel {
  columns: string[];
  data: Record<string, unknown>[];
  sheetName: string;
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
