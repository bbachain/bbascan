import React from "react";
import { Connection, EpochInfo, EpochSchedule } from "@solana/web3.js";
import { useQuery } from "../utils/url";
import { useHistory, useLocation } from "react-router-dom";
import { reportError } from "utils/sentry";
import { localStorageIsAvailable } from "utils";

export enum ClusterStatus {
  Connected,
  Connecting,
  Failure,
}

export enum Cluster {
  MainnetBeta,
  Testnet,
  Custom,
}

export const CLUSTERS = [Cluster.MainnetBeta, Cluster.Testnet, Cluster.Custom];

export function clusterSlug(cluster: Cluster): string {
  switch (cluster) {
    case Cluster.MainnetBeta:
      return "mainnet-beta";
    case Cluster.Testnet:
      return "testnet";
    case Cluster.Custom:
      return "custom";
  }
}

export function clusterName(cluster: Cluster): string {
  switch (cluster) {
    case Cluster.MainnetBeta:
      return "Mainnet Beta";
    case Cluster.Testnet:
      return "Testnet";
    case Cluster.Custom:
      return "Custom";
  }
}

export const MAINNET_URL = "https://api-mainnet.bbachain.com";
export const TESTNET_URL = "https://api-testnet.bbachain.com";

export function clusterUrl(cluster: Cluster, customUrl: string): string {
  const modifyUrl = (url: string): string => {
    if (window.location.hostname === "localhost") {
      return url;
    } else {
      return url.replace("api", "explorer-api");
    }
  };

  switch (cluster) {
    case Cluster.MainnetBeta:
      return process.env.REACT_APP_MAINNET_RPC_URL ?? modifyUrl(MAINNET_URL);
    case Cluster.Testnet:
      return process.env.REACT_APP_TESTNET_RPC_URL ?? modifyUrl(TESTNET_URL);
    case Cluster.Custom:
      return customUrl;
  }
}

export const DEFAULT_CLUSTER = Cluster.MainnetBeta;
const DEFAULT_CUSTOM_URL = "http://localhost:8899";

type Action = State;
interface State {
  cluster: Cluster;
  customUrl: string;
  clusterInfo?: ClusterInfo;
  status: ClusterStatus;
}

interface ClusterInfo {
  firstAvailableBlock: number;
  epochSchedule: EpochSchedule;
  epochInfo: EpochInfo;
  genesisHash: string;
}

type Dispatch = (action: Action) => void;

function clusterReducer(state: State, action: Action): State {
  switch (action.status) {
    case ClusterStatus.Connected:
    case ClusterStatus.Failure: {
      if (
        state.cluster !== action.cluster ||
        state.customUrl !== action.customUrl
      )
        return state;
      return action;
    }
    case ClusterStatus.Connecting: {
      return action;
    }
  }
}

function parseQuery(query: URLSearchParams): Cluster {
  const clusterParam = query.get("cluster");
  switch (clusterParam) {
    case "custom":
      return Cluster.Custom;
    case "testnet":
      return Cluster.Testnet;
    case "mainnet-beta":
    default:
      return Cluster.MainnetBeta;
  }
}

type SetShowModal = React.Dispatch<React.SetStateAction<boolean>>;
const ModalContext = React.createContext<[boolean, SetShowModal] | undefined>(
  undefined
);
const StateContext = React.createContext<State | undefined>(undefined);
const DispatchContext = React.createContext<Dispatch | undefined>(undefined);

type ClusterProviderProps = { children: React.ReactNode };
export function ClusterProvider({ children }: ClusterProviderProps) {
  const [state, dispatch] = React.useReducer(clusterReducer, {
    cluster: DEFAULT_CLUSTER,
    customUrl: DEFAULT_CUSTOM_URL,
    status: ClusterStatus.Connecting,
  });
  const [showModal, setShowModal] = React.useState(false);
  const query = useQuery();
  const cluster = parseQuery(query);
  const enableCustomUrl =
    localStorageIsAvailable() &&
    localStorage.getItem("enableCustomUrl") !== null;
  const customUrl =
    (enableCustomUrl && query.get("customUrl")) || state.customUrl;
  const history = useHistory();
  const location = useLocation();

  // Remove customUrl param if dev setting is disabled
  React.useEffect(() => {
    if (!enableCustomUrl && query.has("customUrl")) {
      query.delete("customUrl");
      history.push({ ...location, search: query.toString() });
    }
  }, [enableCustomUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reconnect to cluster when params change
  React.useEffect(() => {
    updateCluster(dispatch, cluster, customUrl);
  }, [cluster, customUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        <ModalContext.Provider value={[showModal, setShowModal]}>
          {children}
        </ModalContext.Provider>
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

async function updateCluster(
  dispatch: Dispatch,
  cluster: Cluster,
  customUrl: string
) {
  dispatch({
    status: ClusterStatus.Connecting,
    cluster,
    customUrl,
  });

  try {
    // validate url
    new URL(customUrl);

    const connection = new Connection(clusterUrl(cluster, customUrl));
    const [firstAvailableBlock, epochSchedule, epochInfo, genesisHash] =
      await Promise.all([
        connection.getFirstAvailableBlock(),
        connection.getEpochSchedule(),
        connection.getEpochInfo(),
        connection.getGenesisHash(),
      ]);

    dispatch({
      status: ClusterStatus.Connected,
      cluster,
      customUrl,
      clusterInfo: {
        firstAvailableBlock,
        genesisHash,
        epochSchedule,
        epochInfo,
      },
    });
  } catch (error) {
    if (cluster !== Cluster.Custom) {
      reportError(error, { clusterUrl: clusterUrl(cluster, customUrl) });
    }
    dispatch({
      status: ClusterStatus.Failure,
      cluster,
      customUrl,
    });
  }
}

export function useUpdateCustomUrl() {
  const dispatch = React.useContext(DispatchContext);
  if (!dispatch) {
    throw new Error(`useUpdateCustomUrl must be used within a ClusterProvider`);
  }

  return (customUrl: string) => {
    updateCluster(dispatch, Cluster.Custom, customUrl);
  };
}

export function useCluster() {
  const context = React.useContext(StateContext);
  if (!context) {
    throw new Error(`useCluster must be used within a ClusterProvider`);
  }
  return {
    ...context,
    url: clusterUrl(context.cluster, context.customUrl),
    name: clusterName(context.cluster),
  };
}

export function useClusterModal() {
  const context = React.useContext(ModalContext);
  if (!context) {
    throw new Error(`useClusterModal must be used within a ClusterProvider`);
  }
  return context;
}
