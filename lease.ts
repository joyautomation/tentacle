import { Result, createFail, createSuccess } from "@joyautomation/dark-matter";

interface LeaseSpec {
  holderIdentity?: string;
  leaseDurationSeconds?: number;
  leaseTransitions?: number;
  acquireTime?: Date;
  renewTime?: Date;
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
  leaseName: string;
  namespace?: string;
  identity: string;
  leaseDurationSeconds?: number;
  k8sApiUrl?: string;
}

interface LeaseState {
  config: LeaseConfig;
  currentLease?: Lease;
  isLeader: boolean;
  renewalTimer?: number;
}

const defaultConfig = {
  namespace: "default",
  leaseDurationSeconds: 5, // Reduced from 15s to 5s for faster failover
  k8sApiUrl: "http://localhost:8001",
};

const createLeaseState = (config: LeaseConfig): LeaseState => ({
  config: { ...defaultConfig, ...config },
  isLeader: false,
});

const getLease = async (state: LeaseState): Promise<Result<Lease | null>> => {
  const {
    config: { k8sApiUrl, namespace, leaseName },
  } = state;
  try {
    const response = await fetch(
      `${k8sApiUrl}/apis/coordination.k8s.io/v1/namespaces/${namespace}/leases/${leaseName}`
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

const createNewLease = async (state: LeaseState): Promise<Result<Lease>> => {
  const { config } = state;
  const lease: Lease = {
    apiVersion: "coordination.k8s.io/v1",
    kind: "Lease",
    metadata: {
      name: config.leaseName,
      namespace: config.namespace,
    },
    spec: {
      holderIdentity: config.identity,
      leaseDurationSeconds: config.leaseDurationSeconds,
      leaseTransitions: 0,
      acquireTime: new Date(),
      renewTime: new Date(),
    },
  };

  try {
    const response = await fetch(
      `${config.k8sApiUrl}/apis/coordination.k8s.io/v1/namespaces/${config.namespace}/leases`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(lease),
      }
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

  const updatedLease = {
    ...currentLease,
    spec: {
      ...currentLease.spec,
      renewTime: new Date(),
    },
  };

  try {
    const response = await fetch(
      `${config.k8sApiUrl}/apis/coordination.k8s.io/v1/namespaces/${config.namespace}/leases/${config.leaseName}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedLease),
      }
    );

    if (!response.ok) {
      return createFail({
        error: `Failed to update lease: ${response.statusText}`,
        cause: await response.text(),
      });
    }

    return createSuccess(await response.json());
  } catch (error) {
    return createFail({
      error: "Failed to update lease",
      cause: error,
    });
  }
};

const startLeaseRenewal = (
  state: LeaseState,
  onLeadershipLost: () => void
): LeaseState => {
  if (state.renewalTimer) {
    clearInterval(state.renewalTimer);
  }

  // Renew at 1/4 of the lease duration for more frequent checks
  const renewalInterval = (state.config.leaseDurationSeconds! * 1000) / 4;
  const renewalTimer = setInterval(async () => {
    if (state.isLeader) {
      const updateResult = await updateLease(state);
      if (!updateResult.success) {
        console.error("Failed to renew lease:", updateResult);
        onLeadershipLost();
      }
    }
  }, renewalInterval);

  return { ...state, renewalTimer };
};

export const tryAcquireLeadership = async (
  state: LeaseState,
  onLeadershipLost: () => void
): Promise<Result<[boolean, LeaseState]>> => {
  const leaseResult = await getLease(state);
  if (!leaseResult.success) {
    return createFail(leaseResult);
  }

  const lease = leaseResult.output;
  if (!lease) {
    // No existing lease, try to create one
    const createResult = await createNewLease(state);
    if (!createResult.success) {
      return createFail(createResult);
    }
    const newState = {
      ...state,
      currentLease: createResult.output,
      isLeader: true,
    };
    return createSuccess([true, startLeaseRenewal(newState, onLeadershipLost)]);
  }

  // Check if the existing lease is expired
  const now = new Date();
  const renewTime = new Date(lease.spec.renewTime!);
  const expiryTime = new Date(
    renewTime.getTime() + lease.spec.leaseDurationSeconds! * 1000
  );

  if (now > expiryTime || lease.spec.holderIdentity === state.config.identity) {
    // Lease is expired or we already hold it, try to take it
    const updateResult = await updateLease({ ...state, currentLease: lease });
    if (!updateResult.success) {
      return createFail(updateResult);
    }
    const newState = {
      ...state,
      currentLease: updateResult.output,
      isLeader: true,
    };
    return createSuccess([true, startLeaseRenewal(newState, onLeadershipLost)]);
  }

  return createSuccess([false, { ...state, isLeader: false }]);
};

export const releaseLease = (state: LeaseState): LeaseState => {
  if (state.renewalTimer) {
    clearInterval(state.renewalTimer);
  }
  return { ...state, isLeader: false, renewalTimer: undefined };
};

export const isLeader = (state: LeaseState): boolean => state.isLeader;

export const initializeLease = (config: LeaseConfig): LeaseState =>
  createLeaseState(config);
