import { ActionType as Action, action } from 'typesafe-actions';
import { startAPIDiscovery } from '@console/dynamic-plugin-sdk/src/app/k8s/actions/apiDiscovery';
import { DiscoveryResources } from '../module/k8s/get-resources';

export {
  watchK8sObject,
  watchK8sList,
  stopK8sWatch,
} from '@console/dynamic-plugin-sdk/src/app/k8s/actions/k8s';

/* TODO: Remaining items moved by HAC-374 */
export enum ActionType {
  ReceivedResources = 'resources',
  GetResourcesInFlight = 'getResourcesInFlight',
}

export const receivedResources = (resources: DiscoveryResources) =>
  action(ActionType.ReceivedResources, { resources });
export const getResourcesInFlight = () => action(ActionType.GetResourcesInFlight);

const k8sActions = {
  receivedResources,
  getResourcesInFlight,
  startAPIDiscovery,
};

export type K8sAction = Action<typeof k8sActions>;
