import * as _ from 'lodash-es';
import { plural } from 'pluralize';

import { K8sKind } from '../../module/k8s';
import { ModelMetadata } from '@console/dynamic-plugin-sdk';
import { LoadedExtension } from '@console/dynamic-plugin-sdk/src/types';
import { API_DISCOVERY_RESOURCES_LOCAL_STORAGE_KEY } from '@console/shared/src/constants';

const abbrBlacklist = ['ASS'];
export const kindToAbbr = (kind) => {
  const abbrKind = (kind.replace(/[^A-Z]/g, '') || kind.toUpperCase()).slice(0, 4);
  return abbrBlacklist.includes(abbrKind) ? abbrKind.slice(0, -1) : abbrKind;
};

export const cacheResources = (resources) =>
  new Promise<void>((resolve, reject) => {
    try {
      // Add the console version. We invalidate the cache when console version changes.
      const { consoleVersion } = window.SERVER_FLAGS;
      const versionedResources = _.assign({}, resources, { consoleVersion });
      localStorage.setItem(
        API_DISCOVERY_RESOURCES_LOCAL_STORAGE_KEY,
        JSON.stringify(versionedResources),
      );
      resolve();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error caching API resources in localStorage', e);
      reject(e);
    }
  });

export const getCachedResources = () =>
  new Promise<any>((resolve, reject) => {
    try {
      const resourcesJSON = localStorage.getItem(API_DISCOVERY_RESOURCES_LOCAL_STORAGE_KEY);

      // Clear cached resources after load as a safeguard. If there's any errors
      // with the content that prevents the console from working, the bad data
      // will not be loaded when the user refreshes the console. The cache will
      // be refreshed when discovery completes.
      localStorage.removeItem(API_DISCOVERY_RESOURCES_LOCAL_STORAGE_KEY);

      if (resourcesJSON) {
        const resources = JSON.parse(resourcesJSON);
        const { consoleVersion: currentVersion } = window.SERVER_FLAGS;
        const { consoleVersion: cachedVersion } = resources;
        if (cachedVersion !== currentVersion) {
          // eslint-disable-next-line no-console
          console.log(
            `Invalidating API discovery cache from earlier console version (current: ${currentVersion}, cached: ${cachedVersion})`,
          );
          resolve(null);
          return;
        }
        // eslint-disable-next-line no-console
        console.log('Loaded cached API resources from localStorage');
        resolve(resources);
        return;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error reading API resources from localStorage', e);
      reject(e);
    }

    resolve(null);
  });

export type DiscoveryResources = {
  adminResources: string[];
  allResources: string[];
  configResources: K8sKind[];
  clusterOperatorConfigResources: K8sKind[];
  models: K8sKind[];
  namespacedSet: Set<string>;
  safeResources: string[];
  groupVersionMap: {
    [key: string]: {
      versions: string[];
      preferredVersion: string;
    };
  };
};

export const pluralizeKind = (kind: string): string => {
  // Use startCase to separate words so the last can be pluralized but remove spaces so as not to humanize
  const pluralized = plural(_.startCase(kind)).replace(/\s+/g, '');
  // Handle special cases like DB -> DBs (instead of DBS).
  if (pluralized === `${kind}S`) {
    return `${kind}s`;
  }
  return pluralized;
};

export const getModelExtensionMetadata = (
  extensions: LoadedExtension<ModelMetadata>[],
  group: string,
  version?: string,
  kind?: string,
) => {
  const groupVersionKindMetadata = extensions
    .filter(
      ({ properties }) =>
        properties.model.group === group &&
        properties.model.kind === kind &&
        properties.model.version === version,
    )
    .map((e) => e.properties);
  const groupKindMetadata = extensions
    .filter(
      ({ properties }) =>
        properties.model.version == null &&
        properties.model.group === group &&
        properties.model.kind === kind,
    )
    .map((e) => e.properties);
  const groupMetadata = extensions
    .filter(
      ({ properties }) =>
        properties.model.kind == null &&
        properties.model.version == null &&
        properties.model.group === group,
    )
    .map((e) => e.properties);

  return _.omit(
    Object.assign({}, ...groupMetadata, ...groupKindMetadata, ...groupVersionKindMetadata),
    ['model'],
  );
};
