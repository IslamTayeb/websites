import { isIP } from 'node:net';

import {
  classifyBotSignal,
  type ClientVisitPayload,
  type VisitRequestContext,
} from './visit-events.js';
import {
  configuredValue,
  UNKNOWN,
  type NetworkEnrichment,
} from './network-enrichment.js';

export type VisitStorageInput = {
  visit: ClientVisitPayload;
  context: VisitRequestContext;
  network: NetworkEnrichment;
  serverAt?: Date | string;
};

type VisitStorageRecord = {
  eventId: string;
  eventKind: 'pageview';
  clientId: string;
  sessionId: string;
  firstVisit: boolean;
  path: string;
  title: string;
  referrer: string;
  viewport: string;
  screen: string;
  browserTimezone: string;
  language: string;
  reason: string;
  clientAt: string;
  serverAt: string;
  clientIp: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  networkTimezone: string | null;
  userAgent: string;
  host: string;
  secFetchSite: string | null;
  secFetchMode: string | null;
  secFetchDest: string | null;
  asn: string | null;
  asName: string | null;
  asDomain: string | null;
  botLabel: string;
  botEvidence: string;
};

type VisitStorageStatement = {
  text: string;
  values: readonly unknown[];
};

type VisitStorageQueryResult = {
  rows: readonly Record<string, unknown>[];
};

export type VisitStorageExecutor = (
  statement: VisitStorageStatement
) => Promise<VisitStorageQueryResult>;

export type PersistVisitResult = {
  inserted: boolean;
  pageviewCount: number | null;
};

function nullableKnown(value: string) {
  const trimmed = value.trim();

  return trimmed && trimmed.toLowerCase() !== UNKNOWN ? trimmed : null;
}

function validIp(value: string) {
  const candidate = nullableKnown(value);

  return candidate && isIP(candidate) !== 0 ? candidate : null;
}

