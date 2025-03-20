import { createFail, createSuccess, Result } from "@joyautomation/dark-matter";
import { logs } from "../log.ts";
const { main: log } = logs;

interface LeaseSpec {
  holderIdentity?: string;
  leaseDurationSeconds?: number;
  leaseTransitions?: number;
  acquireTime?: string;
  renewTime?: string;
}

interface Lease {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
  };
  spec: LeaseSpec;
}

interface LeaseConfig {
  lease: string;
  namespace?: string;
  identity: string;
  leaseDurationSeconds?: number;
  k8sApiUrl?: string;
}

export interface LeaseState {
  config: LeaseConfig;
  currentLease?: Lease;
  isLeader: boolean;
  renewalTimer?: number;
  acquisitionTimer?: number;
  retryCount: number;
  currentLeaderId?: string;
  leadershipEventListeners: {
    onLeader: Set<() => void>;
    onLeaderLoss: Set<() => void>;
  };
}

const defaultConfig = {
  namespace: "default",
  leaseDurationSeconds: 5, // Reduced from 15s to 5s for faster failover
  k8sApiUrl: "https://kubernetes.default.svc",
};

const createLeaseState = (config: LeaseConfig): LeaseState => ({
  config: { ...defaultConfig, ...config },
  isLeader: false,
  retryCount: 0,
  currentLeaderId: undefined,
  leadershipEventListeners: {
    onLeader: new Set(),
    onLeaderLoss: new Set(),
  },
});

const client = Deno.createHttpClient({
  caCerts: [
    await Deno.readTextFile(
      "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt",
    ),
  ],
});

const getK8sHeaders = async (): Promise<Headers> => {
  const headers = new Headers({
    "Content-Type": "application/json",
  });

  try {
    const token = await Deno.readTextFile(
      "/var/run/secrets/kubernetes.io/serviceaccount/token",
    );
    headers.append("Authorization", `Bearer ${token}`);
  } catch (error) {
    log.warn("Could not read service account token:", error);
  }

  return headers;
};

const getLease = async (state: LeaseState): Promise<Result<Lease | null>> => {
  const {
    config: { k8sApiUrl, namespace, lease: leaseName },
  } = state;
  try {
    const response = await fetch(
      `${k8sApiUrl}/apis/coordination.k8s.io/v1/namespaces/${namespace}/leases/${leaseName}`,
      {
        headers: await getK8sHeaders(),
        client,
      },
    );
    if (response.status === 404) {
      return createSuccess(null);
    }
    if (!response.ok) {
      return createFail({
        error: `Failed to get lease: ${response.statusText}`,
        cause: await response.text(),
      });
    }
    return createSuccess(await response.json());
  } catch (error) {
    return createFail({
      error: "Failed to get lease",
      cause: error,
    });
  }
};

const formatK8sDate = (date: Date): string =>
  date.toISOString().replace(/\.\d{3}Z$/, ".000000Z");

const createNewLease = async (state: LeaseState): Promise<Result<Lease>> => {
  const { config } = state;
  const now = new Date();
  const lease: Lease = {
    apiVersion: "coordination.k8s.io/v1",
    kind: "Lease",
    metadata: {
      name: config.lease,
      namespace: config.namespace,
    },
    spec: {
      holderIdentity: config.identity,
      leaseDurationSeconds: config.leaseDurationSeconds,
      leaseTransitions: 0,
      acquireTime: formatK8sDate(now),
      renewTime: formatK8sDate(now),
    },
  };

  try {
    const response = await fetch(
      `${config.k8sApiUrl}/apis/coordination.k8s.io/v1/namespaces/${config.namespace}/leases`,
      {
        method: "POST",
        headers: await getK8sHeaders(),
        body: JSON.stringify(lease),
        client,
      },
    );

    if (!response.ok) {
      return createFail({
        error: `Failed to create lease: ${response.statusText}`,
        cause: await response.text(),
      });
    }

    return createSuccess(await response.json());
  } catch (error) {
    return createFail({
      error: "Failed to create lease",
      cause: error,
    });
  }
};

const updateLease = async (state: LeaseState): Promise<Result<Lease>> => {
  const { config, currentLease } = state;
  if (!currentLease) {
    return createFail({
      error: "No lease object to update",
    });
  }

  try {
    // Get the latest version first
    const getResult = await getLease(state);
    if (!getResult.success) {
      return createFail({
        error: "Failed to get latest lease before update",
        cause: getResult.error,
      });
    }

    const latestLease = getResult.output;
    if (!latestLease) {
      return createFail("Lease no longer exists");
    }

    const updatedLease = {
      apiVersion: latestLease.apiVersion,
      kind: latestLease.kind,
      metadata: {
        ...latestLease.metadata,
        name: config.lease,
        namespace: config.namespace,
      },
      spec: {
        ...latestLease.spec,
        holderIdentity: config.identity,
        renewTime: formatK8sDate(new Date()),
      },
    };

    const response = await fetch(
      `${config.k8sApiUrl}/apis/coordination.k8s.io/v1/namespaces/${config.namespace}/leases/${config.lease}`,
      {
        method: "PUT",
        headers: await getK8sHeaders(),
        body: JSON.stringify(updatedLease),
        client,
      },
    );

    if (response.status === 409) {
      // If we get a conflict, try one more time
      return updateLease({ ...state, currentLease: latestLease });
    }

    if (!response.ok) {
      const errorText = await response.text();
      return createFail({
        error: `Failed to update lease: ${response.statusText}`,
        cause: errorText,
      });
    }

    const updatedLeaseResponse = await response.json();
    return createSuccess(updatedLeaseResponse);
  } catch (error) {
    return createFail({
      error: "Failed to update lease",
      cause: error,
    });
  }
};

