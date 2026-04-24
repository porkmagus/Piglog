import { createSocket, type Socket } from 'node:dgram';
import { createServer, type Server } from 'node:net';
import { parseSyslogMessage } from './syslog.js';
import { ingestLogs } from '../modules/logs/logs.service.js';
import { db, logSource } from '@piglog/db';
import { eq, and, isNull } from 'drizzle-orm';

interface SyslogServerOptions {
  udpPort?: number;
  tcpPort?: number;
  host?: string;
}

function severityToLevel(severityName: string): 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' {
  switch (severityName) {
    case 'EMERG':
    case 'ALERT':
    case 'CRIT':
    case 'ERROR':
      return 'ERROR';
    case 'WARN':
      return 'WARN';
    case 'NOTICE':
    case 'INFO':
      return 'INFO';
    case 'DEBUG':
      return 'DEBUG';
    default:
      return 'INFO';
  }
}

async function handleSyslogMessage(raw: string, remoteAddress: string) {
  try {
    const parsed = parseSyslogMessage(raw);
    if (!parsed) return;

    // Find a syslog source to ingest into.
    // For MVP: match by hostname if multiple syslog sources exist,
    // otherwise use the single syslog source found.
    const sources = await db.query.logSource.findMany({
      where: and(eq(logSource.type, 'syslog'), isNull(logSource.deletedAt)),
    });

    if (sources.length === 0) {
      // No syslog source configured — silently drop
      return;
    }

    let source = sources[0];
    if (sources.length > 1) {
      // Try to match by hostname against source name or config.host
      const match = sources.find((s) => {
        if (s.name.toLowerCase() === parsed.hostname.toLowerCase()) return true;
        const host = (s.config as Record<string, unknown> | null)?.host;
        return typeof host === 'string' && host.toLowerCase() === parsed.hostname.toLowerCase();
      });
      if (match) source = match;
    }

    await ingestLogs(source.workspaceId, source.id, [
      {
        timestamp: parsed.timestamp.toISOString(),
        level: severityToLevel(parsed.severityName),
        service: parsed.tag || parsed.hostname || 'syslog',
        host: parsed.hostname || remoteAddress,
        message: parsed.message,
        metadata: {
          facility: parsed.facility,
          severity: parsed.severity,
          severityName: parsed.severityName,
          tag: parsed.tag,
        },
      },
    ]);
  } catch (err) {
    console.error('[syslog] ingestion error:', err);
  }
}

export async function startSyslogServer(options: SyslogServerOptions = {}) {
  const udpPort = options.udpPort || parseInt(process.env.SYSLOG_UDP_PORT || '5140', 10);
  const tcpPort = options.tcpPort || parseInt(process.env.SYSLOG_TCP_PORT || '5141', 10);
  const host = options.host || process.env.SYSLOG_HOST || '0.0.0.0';

  const udpSocket = createSocket('udp4');
  udpSocket.on('message', async (msg, rinfo) => {
    const raw = msg.toString('utf-8');
    await handleSyslogMessage(raw, rinfo.address);
  });
  udpSocket.on('error', (err) => {
    console.error('[syslog] UDP socket error:', err.message);
  });

  udpSocket.bind(udpPort, host, () => {
    console.log(`Syslog UDP listener on ${host}:${udpPort}`);
  });

  const tcpServer = createServer((socket) => {
    let buffer = '';
    const remoteAddress = socket.remoteAddress || 'unknown';
    socket.on('data', async (data) => {
      buffer += data.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        if (!line.trim()) continue;
        await handleSyslogMessage(line, remoteAddress);
      }
    });
    socket.on('error', (err) => {
      console.error('[syslog] TCP socket error:', err.message);
    });
    socket.on('close', () => {
      // socket closed
    });
  });

  tcpServer.on('error', (err) => {
    console.error('[syslog] TCP server error:', err.message);
  });

  tcpServer.listen(tcpPort, host, () => {
    console.log(`Syslog TCP listener on ${host}:${tcpPort}`);
  });

  return { udpSocket, tcpServer };
}
