import { createSocket } from 'node:dgram';
import { createServer } from 'node:net';
import { parseSyslogMessage } from './syslog.js';
import { ingestLogs } from '../modules/logs/logs.service.js';
import { db, logSource } from '@piglog/db';
import { eq, and, isNull } from 'drizzle-orm';
import { createLogger } from './logger.js';

const log = createLogger('syslog');

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

// ---------------------------------------------------------------------------
// Source cache — avoids a DB query per incoming syslog message.
// TTL: 30 seconds. Refreshed lazily on miss.
// ---------------------------------------------------------------------------
const SOURCE_CACHE_TTL_MS = 30_000;
let cachedSources: Array<{
  id: string;
  workspaceId: string;
  name: string;
  config: Record<string, unknown> | null;
}> | null = null;
let cacheTimestamp = 0;

async function getSyslogSources() {
  const now = Date.now();
  if (cachedSources && now - cacheTimestamp < SOURCE_CACHE_TTL_MS) {
    return cachedSources;
  }
  const rows = await db.query.logSource.findMany({
    where: and(eq(logSource.type, 'syslog'), isNull(logSource.deletedAt)),
  });
  cachedSources = rows.map((s) => ({
    id: s.id,
    workspaceId: s.workspaceId,
    name: s.name,
    config: (s.config as Record<string, unknown> | null) ?? null,
  }));
  cacheTimestamp = now;
  return cachedSources;
}

async function handleSyslogMessage(raw: string, remoteAddress: string) {
  try {
    const parsed = parseSyslogMessage(raw);
    if (!parsed) return;

    const sources = await getSyslogSources();

    if (sources.length === 0) return;

    let source = sources[0];
    if (sources.length > 1) {
      const hostnameLower = parsed.hostname.toLowerCase();
      const match = sources.find((s) => {
        if (s.name.toLowerCase() === hostnameLower) return true;
        const host = s.config?.host;
        return typeof host === 'string' && host.toLowerCase() === hostnameLower;
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
    log.error(`Ingestion error from ${remoteAddress}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function startSyslogServer(options: SyslogServerOptions = {}) {
  const udpPort = options.udpPort || parseInt(process.env.SYSLOG_UDP_PORT || '5140', 10);
  const tcpPort = options.tcpPort || parseInt(process.env.SYSLOG_TCP_PORT || '5141', 10);
  const host = options.host || process.env.SYSLOG_HOST || '0.0.0.0';

  const udpSocket = createSocket('udp4');
  udpSocket.on('message', (msg, rinfo) => {
    // Fire-and-forget — don't await in a UDP callback to avoid backpressure
    handleSyslogMessage(msg.toString('utf-8'), rinfo.address).catch(() => {});
  });
  udpSocket.on('error', (err) => {
    log.error(`UDP socket error: ${err.message}`);
  });

  udpSocket.bind(udpPort, host, () => {
    log.info(`Syslog UDP listener on ${host}:${udpPort}`);
  });

  const MAX_TCP_CONNECTIONS = parseInt(process.env.SYSLOG_MAX_TCP_CONNECTIONS || '100', 10);
  let tcpConnectionCount = 0;

  const tcpServer = createServer((socket) => {
    tcpConnectionCount++;
    if (tcpConnectionCount > MAX_TCP_CONNECTIONS) {
      log.warn(`TCP connection limit (${MAX_TCP_CONNECTIONS}) reached, rejecting ${socket.remoteAddress || 'unknown'}`);
      socket.destroy();
      return;
    }

    let buffer = '';
    const remoteAddress = socket.remoteAddress || 'unknown';
    const MAX_BUFFER_BYTES = 64 * 1024; // 64KB — drop connection if no newline seen

    socket.on('close', () => { tcpConnectionCount--; });

    socket.on('data', (data) => {
      buffer += data.toString('utf-8');
      if (Buffer.byteLength(buffer, 'utf-8') > MAX_BUFFER_BYTES) {
        log.warn(`TCP buffer overflow from ${remoteAddress}, dropping connection`);
        socket.destroy();
        return;
      }
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        if (!line.trim()) continue;
        handleSyslogMessage(line, remoteAddress).catch(() => {});
      }
    });
    socket.on('error', (err) => {
      log.error(`TCP socket error from ${remoteAddress}: ${err.message}`);
    });
  });

  tcpServer.on('error', (err) => {
    log.error(`TCP server error: ${err.message}`);
  });

  tcpServer.listen(tcpPort, host, () => {
    log.info(`Syslog TCP listener on ${host}:${tcpPort}`);
  });

  return { udpSocket, tcpServer };
}
