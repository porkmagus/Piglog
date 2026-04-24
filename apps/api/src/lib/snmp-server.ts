import snmp from 'net-snmp';
import { eq, and, isNull } from 'drizzle-orm';
import { db, logSource } from '@piglog/db';
import { ingestLogs } from '../modules/logs/logs.service.js';

interface SnmpServerOptions {
  port?: number;
  host?: string;
}

const TRAP_OID = '1.3.6.1.6.3.1.1.4.1.0';

const GENERIC_TRAP_NAMES: Record<number, string> = {
  0: 'coldStart',
  1: 'warmStart',
  2: 'linkDown',
  3: 'linkUp',
  4: 'authenticationFailure',
  5: 'egpNeighborLoss',
  6: 'enterpriseSpecific',
};

let missingSchemaWarningShown = false;

function isMissingRelationError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }

  if ('code' in err && err.code === '42P01') {
    return true;
  }

  if ('cause' in err) {
    return isMissingRelationError(err.cause);
  }

  return false;
}

async function getConfiguredSnmpSources() {
  try {
    return await db.query.logSource.findMany({
      where: and(eq(logSource.type, 'snmp'), isNull(logSource.deletedAt)),
    });
  } catch (err) {
    if (isMissingRelationError(err)) {
      if (!missingSchemaWarningShown) {
        missingSchemaWarningShown = true;
        console.warn('[snmp] Skipping SNMP bootstrap because database schema is not ready yet.');
      }
      return [];
    }

    throw err;
  }
}

function genericTrapToLevel(trapType: number): typeof import('@piglog/db').logLevelEnum.enumValues[number] {
  switch (trapType) {
    case 2: // linkDown
    case 3: // linkUp
      return 'WARN';
    case 4: // authenticationFailure
    case 5: // egpNeighborLoss
      return 'ERROR';
    default:
      return 'INFO';
  }
}

function formatVarbinds(varbinds: Array<{ oid: string; value: unknown }>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const vb of varbinds) {
    result[vb.oid] = vb.value;
  }
  return result;
}

function extractTrapOid(varbinds: Array<{ oid: string; value: unknown }>): string | undefined {
  const trapVarbind = varbinds.find((vb) => vb.oid === TRAP_OID);
  return trapVarbind?.value as string | undefined;
}

async function handleNotification(notification: any) {
  const senderIp = notification.rinfo?.address || 'unknown';
  const pdu = notification.pdu;

  // Find matching SNMP source by sender IP
  const sources = await getConfiguredSnmpSources();

  const source = sources.find((s) => {
    const config = (s.config as Record<string, unknown> | null) || {};
    const host = config.host;
    return typeof host === 'string' && (host === senderIp || host === notification.rinfo?.address);
  });

  if (!source) {
    // No matching SNMP source — silently drop
    return;
  }

  let message: string;
  let level: typeof import('@piglog/db').logLevelEnum.enumValues[number] = 'INFO';
  let service = 'snmp';

  if (pdu.type === snmp.PduType.Trap) {
    // SNMPv1 Trap
    const genericTrap = pdu.genericTrap ?? 6;
    const trapName = GENERIC_TRAP_NAMES[genericTrap] || 'enterpriseSpecific';
    message = `SNMPv1 Trap: ${trapName}${pdu.specificTrap ? ` (specific=${pdu.specificTrap})` : ''}`;
    level = genericTrapToLevel(genericTrap);
    service = pdu.enterprise || 'snmp';
  } else {
    // SNMPv2c/v3 Trap or Inform
    const trapOid = extractTrapOid(pdu.varbinds || []);
    message = `SNMP Trap: ${trapOid || 'unknown'}`;
    level = 'INFO';
    service = trapOid || 'snmp';
  }

  await ingestLogs(source.workspaceId, source.id, [
    {
      timestamp: new Date().toISOString(),
      level,
      service,
      host: senderIp,
      message,
      metadata: {
        snmpVersion: pdu.type === snmp.PduType.Trap ? 'v1' : 'v2c/v3',
        pduType: pdu.type,
        varbinds: formatVarbinds(pdu.varbinds || []),
        senderPort: notification.rinfo?.port,
      },
    },
  ]);
}

export async function startSnmpServer(options: SnmpServerOptions = {}) {
  const port = options.port || parseInt(process.env.SNMP_TRAP_PORT || '1620', 10);
  const host = options.host || process.env.SNMP_HOST || '0.0.0.0';

  const sources = await getConfiguredSnmpSources();
  if (sources.length === 0) {
    console.log('[snmp] No configured sources available. SNMP trap listener not started.');
    return null;
  }

  const receiver = snmp.createReceiver(
    {
      port,
      address: host,
      disableAuthorization: false,
      includeAuthentication: true,
    },
    (error: Error | null, notification: any) => {
      if (error) {
        console.error('[snmp] Receive error:', error.message);
        return;
      }
      handleNotification(notification).catch((err) => {
        console.error('[snmp] Ingestion error:', err);
      });
    }
  );

  const authorizer = receiver.getAuthorizer();

  for (const source of sources) {
    const config = (source.config as Record<string, unknown> | null) || {};
    const version = config.version;

    if (version === 'v1' || version === 'v2c') {
      const community = typeof config.community === 'string' ? config.community : 'public';
      authorizer.addCommunity(community);
    } else if (version === 'v3') {
      const user = {
        name: String(config.username || ''),
        level: config.securityLevel === 'authPriv'
          ? snmp.SecurityLevel.authPriv
          : config.securityLevel === 'authNoPriv'
            ? snmp.SecurityLevel.authNoPriv
            : snmp.SecurityLevel.noAuthNoPriv,
        authProtocol: config.authProtocol === 'SHA'
          ? snmp.AuthProtocols.sha
          : config.authProtocol === 'SHA256'
            ? snmp.AuthProtocols.sha256
            : snmp.AuthProtocols.md5,
        authKey: String(config.authPassphrase || ''),
        privProtocol: config.privacyProtocol === 'AES'
          ? snmp.PrivProtocols.aes
          : config.privacyProtocol === 'AES256'
            ? snmp.PrivProtocols.aes256b
            : snmp.PrivProtocols.des,
        privKey: String(config.privacyPassphrase || ''),
      };
      if (user.name) {
        authorizer.addUser(user);
      }
    }
  }

  console.log(`SNMP trap listener on ${host}:${port} (${sources.length} source(s) configured)`);

  return receiver;
}
