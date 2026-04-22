/**
 * Minimal RFC3164 / RFC5424 syslog parser.
 * Network gear (Unifi, etc.) typically sends RFC3164.
 */

export interface ParsedSyslog {
  timestamp: Date;
  hostname: string;
  facility: number;
  severity: number;
  tag?: string;
  message: string;
  severityName: string;
}

const SEVERITY_NAMES = ['EMERG', 'ALERT', 'CRIT', 'ERROR', 'WARN', 'NOTICE', 'INFO', 'DEBUG'];

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseRfc3164Timestamp(ts: string): Date {
  const now = new Date();
  const parts = ts.split(/\s+/);
  if (parts.length < 3) return now;
  const month = MONTHS[parts[0]];
  const day = parseInt(parts[1], 10);
  const timeParts = parts[2].split(':');
  if (month === undefined || isNaN(day) || timeParts.length !== 3) return now;
  const hour = parseInt(timeParts[0], 10);
  const minute = parseInt(timeParts[1], 10);
  const second = parseInt(timeParts[2], 10);
  const year = now.getFullYear();
  const date = new Date(year, month, day, hour, minute, second);
  // If the date is in the future, it was probably from last year
  if (date > now) {
    date.setFullYear(year - 1);
  }
  return date;
}

export function parseSyslogMessage(raw: string): ParsedSyslog | null {
  const str = raw.trim();
  if (!str) return null;

  // Try RFC5424 first: <priority>1 timestamp hostname app procid msgid structured-msg
  const rfc5424Match = str.match(/^<(\d+)>(\d)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S*)\s+(.*)$/);
  if (rfc5424Match) {
    const priority = parseInt(rfc5424Match[1], 10);
    const facility = Math.floor(priority / 8);
    const severity = priority % 8;
    const timestamp = new Date(rfc5424Match[3]);
    return {
      timestamp: isNaN(timestamp.getTime()) ? new Date() : timestamp,
      hostname: rfc5424Match[4],
      facility,
      severity,
      tag: rfc5424Match[5],
      message: rfc5424Match[8]?.trim() || '',
      severityName: SEVERITY_NAMES[severity] || 'UNKNOWN',
    };
  }

  // RFC3164: <priority>Mmm dd hh:mm:ss hostname tag: message
  const rfc3164Match = str.match(/^<(\d+)>([A-Z][a-z]{2}\s+\d+\s+\d+:\d+:\d+)\s+(\S+)\s+(.*)$/);
  if (rfc3164Match) {
    const priority = parseInt(rfc3164Match[1], 10);
    const facility = Math.floor(priority / 8);
    const severity = priority % 8;
    const rest = rfc3164Match[4];
    // Try to extract tag (non-whitespace + colon/space)
    const tagMatch = rest.match(/^([^:\s]+(?:\[\d+\])?:)\s*(.*)$/);
    return {
      timestamp: parseRfc3164Timestamp(rfc3164Match[2]),
      hostname: rfc3164Match[3],
      facility,
      severity,
      tag: tagMatch ? tagMatch[1].replace(':', '') : undefined,
      message: tagMatch ? tagMatch[2] : rest,
      severityName: SEVERITY_NAMES[severity] || 'UNKNOWN',
    };
  }

  // Fallback: treat entire message as raw text
  return {
    timestamp: new Date(),
    hostname: 'unknown',
    facility: 1,
    severity: 6,
    message: str,
    severityName: 'INFO',
  };
}
