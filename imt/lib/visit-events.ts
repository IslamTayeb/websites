import {
  configuredValue,
  formatNetworkOrganization,
  UNKNOWN,
  UNKNOWN_NETWORK_ENRICHMENT,
  type NetworkEnrichment,
} from './network-enrichment.js';

const MAX_FIELD_LENGTH = 900;
const MAX_TITLE_LENGTH = 180;
const MAX_PATH_LENGTH = 240;
const LOCAL_CLIENT_IP = '127.0.0.1';

const US_REGION_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

const knownBotUserAgents = [
  ['Googlebot', /googlebot/i],
  ['Bingbot', /bingbot/i],
  ['DuckDuckBot', /duckduckbot/i],
  ['Baiduspider', /baiduspider/i],
  ['YandexBot', /yandexbot/i],
  ['Applebot', /applebot/i],
  ['facebookexternalhit', /facebookexternalhit/i],
  ['Twitterbot', /twitterbot/i],
  ['LinkedInBot', /linkedinbot/i],
  ['Discordbot', /discordbot/i],
  ['Slackbot', /slackbot/i],
  ['GPTBot', /gptbot/i],
  ['ClaudeBot', /claudebot/i],
  ['Anthropic crawler', /anthropic-ai/i],
  ['PerplexityBot', /perplexitybot/i],
  ['Common Crawl', /ccbot/i],
  ['SemrushBot', /semrushbot/i],
  ['AhrefsBot', /ahrefsbot/i],
  ['MJ12bot', /mj12bot/i],
  ['DotBot', /dotbot/i],
  ['bot/crawler/spider', /\b(bot|crawler|spider)\b/i],
] as const;

