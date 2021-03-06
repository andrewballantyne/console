import { CatalogItemProvider, CatalogItemType, Plugin } from '@console/plugin-sdk';
import { FLAG_OPENSHIFT_HELM } from '../const';
import { helmChartProvider } from './providers';

export type HelmCatalogConsumedExtensions = CatalogItemProvider | CatalogItemType;

export const helmCatalogPlugin: Plugin<HelmCatalogConsumedExtensions> = [
  {
    type: 'Catalog/ItemType',
    properties: {
      type: 'HelmChart',
      // t('helm-plugin~Helm Charts')
      title: '%helm-plugin~Helm Charts%',
      // t('helm-plugin~Browse for charts that help manage complex installations and upgrades. Cluster administrators can customize the content made available in the catalog.')
      catalogDescription:
        '%helm-plugin~Browse for charts that help manage complex installations and upgrades. Cluster administrators can customize the content made available in the catalog.%',
      // t('helm-plugin~**Helm Charts** are packages for deploying an Application or components of a larger Application.')
      typeDescription:
        '%helm-plugin~**Helm Charts** are packages for deploying an Application or components of a larger Application.%',
      filters: [
        {
          label: 'Chart Repositories',
          attribute: 'chartRepositoryTitle',
        },
      ],
    },
    flags: {
      required: [FLAG_OPENSHIFT_HELM],
    },
  },
  {
    type: 'Catalog/ItemProvider',
    properties: {
      type: 'HelmChart',
      provider: helmChartProvider,
    },
    flags: {
      required: [FLAG_OPENSHIFT_HELM],
    },
  },
];
