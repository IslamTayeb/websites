import {
  resolveNetworkEnrichment,
  UNKNOWN_NETWORK_ENRICHMENT,
  type NetworkEnrichment,
} from './network-enrichment.js';
import {
  sendVisitWebhook,
  type ClientVisitPayload,
  type VisitRequestContext,
} from './visit-events.js';
import {
  persistVisit,
  type PersistVisitResult,
  type VisitStorageInput,
} from './visit-storage.js';

type VisitProcessingDependencies = {
  resolveNetwork: (clientIp: string) => Promise<NetworkEnrichment>;
  persist: (input: VisitStorageInput) => Promise<PersistVisitResult>;
  sendWebhook: (
    visit: ClientVisitPayload,
    context: VisitRequestContext,
    network: NetworkEnrichment
  ) => Promise<void>;
  reportError: (message: string, error: unknown) => void;
};

type ProcessVisitOptions = {
  serverAt?: Date | string;
  dependencies?: Partial<VisitProcessingDependencies>;
};

type ProcessVisitResult = {
  network: NetworkEnrichment;
  persistence: PromiseSettledResult<PersistVisitResult>;
  webhook: PromiseSettledResult<void>;
};

const defaultDependencies: VisitProcessingDependencies = {
  resolveNetwork: resolveNetworkEnrichment,
  persist: persistVisit,
  sendWebhook: sendVisitWebhook,
  reportError(message, error) {
    console.error(message, error);
  },
};

export async function processVisitEvent(
  visit: ClientVisitPayload,
  context: VisitRequestContext,
  options: ProcessVisitOptions = {}
): Promise<ProcessVisitResult> {
  const dependencies = {
    ...defaultDependencies,
    ...options.dependencies,
  };
  let network = UNKNOWN_NETWORK_ENRICHMENT;

  try {
    network = await dependencies.resolveNetwork(context.clientIp);
  } catch (error) {
    dependencies.reportError(
      'Failed to resolve pageview network ownership.',
      error
    );
  }

  const [persistence, webhook] = await Promise.allSettled([
    dependencies.persist({
      visit,
      context,
      network,
      serverAt: options.serverAt,
    }),
    dependencies.sendWebhook(visit, context, network),
  ]);

  if (persistence.status === 'rejected') {
    dependencies.reportError(
      'Failed to persist private pageview history.',
      persistence.reason
    );
  }

  if (webhook.status === 'rejected') {
    dependencies.reportError('Failed to send pageview event.', webhook.reason);
  }

  return { network, persistence, webhook };
}