const startLeaseRenewal = (state: LeaseState): LeaseState => {
  if (state.renewalTimer) {
    clearInterval(state.renewalTimer);
  }

  log.info(`Starting lease renewal for ${state.config.identity}`);

  const renewalInterval = (state.config.leaseDurationSeconds! * 1000) / 4;
  const renewalTimer = setInterval(async () => {
    if (state.isLeader) {
      const updateResult = await updateLease(state);
      if (!updateResult.success) {
        log.error("Failed to renew lease:", updateResult);
        log.info(
          `${state.config.identity} lost leadership due to renewal failure`,
        );
        handleLeadershipLoss(state);
      }
    }
  }, renewalInterval);

  return { ...state, renewalTimer };
};

const handleLeadershipGain = (state: LeaseState) => {
  state.leadershipEventListeners.onLeader.forEach((listener) => listener());
};

const handleLeadershipLoss = (state: LeaseState) => {
  state.isLeader = false;
  state.leadershipEventListeners.onLeaderLoss.forEach((listener) => listener());
};

const startLeaseAcquisition = (
  state: LeaseState,
  onLeadershipLost: () => void,
): LeaseState => {
  if (state.acquisitionTimer) {
    clearInterval(state.acquisitionTimer);
  }

  // Directly modify the state object to maintain the reference
  state.acquisitionTimer = setInterval(async () => {
    if (!state.isLeader) {
      state.retryCount++;
      const result = await tryAcquireLeadership(state, onLeadershipLost);
      if (result.success) {
        const [acquired, newState] = result.output;
        if (acquired) {
          // Update the state reference when we become leader
          Object.assign(state, { ...newState, retryCount: 0 });
        }
      }
    }
  }, 2000);

  return state;
};

export const tryAcquireLeadership = async (
  state: LeaseState,
  onLeadershipLost: () => void,
): Promise<Result<[boolean, LeaseState]>> => {
  // log.info(`${state.config.identity} attempting to acquire leadership`);
  const leaseResult = await getLease(state);
  if (!leaseResult.success) {
    log.error(
      `${state.config.identity} failed to get lease:`,
      leaseResult.error,
    );
    return createFail(leaseResult);
  }

  const lease = leaseResult.output;
  if (!lease) {
    log.info(
      `No existing lease found, ${state.config.identity} creating new lease`,
    );
    // No existing lease, try to create one
    const createResult = await createNewLease(state);
    if (!createResult.success) {
      log.error(
        `${state.config.identity} failed to create lease:`,
        createResult.error,
      );
      return createFail(createResult);
    }
    const newState = {
      ...state,
      currentLease: createResult.output,
      isLeader: true,
      currentLeaderId: state.config.identity,
    };
    log.info(
      `${state.config.identity} successfully acquired leadership (new lease)`,
    );
    const finalState = startLeaseRenewal(newState);
    handleLeadershipGain(finalState);
    return createSuccess([true, finalState]);
  }

  // Update current leader from existing lease
  state.currentLeaderId = lease.spec.holderIdentity;

  // Check if the existing lease is expired
  const now = new Date();
  const renewTime = new Date(lease.spec.renewTime!);
  const expiryTime = new Date(
    renewTime.getTime() + lease.spec.leaseDurationSeconds! * 1000,
  );

  if (now > expiryTime || lease.spec.holderIdentity === state.config.identity) {
    log.info(
      `${state.config.identity} attempting to take ${
        now > expiryTime ? "expired" : "existing"
      } lease from ${lease.spec.holderIdentity}`,
    );
    // Lease is expired or we already hold it, try to take it
    const updateResult = await updateLease({ ...state, currentLease: lease });
    if (!updateResult.success) {
      log.error(
        `${state.config.identity} failed to update lease:`,
        updateResult.error,
      );
      return createFail(updateResult);
    }
    const newState = {
      ...state,
      currentLease: updateResult.output,
      isLeader: true,
      currentLeaderId: state.config.identity,
    };
    log.info(`${state.config.identity} successfully acquired leadership`);
    const finalState = startLeaseRenewal(newState);
    handleLeadershipGain(finalState);
    return createSuccess([true, finalState]);
  }

  if (state.retryCount === 1) {
    log.info(
      `${state.config.identity} could not acquire leadership, current leader is ${lease.spec.holderIdentity}`,
    );
  }
  return createSuccess([false, { ...state, isLeader: false }]);
};

export const releaseLease = (state: LeaseState): LeaseState => {
  if (state.renewalTimer) {
    clearInterval(state.renewalTimer);
  }
  if (state.acquisitionTimer) {
    clearInterval(state.acquisitionTimer);
  }
  state.leadershipEventListeners.onLeader.clear();
  state.leadershipEventListeners.onLeaderLoss.clear();
  return {
    ...state,
    isLeader: false,
    renewalTimer: undefined,
    acquisitionTimer: undefined,
  };
};

export const isLeader = (state: LeaseState): boolean => state.isLeader;

export const addLeadershipListener = (
  state: LeaseState,
  type: "onLeader" | "onLeaderLoss",
  listener: () => void,
) => {
  state.leadershipEventListeners[type].add(listener);
  // Return cleanup function
  return () => state.leadershipEventListeners[type].delete(listener);
};

export const initializeLease = (config: LeaseConfig): LeaseState => {
  const state = createLeaseState(config);
  return startLeaseAcquisition(state, () => handleLeadershipLoss(state));
};
