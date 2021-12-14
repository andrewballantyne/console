import * as _ from 'lodash';
import { Dispatch } from 'redux';
import { getResourcesInFlight, receivedResources } from '@console/internal/actions/k8s'; // TODO: Moved by HAC-374
//
import { checkAccess } from '@console/internal/components/utils';
import { fetchURL } from '@console/internal/graphql/client'; // TODO: move GraphQL?
import { CustomResourceDefinitionModel } from '@console/internal/models';
import {
  cacheResources,
  DiscoveryResources,
  fetchSwagger,
  getModelExtensionMetadata,
  K8sKind,
  K8sResourceKind,
  K8sVerb,
  kindToAbbr,
  pluralizeKind,
} from '@console/internal/module/k8s';
import { pluginStore } from '@console/internal/plugins';
//
import { isModelMetadata, ModelMetadata } from '../../../extensions';
import { LoadedExtension } from '../../../types';
import { makeReduxID } from '../../../utils/k8s/hooks/k8s-watcher';
import { watchK8sList } from './k8s';

export const API_DISCOVERY_POLL_INTERVAL = 60000;
const POLLs = {};
const apiDiscovery = 'apiDiscovery';
const ADMIN_RESOURCES = new Set([
  'roles',
  'rolebindings',
  'clusterroles',
  'clusterrolebindings',
  'thirdpartyresources',
  'nodes',
  'secrets',
]);

type K8sEvent = { type: 'ADDED' | 'DELETED' | 'MODIFIED'; object: K8sResourceKind };

export type APIResourceList = {
  kind: 'APIResourceList';
  apiVersion: 'v1';
  groupVersion: string;
  resources?: {
    name: string;
    singularName?: string;
    namespaced?: boolean;
    kind: string;
    verbs: K8sVerb[];
    shortNames?: string[];
  }[];
};

const getResourcesInternal = () =>
  fetchURL('/apis').then((res) => {
    const groupVersionMap = res.groups.reduce(
      (acc, { name, versions, preferredVersion: { version } }) => {
        acc[name] = {
          versions: _.map(versions, 'version'),
          preferredVersion: version,
        };
        return acc;
      },
      {},
    );
    const all = _.flatten<string>(
      res.groups.map((group) => group.versions.map((version) => `/apis/${version.groupVersion}`)),
    )
      .concat(['/api/v1'])
      // TODO: Figure this out
      // eslint-disable-next-line promise/no-nesting
      .map((p) => fetchURL<APIResourceList>(p).catch((err) => err));

    // TODO: Figure this out
    // eslint-disable-next-line promise/no-nesting
    return Promise.all(all).then((data) => {
      const resourceSet = new Set<string>();
      const namespacedSet = new Set<string>();
      data.forEach(
        (d) =>
          d.resources &&
          d.resources.forEach(({ namespaced, name }) => {
            resourceSet.add(name);
            namespaced && namespacedSet.add(name);
          }),
      );
      const allResources = [...resourceSet].sort();

      const safeResources = [];
      const adminResources = [];

      const defineModels = (list: APIResourceList): K8sKind[] => {
        const metadataExtensions = pluginStore
          .getExtensionsInUse()
          .filter(isModelMetadata) as LoadedExtension<ModelMetadata>[];
        const groupVersionParts = list.groupVersion.split('/');
        const apiGroup = groupVersionParts.length > 1 ? groupVersionParts[0] : null;
        const apiVersion = groupVersionParts.length > 1 ? groupVersionParts[1] : list.groupVersion;
        return list.resources
          .filter(({ name }) => !name.includes('/'))
          .map(({ name, singularName, namespaced, kind, verbs, shortNames }) => {
            return {
              kind,
              namespaced,
              verbs,
              shortNames,
              label: kind,
              plural: name,
              apiVersion,
              abbr: kindToAbbr(kind),
              ...(apiGroup ? { apiGroup } : {}),
              labelPlural: pluralizeKind(kind),
              path: name,
              id: singularName,
              crd: true,
              ...getModelExtensionMetadata(metadataExtensions, apiGroup, apiVersion, kind),
            };
          });
      };

      const models = _.flatten(data.filter((d) => d.resources).map(defineModels));
      allResources.forEach((r) =>
        ADMIN_RESOURCES.has(r.split('/')[0]) ? adminResources.push(r) : safeResources.push(r),
      );
      const configResources = _.filter(
        models,
        (m) => m.apiGroup === 'config.openshift.io' && m.kind !== 'ClusterOperator',
      );
      const clusterOperatorConfigResources = _.filter(
        models,
        (m) => m.apiGroup === 'operator.openshift.io',
      );

      return {
        allResources,
        safeResources,
        adminResources,
        configResources,
        clusterOperatorConfigResources,
        namespacedSet,
        models,
        groupVersionMap,
      } as DiscoveryResources;
    });
  });

export const getResources = () => (dispatch: Dispatch) => {
  dispatch(getResourcesInFlight());

  // TODO: Finally is not "caught" if it breaks
  // eslint-disable-next-line promise/catch-or-return
  getResourcesInternal()
    .then((resources) => {
      // Cache the resources whenever discovery completes to improve console load times.
      cacheResources(resources);
      dispatch(receivedResources(resources));
    })
    // eslint-disable-next-line no-console
    .catch((err) => console.error(err))
    .finally(() => {
      setTimeout(fetchSwagger, 10000);
    });
};

export const startAPIDiscovery = () => (dispatch) => {
  const reduxID = makeReduxID(CustomResourceDefinitionModel, {});
  // TODO: catch a failure
  // eslint-disable-next-line promise/catch-or-return
  checkAccess({
    group: CustomResourceDefinitionModel.apiGroup,
    resource: CustomResourceDefinitionModel.plural,
    verb: 'list',
  }).then((res) => {
    if (res.status.allowed) {
      // eslint-disable-next-line no-console
      console.log('API discovery method: Watching');
      // Watch CRDs and dispatch refreshAPI action whenever an event is received
      dispatch(
        watchK8sList(
          reduxID,
          {},
          CustomResourceDefinitionModel,
          // Only re-run API discovery on added or removed CRDs.
          (_id: string, events: K8sEvent[]) =>
            events.some((e) => e.type !== 'MODIFIED') ? getResources() : _.noop,
        ),
      );
    } else {
      // eslint-disable-next-line no-console
      console.log('API discovery method: Polling');
      // Poll API discovery every 30 seconds since we can't watch CRDs
      dispatch(getResources());
      if (POLLs[apiDiscovery]) {
        clearTimeout(POLLs[apiDiscovery]);
        delete POLLs[apiDiscovery];
      }
      POLLs[apiDiscovery] = setTimeout(
        () => dispatch(startAPIDiscovery()),
        API_DISCOVERY_POLL_INTERVAL,
      );
    }
  });
};