function coordinate(value: string, minimum: number, maximum: number) {
  const candidate = nullableKnown(value);

  if (candidate === null) {
    return null;
  }

  const parsed = Number(candidate);

  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

function isoTimestamp(value: Date | string, fieldName: string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid timestamp.`);
  }

  return date.toISOString();
}

export function buildVisitStorageRecord(
  input: VisitStorageInput
): VisitStorageRecord {
  const { visit, context, network } = input;
  const botSignal = classifyBotSignal(visit, context);

  return {
    eventId: visit.eventId,
    eventKind: visit.kind,
    clientId: visit.clientId,
    sessionId: visit.sessionId,
    firstVisit: visit.firstVisit,
    path: visit.path,
    title: visit.title,
    referrer: visit.referrer,
    viewport: visit.viewport,
    screen: visit.screen,
    browserTimezone: visit.timezone,
    language: visit.language,
    reason: visit.reason,
    clientAt: isoTimestamp(visit.at, 'visit.at'),
    serverAt: isoTimestamp(input.serverAt ?? new Date(), 'serverAt'),
    clientIp: validIp(context.clientIp),
    country: nullableKnown(context.country),
    region: nullableKnown(context.region),
    city: nullableKnown(context.city),
    postalCode: nullableKnown(context.postalCode),
    latitude: coordinate(context.latitude, -90, 90),
    longitude: coordinate(context.longitude, -180, 180),
    networkTimezone: nullableKnown(context.timezone),
    userAgent: context.userAgent,
    host: context.host,
    secFetchSite: nullableKnown(context.secFetchSite),
    secFetchMode: nullableKnown(context.secFetchMode),
    secFetchDest: nullableKnown(context.secFetchDest),
    asn: nullableKnown(network.asn),
    asName: nullableKnown(network.asName),
    asDomain: nullableKnown(network.asDomain),
    botLabel: botSignal.label,
    botEvidence: botSignal.evidence,
  };
}

export function buildVisitStorageStatement(
  record: VisitStorageRecord
): VisitStorageStatement {
  return {
    text: `
      WITH inserted_event AS (
        INSERT INTO pageview_events (
          event_id,
          event_kind,
          client_id,
          session_id,
          first_visit,
          path,
          title,
          referrer,
          viewport,
          screen,
          browser_timezone,
          language,
          reason,
          client_at,
          server_at,
          client_ip,
          country,
          region,
          city,
          postal_code,
          latitude,
          longitude,
          network_timezone,
          user_agent,
          host,
          sec_fetch_site,
          sec_fetch_mode,
          sec_fetch_dest,
          asn,
          as_name,
          as_domain,
          bot_label,
          bot_evidence
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16::inet, $17, $18, $19, $20,
          $21::numeric, $22::numeric, $23, $24, $25, $26, $27,
          $28, $29, $30, $31, $32, $33
        )
        ON CONFLICT (event_id) DO NOTHING
        RETURNING
          client_id,
          session_id,
          referrer,
          server_at,
          client_ip,
          country,
          region,
          city,
          postal_code,
          latitude,
          longitude,
          network_timezone,
          asn,
          as_name,
          as_domain
      ),
      upserted_profile AS (
        INSERT INTO visitor_profiles (
          client_id,
          first_seen_at,
          last_seen_at,
          first_referrer,
          last_referrer,
          latest_session_id,
          latest_ip,
          latest_country,
          latest_region,
          latest_city,
          latest_postal_code,
          latest_latitude,
          latest_longitude,
          latest_network_timezone,
          latest_asn,
          latest_as_name,
          latest_as_domain,
          pageview_count
        )
        SELECT
          client_id,
          server_at,
          server_at,
          referrer,
          referrer,
          session_id,
          client_ip,
          country,
          region,
          city,
          postal_code,
          latitude,
          longitude,
          network_timezone,
          asn,
          as_name,
          as_domain,
          1
        FROM inserted_event
        ON CONFLICT (client_id) DO UPDATE SET
          first_seen_at = LEAST(
            visitor_profiles.first_seen_at,
            EXCLUDED.first_seen_at
          ),
          last_seen_at = GREATEST(
            visitor_profiles.last_seen_at,
            EXCLUDED.last_seen_at
          ),
          first_referrer = CASE
            WHEN EXCLUDED.first_seen_at < visitor_profiles.first_seen_at
              THEN EXCLUDED.first_referrer
            ELSE visitor_profiles.first_referrer
          END,
          last_referrer = CASE
            WHEN EXCLUDED.last_seen_at >= visitor_profiles.last_seen_at
              THEN EXCLUDED.last_referrer
            ELSE visitor_profiles.last_referrer
          END,
          latest_session_id = CASE
            WHEN EXCLUDED.last_seen_at >= visitor_profiles.last_seen_at
              THEN EXCLUDED.latest_session_id
            ELSE visitor_profiles.latest_session_id
          END,
          latest_ip = CASE
            WHEN EXCLUDED.last_seen_at >= visitor_profiles.last_seen_at
              THEN EXCLUDED.latest_ip
            ELSE visitor_profiles.latest_ip
          END,
          latest_country = CASE
            WHEN EXCLUDED.last_seen_at >= visitor_profiles.last_seen_at
              THEN EXCLUDED.latest_country
            ELSE visitor_profiles.latest_country
          END,
          latest_region = CASE
            WHEN EXCLUDED.last_seen_at >= visitor_profiles.last_seen_at
              THEN EXCLUDED.latest_region
            ELSE visitor_profiles.latest_region
          END,
          latest_city = CASE
            WHEN EXCLUDED.last_seen_at >= visitor_profiles.last_seen_at
              THEN EXCLUDED.latest_city
            ELSE visitor_profiles.latest_city
          END,
          latest_postal_code = CASE
            WHEN EXCLUDED.last_seen_at >= visitor_profiles.last_seen_at
              THEN EXCLUDED.latest_postal_code
            ELSE visitor_profiles.latest_postal_code
          END,
          latest_latitude = CASE
            WHEN EXCLUDED.last_seen_at >= visitor_profiles.last_seen_at
              THEN EXCLUDED.latest_latitude
            ELSE visitor_profiles.latest_latitude
          END,
          latest_longitude = CASE
            WHEN EXCLUDED.last_seen_at >= visitor_profiles.last_seen_at
              THEN EXCLUDED.latest_longitude
            ELSE visitor_profiles.latest_longitude
          END,
          latest_network_timezone = CASE
            WHEN EXCLUDED.last_seen_at >= visitor_profiles.last_seen_at
              THEN EXCLUDED.latest_network_timezone
            ELSE visitor_profiles.latest_network_timezone
          END,
          latest_asn = CASE
            WHEN EXCLUDED.last_seen_at >= visitor_profiles.last_seen_at
              THEN EXCLUDED.latest_asn
            ELSE visitor_profiles.latest_asn
          END,
          latest_as_name = CASE
            WHEN EXCLUDED.last_seen_at >= visitor_profiles.last_seen_at
              THEN EXCLUDED.latest_as_name
            ELSE visitor_profiles.latest_as_name
          END,
          latest_as_domain = CASE
            WHEN EXCLUDED.last_seen_at >= visitor_profiles.last_seen_at
              THEN EXCLUDED.latest_as_domain
            ELSE visitor_profiles.latest_as_domain
          END,
          pageview_count = visitor_profiles.pageview_count + 1
        RETURNING pageview_count
      )
      SELECT
        EXISTS (SELECT 1 FROM inserted_event) AS inserted,
        COALESCE(
          (SELECT pageview_count FROM upserted_profile),
          (SELECT pageview_count FROM visitor_profiles WHERE client_id = $3)
        ) AS pageview_count
    `,
    values: [
      record.eventId,
      record.eventKind,
      record.clientId,
      record.sessionId,
      record.firstVisit,
      record.path,
      record.title,
      record.referrer,
      record.viewport,
      record.screen,
      record.browserTimezone,
      record.language,
      record.reason,
      record.clientAt,
      record.serverAt,
      record.clientIp,
      record.country,
      record.region,
      record.city,
      record.postalCode,
      record.latitude,
      record.longitude,
      record.networkTimezone,
      record.userAgent,
      record.host,
      record.secFetchSite,
      record.secFetchMode,
      record.secFetchDest,
      record.asn,
      record.asName,
      record.asDomain,
      record.botLabel,
      record.botEvidence,
    ],
  };
}

function configuredDatabaseUrl() {
  const databaseUrl = configuredValue(process.env.DATABASE_URL);

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required to persist private pageview history.'
    );
  }

  return databaseUrl;
}

async function executeWithNeon(
  statement: VisitStorageStatement
): Promise<VisitStorageQueryResult> {
  const databaseUrl = configuredDatabaseUrl();
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(databaseUrl);
  const rows = await sql.query(statement.text, [...statement.values]);

  return { rows };
}

function parseInserted(value: unknown) {
  return value === true || value === 'true' || value === 't';
}

function parsePageviewCount(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);

    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  return null;
}

export async function persistVisit(
  input: VisitStorageInput,
  executor: VisitStorageExecutor = executeWithNeon
): Promise<PersistVisitResult> {
  const statement = buildVisitStorageStatement(buildVisitStorageRecord(input));
  const result = await executor(statement);
  const row = result.rows[0];

  if (!row) {
    throw new Error('Pageview persistence returned no result row.');
  }

  return {
    inserted: parseInserted(row.inserted),
    pageviewCount: parsePageviewCount(row.pageview_count),
  };
}
