// Vercel Function behind /api/pageview. The site itself is static; this is
// its only server code. Work after the response runs through waitUntil.
import { waitUntil } from '@vercel/functions';
import {
  buildVisitRequestContext,
  normalizeVisitPayload,
  shouldAcceptVisitRequest,
  shouldSkipVisitRequest,
} from '../lib/visit-events.js';
import { processVisitEvent } from '../lib/visit-processing.js';

const noStoreHeaders = {
  'Cache-Control': 'no-store',
};

export async function POST(request: Request) {
  if (process.env.SITE_VISIT_EVENTS_ENABLED === 'false') {
    return new Response(null, { status: 204, headers: noStoreHeaders });
  }

  if (!shouldAcceptVisitRequest(request)) {
    return new Response(null, { status: 403, headers: noStoreHeaders });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400, headers: noStoreHeaders });
  }

  const visit = normalizeVisitPayload(body);

  if (!visit) {
    return new Response(null, { status: 400, headers: noStoreHeaders });
  }

  const context = buildVisitRequestContext(request);

  if (shouldSkipVisitRequest(request, context.clientIp)) {
    return new Response(null, { status: 204, headers: noStoreHeaders });
  }

  const serverAt = new Date();

  waitUntil(processVisitEvent(visit, context, { serverAt }));

  return new Response(null, { status: 204, headers: noStoreHeaders });
}
