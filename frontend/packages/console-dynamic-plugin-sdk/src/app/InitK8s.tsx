import * as React from 'react';
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore: FIXME missing exports due to out-of-sync @types/react-redux version
import { useStore } from 'react-redux';
import { receivedResources } from '@console/internal/actions/k8s';
import { getCachedResources } from '@console/internal/module/k8s';
import { startAPIDiscovery } from './k8s/actions/apiDiscovery';

type InitK8sProps = {
  children: React.ReactNode;
};

const InitK8s: React.FC<InitK8sProps> = ({ children }) => {
  // TODO: Manage internal SDK store
  const store = useStore();

  // Load cached API resources from localStorage to speed up page load.
  getCachedResources()
    .then((resources) => {
      if (resources) {
        store.dispatch(receivedResources(resources));
      }
      // Still perform discovery to refresh the cache.
      store.dispatch(startAPIDiscovery());
    })
    .catch(() => store.dispatch(startAPIDiscovery()));

  return <>{children}</>;
};

export default InitK8s;
