import { createSocket, type Socket } from 'node:dgram';
import { createServer, type Server } from 'node:net';
import { parseSyslogMessage } from './syslog.js';
import { ingestLogs } from '../modules/logs/logs.service.js';
import { db, logSource } from '@piglog/db';
import { eq } from 'drizzle-orm';

interface SyslogServerOptions {
  udpPort?: number;
  tcpPort?: number;
  host?: string;
}

function severityToLevel(severityName: string): string {
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

export async function startSyslogServer(options: SyslogServerOptions = {}) {
  const udpPort = options.udpPort || 5140;
  const tcpPort = options.tcpPort || 5141;
  const host = options.host || '0.0.0.0';

  // UDP listener
  const udpSocket = createSocket('udp4');
  udpSocket.on('message', async (msg, rinfo) => {
    try {
      const raw = msg.toString('utf-8');
      const parsed = parseSyslogMessage(raw);
      if (!parsed) return;

      // For MVP, we map syslog source IP to a default source per workspace.
      // In production, you'd configure source IP → source mappings.
      // For now, we accept a X-Source-Key header concept or use a default.
      // Simplified: we look for a source named "syslog-default" or skip.
      // Actually, let's require the user to configure a source port mapping.
      // For now, we'll drop it or require a syslog source to be configured.
      // TODO: implement source routing by IP/port
      console.log(`[syslog-udp] ${rinfo.address}:${rinfo.port} - ${parsed.message.slice(0, 100)}`);
    } catch (err) {
      console.error('Syslog UDP handler error:', err);
    }
  });

  udpSocket.bind(udpPort, host, () => {
    console.log(`Syslog UDP listener on ${host}:${udpPort}`);
  });

  // TCP listener
  const tcpServer = createServer((socket) => {
    let buffer = '';
    socket.on('data', (data) => {
      buffer += data.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = parseSyslogMessage(line);
        if (parsed) {
          console.log(`[syslog-tcp] ${parsed.hostname} - ${parsed.message.slice(0, 100)}`);
        }
      }
    });
  });

  tcpServer.listen(tcpPort, host, () => {
    console.log(`Syslog TCP listener on ${host}:${tcpPort}`);
  });

  return { udpSocket, tcpServer };
}