const automationUserAgents = [
  ['curl', /\bcurl\//i],
  ['wget', /\bwget\//i],
  ['Python requests', /python-requests|python\/|aiohttp|httpx/i],
  ['Node fetch', /node-fetch|undici|axios/i],
  ['Go HTTP client', /go-http-client/i],
  ['Java HTTP client', /java\/|okhttp/i],
  ['Postman', /postmanruntime/i],
  ['Insomnia', /insomnia/i],
  ['Scrapy', /scrapy/i],
  ['headless browser', /headlesschrome|playwright|puppeteer|selenium/i],
] as const;

const browserUserAgentPattern =
  /mozilla\/5\.0.*(chrome|safari|firefox|edg|opr|opera|crios|fxios)/i;
const browserReasons = new Set([
  'load',
  'pushState',
  'replaceState',
  'popstate',
]);

export type ClientVisitPayload = {
  kind: 'pageview';
  eventId: string;
  path: string;
  title: string;
  referrer: string;
  clientId: string;
  sessionId: string;
  firstVisit: boolean;
  viewport: string;
  screen: string;
  timezone: string;
  language: string;
  reason: string;
  at: string;
};

export type VisitRequestContext = {
  clientIp: string;
  country: string;
  region: string;
  city: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  timezone: string;
  userAgent: string;
  host: string;
  secFetchSite: string;
  secFetchMode: string;
  secFetchDest: string;
};

type BotSignal = {
  label:
    | '✅ Likely human'
    | '🤖 Known bot'
    | '⚠️ Likely automation'
    | '❓ Unknown';
  evidence: string;
};

type DiscordField = {
  name: string;
  value: string;
  inline?: boolean;
};

type DiscordEmbed = {
  title: string;
  description: string;
  color: number;
  fields: DiscordField[];
  timestamp: string;
  footer: {
    text: string;
  };
};

type DiscordWebhookPayload = {
  embeds: DiscordEmbed[];
  allowed_mentions: {
    parse: [];
  };
};

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown) {
  return value === true;
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function compactDiscordLines(value: string) {
  return value
    .split('\n')
    .map((line) => compactWhitespace(line))
    .filter(Boolean)
    .join('\n');
}

function limit(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

function safeDiscordText(
  value: string,
  maxLength = MAX_FIELD_LENGTH,
  fallback = 'unknown'
) {
  const text = compactDiscordLines(value).replaceAll('@', '@\u200b');

  return limit(text || fallback, maxLength);
}

function safePath(value: unknown) {
  const path = compactWhitespace(asString(value, '/'));

  if (!path.startsWith('/')) {
    return '/';
  }

  return limit(path, MAX_PATH_LENGTH);
}

function safeIsoDate(value: unknown) {
  const date = new Date(asString(value));

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function safeEventId(value: unknown) {
  const eventId = asString(value).trim();

  if (!/^[A-Za-z0-9_-]{8,80}$/.test(eventId)) {
    return null;
  }

  return eventId;
}

function readHeader(request: Request, name: string) {
  return request.headers.get(name) ?? '';
}

function known(value: string) {
  return Boolean(value && value !== UNKNOWN);
}

function decodeHeaderValue(value: string) {
  if (!value) {
    return UNKNOWN;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function displayCountry(country: string) {
  if (!known(country)) {
    return UNKNOWN;
  }

  try {
    return (
      new Intl.DisplayNames(['en'], { type: 'region' }).of(
        country.toUpperCase()
      ) ?? country
    );
  } catch {
    return country;
  }
}

function displayRegion(country: string, region: string) {
  if (!known(region)) {
    return UNKNOWN;
  }

  if (country.toUpperCase() === 'US') {
    return US_REGION_NAMES[region.toUpperCase()] ?? region;
  }

  return region;
}

function hasCoordinates(context: VisitRequestContext) {
  return (
    known(context.latitude) &&
    known(context.longitude) &&
    Number.isFinite(Number(context.latitude)) &&
    Number.isFinite(Number(context.longitude))
  );
}

function normalizedPath(visit: ClientVisitPayload) {
  return `/${visit.path.replace(/^\/+/, '')}`;
}

function sizeLooksBrowserLike(value: string) {
  const match = /^(\d+)x(\d+)$/.exec(value);

  if (!match) {
    return false;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  return width >= 200 && height >= 200;
}

function clientValueLooksKnown(value: string) {
  return known(value) && value.length >= 8;
}

function findUserAgentMatch(
  userAgent: string,
  patterns: readonly (readonly [string, RegExp])[]
) {
  return patterns.find(([, pattern]) => pattern.test(userAgent))?.[0];
}

function readClientIp(request: Request) {
  const forwarded = readHeader(request, 'x-forwarded-for');

  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || LOCAL_CLIENT_IP;
  }

  return readHeader(request, 'x-real-ip') || LOCAL_CLIENT_IP;
}

export function anonymizeClientIp(clientIp: string) {
  if (clientIp.includes(':')) {
    return `${clientIp.split(':').slice(0, 3).join(':')}::`;
  }

  const parts = clientIp.split('.');

  if (parts.length !== 4) {
    return clientIp;
  }

  return `${parts.slice(0, 3).join('.')}.0`;
}

export function buildVisitRequestContext(
  request: Request
): VisitRequestContext {
  return {
    clientIp: readClientIp(request),
    country: readHeader(request, 'x-vercel-ip-country') || 'unknown',
    region:
      readHeader(request, 'x-vercel-ip-country-region') ||
      readHeader(request, 'x-vercel-ip-region') ||
      'unknown',
    city: decodeHeaderValue(readHeader(request, 'x-vercel-ip-city')),
    postalCode: readHeader(request, 'x-vercel-ip-postal-code') || 'unknown',
    latitude: readHeader(request, 'x-vercel-ip-latitude') || 'unknown',
    longitude: readHeader(request, 'x-vercel-ip-longitude') || 'unknown',
    timezone: readHeader(request, 'x-vercel-ip-timezone') || 'unknown',
    userAgent: readHeader(request, 'user-agent') || 'unknown',
    host: readHeader(request, 'host') || 'unknown',
    secFetchSite: readHeader(request, 'sec-fetch-site') || 'unknown',
    secFetchMode: readHeader(request, 'sec-fetch-mode') || 'unknown',
    secFetchDest: readHeader(request, 'sec-fetch-dest') || 'unknown',
  };
}

export function normalizeVisitPayload(input: unknown) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const candidate = input as Record<string, unknown>;

  if (candidate.kind !== 'pageview') {
    return null;
  }

  const eventId = safeEventId(candidate.eventId);

  if (!eventId) {
    return null;
  }

  return {
    kind: 'pageview',
    eventId,
    path: safePath(candidate.path),
    title: safeDiscordText(
      asString(candidate.title, 'Untitled'),
      MAX_TITLE_LENGTH,
      'Untitled'
    ),
    referrer: safeDiscordText(
      asString(candidate.referrer, 'direct'),
      undefined,
      'direct'
    ),
    clientId: safeDiscordText(asString(candidate.clientId, 'unknown'), 80),
    sessionId: safeDiscordText(asString(candidate.sessionId, 'unknown'), 80),
    firstVisit: asBoolean(candidate.firstVisit),
    viewport: safeDiscordText(asString(candidate.viewport, 'unknown'), 40),
    screen: safeDiscordText(asString(candidate.screen, 'unknown'), 40),
    timezone: safeDiscordText(asString(candidate.timezone, 'unknown'), 80),
    language: safeDiscordText(asString(candidate.language, 'unknown'), 40),
    reason: safeDiscordText(asString(candidate.reason, 'load'), 40),
    at: safeIsoDate(candidate.at),
  } satisfies ClientVisitPayload;
}

export function shouldAcceptVisitRequest(request: Request) {
  const site = readHeader(request, 'sec-fetch-site');

  if (site && site !== 'same-origin' && site !== 'none') {
    return false;
  }

  const origin = readHeader(request, 'origin');
  const host = readHeader(request, 'host');

  if (!origin || !host) {
    return true;
  }

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function shouldSkipVisitRequest(request: Request, clientIp: string) {
  if (
    process.env.SITE_VISIT_RESPECT_DNT === 'true' &&
    (readHeader(request, 'dnt') === '1' ||
      readHeader(request, 'sec-gpc') === '1')
  ) {
    return true;
  }

  const suppressedIps =
    process.env.SITE_VISIT_SUPPRESS_CLIENT_IPS?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  return suppressedIps.some((suppressedIp) => clientIp.includes(suppressedIp));
}

export function classifyBotSignal(
  visit: ClientVisitPayload,
  context: VisitRequestContext
): BotSignal {
  const userAgent = context.userAgent;
  const knownBot = findUserAgentMatch(userAgent, knownBotUserAgents);

  if (knownBot) {
    return {
      label: '🤖 Known bot',
      evidence: `UA matched ${knownBot}`,
    };
  }

  const automation = findUserAgentMatch(userAgent, automationUserAgents);

  if (automation) {
    return {
      label: '⚠️ Likely automation',
      evidence: `UA matched ${automation}`,
    };
  }

  const hasBrowserUa = browserUserAgentPattern.test(userAgent);
  const hasBrowserPayload =
    sizeLooksBrowserLike(visit.viewport) &&
    sizeLooksBrowserLike(visit.screen) &&
    known(visit.language) &&
    known(visit.timezone) &&
    clientValueLooksKnown(visit.clientId) &&
    clientValueLooksKnown(visit.sessionId) &&
    browserReasons.has(visit.reason);

  if (hasBrowserUa && hasBrowserPayload) {
    return {
      label: '✅ Likely human',
      evidence: 'browser beacon + normal UA',
    };
  }

  const missingBrowserSignals = [
    !sizeLooksBrowserLike(visit.viewport) && 'viewport',
    !sizeLooksBrowserLike(visit.screen) && 'screen',
    !known(visit.language) && 'language',
    !known(visit.timezone) && 'timezone',
  ].filter(Boolean);

  if (!hasBrowserUa && missingBrowserSignals.length > 0) {
    return {
      label: '⚠️ Likely automation',
      evidence: `missing browser ${missingBrowserSignals.join('/')}`,
    };
  }

  return {
    label: '❓ Unknown',
    evidence: hasBrowserPayload
      ? 'browser payload present, UA not recognized'
      : 'insufficient passive signals',
  };
}

function buildLocationValue(context: VisitRequestContext) {
  const location = [
    known(context.city) ? context.city : '',
    displayRegion(context.country, context.region),
    displayCountry(context.country),
  ].filter((part) => part && part !== UNKNOWN);
  const lines = [
    `Location: ${location.length > 0 ? location.join(', ') : UNKNOWN}`,
  ];

  if (known(context.postalCode)) {
    lines.push(`Postal code: ${context.postalCode}`);
  }

  if (hasCoordinates(context)) {
    const coordinates = `${context.latitude}, ${context.longitude}`;
    const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(
      coordinates
    )}`;

    lines.push(`Map: [${coordinates}](${mapUrl})`);
  }

  if (known(context.timezone)) {
    lines.push(`Network timezone: ${context.timezone}`);
  }

  return safeDiscordText(lines.join('\n'));
}

function buildNetworkValue(
  context: VisitRequestContext,
  displayedClientIp: string | null,
  network: NetworkEnrichment
) {
  return safeDiscordText(
    [
      `IP: ${displayedClientIp ?? 'hidden'}`,
      `ISP / Org: ${formatNetworkOrganization(network)}`,
      `Host: ${context.host}`,
      `UA: ${context.userAgent}`,
    ].join('\n')
  );
}

function buildDeviceValue(visit: ClientVisitPayload) {
  return safeDiscordText(
    [
      `Viewport: ${visit.viewport}`,
      `Screen: ${visit.screen}`,
      `Language: ${visit.language}`,
      `Browser timezone: ${visit.timezone}`,
    ].join('\n')
  );
}

function buildVisitValue(visit: ClientVisitPayload) {
  return safeDiscordText(
    [
      visit.firstVisit ? 'First seen client' : 'Returning client',
      `Client: ${visit.clientId.slice(0, 12)}`,
      `Session: ${visit.sessionId.slice(0, 12)}`,
      `Reason: ${visit.reason}`,
    ].join('\n')
  );
}

export function buildDiscordVisitPayload(
  visit: ClientVisitPayload,
  context: VisitRequestContext,
  network: NetworkEnrichment = UNKNOWN_NETWORK_ENRICHMENT
): DiscordWebhookPayload {
  const shouldIncludeClientIp =
    process.env.SITE_VISIT_INCLUDE_CLIENT_IP !== 'false';
  const displayedClientIp = shouldIncludeClientIp
    ? process.env.SITE_VISIT_ANONYMIZE_CLIENT_IP === 'true'
      ? anonymizeClientIp(context.clientIp)
      : context.clientIp
    : null;
  const botSignal = classifyBotSignal(visit, context);

  const fields: DiscordField[] = [
    {
      name: '📄 Page',
      value: safeDiscordText(
        [`Path: ${normalizedPath(visit)}`, `Title: ${visit.title}`].join('\n')
      ),
      inline: false,
    },
    {
      name: '📍 Approx network location',
      value: buildLocationValue(context),
      inline: false,
    },
    {
      name: '🌐 Network',
      value: buildNetworkValue(context, displayedClientIp, network),
      inline: false,
    },
    {
      name: '🤖 Bot signal',
      value: safeDiscordText(
        `${botSignal.label}\nEvidence: ${botSignal.evidence}`
      ),
      inline: false,
    },
    {
      name: '📱 Device',
      value: buildDeviceValue(visit),
      inline: false,
    },
    {
      name: '🧭 Visit',
      value: buildVisitValue(visit),
      inline: false,
    },
    {
      name: '↩️ Referrer',
      value: safeDiscordText(visit.referrer || 'direct'),
      inline: false,
    },
  ];

  return {
    embeds: [
      {
        title: visit.firstVisit ? '🔔 New site visitor' : '🔄 Site pageview',
        description: safeDiscordText(visit.title, MAX_TITLE_LENGTH),
        color: visit.firstVisit ? 0xee3a43 : 0x2f80ed,
        fields,
        timestamp: visit.at,
        footer: {
          text: safeDiscordText(
            `host ${context.host} | reason ${visit.reason}`,
            180
          ),
        },
      },
    ],
    allowed_mentions: {
      parse: [],
    },
  };
}

export async function sendVisitWebhook(
  visit: ClientVisitPayload,
  context: VisitRequestContext,
  network: NetworkEnrichment = UNKNOWN_NETWORK_ENRICHMENT
) {
  const webhookUrl =
    configuredValue(process.env.SITE_VISIT_WEBHOOK_URL) ??
    configuredValue(process.env.DISCORD_WEBHOOK_URL);

  if (!webhookUrl) {
    console.warn('No pageview webhook URL is configured; pageview not sent.');
    return;
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildDiscordVisitPayload(visit, context, network)),
  });

  if (!response.ok) {
    throw new Error(`Visit webhook failed with HTTP ${response.status}`);
  }

  if (visit.reason.startsWith('codex-validation')) {
    console.log(
      `Pageview webhook validation succeeded for ${visit.path} with HTTP ${response.status}.`
    );
  }
}
