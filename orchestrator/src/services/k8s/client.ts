import * as k8s from "@kubernetes/client-node";
import config from "../../config";

const kc = new k8s.KubeConfig();
try {
  kc.loadFromCluster();
} catch (e) {
  if (config.K8S_CONTEXT) {
    kc.loadFromDefault();
    kc.setCurrentContext(config.K8S_CONTEXT);
  } else {
    kc.loadFromDefault();
  }
}

export const coreApi = kc.makeApiClient(k8s.CoreV1Api);
export const appsApi = kc.makeApiClient(k8s.AppsV1Api);
export const networkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
