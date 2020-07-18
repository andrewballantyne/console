import * as _ from 'lodash';
import {
  apiVersionForReference,
  isGroupVersionKind,
  K8sResourceKind,
  kindForReference,
  referenceFor,
  referenceForModel,
} from '@console/internal/module/k8s';
import { WatchK8sResources } from '@console/internal/components/utils/k8s-watch-hook';
import { ClusterServiceVersionModel } from '@console/operator-lifecycle-manager/src';
import { isKnativeServing } from '@console/shared';
import { Model, EdgeModel, NodeModel } from '@patternfly/react-topology';
import { getImageForIconClass } from '@console/internal/components/catalog/catalog-item-icon';
import {
  TYPE_EVENT_SOURCE,
  TYPE_KNATIVE_REVISION,
} from '@console/knative-plugin/src/topology/const';
import { edgesFromAnnotations } from '../../../utils/application-utils';
import { tknPipelineAndPipelineRunsWatchResources } from '../../../utils/pipeline-plugin-utils';
import {
  TopologyDataObject,
  TopologyOverviewItem,
  ConnectsToData,
  TopologyDataResources,
  TopologyDataModelDepicted,
} from '../topology-types';
import {
  TYPE_APPLICATION_GROUP,
  TYPE_CONNECTS_TO,
  NODE_WIDTH,
  NODE_HEIGHT,
  NODE_PADDING,
  GROUP_WIDTH,
  GROUP_HEIGHT,
  GROUP_PADDING,
} from '../components/const';
import { getRoutesURL, getTopologyResourceObject, WORKLOAD_TYPES } from '../topology-utils';

export const dataObjectFromModel = (node: NodeModel): TopologyDataObject => {
  return {
    id: node.id,
    name: node.label,
    type: node.type,
    resources: null,
    data: null,
  };
};

/**
 * create all data that need to be shown on a topology data
 */
export const createTopologyNodeData = (
  dc: TopologyOverviewItem,
  type: string,
  defaultIcon: string,
  operatorBackedService: boolean = false,
): TopologyDataObject => {
  const {
    obj: deploymentConfig,
    current,
    previous,
    isRollingOut,
    buildConfigs,
    pipelines = [],
    pipelineRuns = [],
  } = dc;
  const dcUID = _.get(deploymentConfig, 'metadata.uid');
  const deploymentsLabels = _.get(deploymentConfig, 'metadata.labels', {});
  const deploymentsAnnotations = _.get(deploymentConfig, 'metadata.annotations', {});

  const builderImageIcon =
    getImageForIconClass(`icon-${deploymentsLabels['app.openshift.io/runtime']}`) ||
    getImageForIconClass(`icon-${deploymentsLabels['app.kubernetes.io/name']}`);
  return {
    id: dcUID,
    name:
      _.get(deploymentConfig, 'metadata.name') || deploymentsLabels['app.kubernetes.io/instance'],
    type,
    resources: { ...dc, isOperatorBackedService: operatorBackedService },
    pods: dc.pods,
    data: {
      url: getRoutesURL(dc),
      kind: referenceFor(deploymentConfig),
      editURL: deploymentsAnnotations['app.openshift.io/edit-url'],
      vcsURI: deploymentsAnnotations['app.openshift.io/vcs-uri'],
      builderImage: builderImageIcon || defaultIcon,
      isKnativeResource:
        type && (type === TYPE_EVENT_SOURCE || type === TYPE_KNATIVE_REVISION)
          ? true
          : isKnativeServing(deploymentConfig, 'metadata.labels'),
      build: buildConfigs?.[0]?.builds?.[0],
      connectedPipeline: {
        pipeline: pipelines[0],
        pipelineRuns,
      },
      donutStatus: {
        pods: dc.pods,
        current,
        previous,
        isRollingOut,
        dc: deploymentConfig,
      },
    },
  };
};

/**
 * create node data for graphs
 */
export const getTopologyNodeItem = (
  dc: K8sResourceKind,
  type: string,
  data: any,
  nodeProps?: Omit<NodeModel, 'type' | 'data' | 'children' | 'id' | 'label'>,
  children?: string[],
): NodeModel => {
  const uid = _.get(dc, ['metadata', 'uid']);
  const name = _.get(dc, ['metadata', 'name']);
  const label = _.get(dc, ['metadata', 'labels', 'app.openshift.io/instance']);

  return {
    id: uid,
    type,
    label: label || name,
    data,
    ...(children && children.length && { children }),
    ...(nodeProps || {}),
  };
};

export const WorkloadModelProps = {
  width: NODE_WIDTH,
  height: NODE_HEIGHT,
  group: false,
  visible: true,
  style: {
    padding: NODE_PADDING,
  },
};

/**
 * create edge data for graph
 */
export const getTopologyEdgeItems = (
  dc: K8sResourceKind,
  resources: K8sResourceKind[],
): EdgeModel[] => {
  const annotations = _.get(dc, 'metadata.annotations');
  const edges = [];

  _.forEach(edgesFromAnnotations(annotations), (edge: string | ConnectsToData) => {
    // handles multiple edges
    const targetNode = _.get(
      _.find(resources, (deployment) => {
        let name;
        if (typeof edge === 'string') {
          name =
            deployment.metadata?.labels?.['app.kubernetes.io/instance'] ??
            deployment.metadata?.name;
          return name === edge;
        }
        name = deployment.metadata?.name;
        const { apiVersion: edgeApiVersion, kind: edgeKind, name: edgeName } = edge;
        const { kind, apiVersion } = deployment;
        let edgeExists = name === edgeName && kind === edgeKind;
        if (apiVersion) {
          edgeExists = edgeExists && apiVersion === edgeApiVersion;
        }
        return edgeExists;
      }),
      ['metadata', 'uid'],
    );
    const uid = _.get(dc, ['metadata', 'uid']);
    if (targetNode) {
      edges.push({
        id: `${uid}_${targetNode}`,
        type: TYPE_CONNECTS_TO,
        source: uid,
        target: targetNode,
      });
    }
  });

  return edges;
};

/**
 * create groups data for graph
 */
export const getTopologyGroupItems = (dc: K8sResourceKind): NodeModel => {
  const groupName = _.get(dc, ['metadata', 'labels', 'app.kubernetes.io/part-of']);
  if (!groupName) {
    return null;
  }

  return {
    id: `group:${groupName}`,
    type: TYPE_APPLICATION_GROUP,
    group: true,
    label: groupName,
    children: [_.get(dc, ['metadata', 'uid'])],
    width: GROUP_WIDTH,
    height: GROUP_HEIGHT,
    data: {},
    visible: true,
    collapsed: false,
    style: {
      padding: GROUP_PADDING,
    },
  };
};

const mergeGroupData = (newGroup: NodeModel, existingGroup: NodeModel): void => {
  if (!existingGroup.data?.groupResources && !newGroup.data?.groupResources) {
    return;
  }

  if (!existingGroup.data?.groupResources) {
    existingGroup.data.groupResources = [];
  }
  if (newGroup?.data?.groupResources) {
    newGroup.data.groupResources.forEach((obj) => {
      if (!existingGroup.data.groupResources.includes(obj)) {
        existingGroup.data.groupResources.push(obj);
      }
    });
  }
};

export const mergeGroup = (newGroup: NodeModel, existingGroups: NodeModel[]): void => {
  if (!newGroup) {
    return;
  }

  // find and add the groups
  const existingGroup = existingGroups.find((g) => g.group && g.id === newGroup.id);
  if (!existingGroup) {
    existingGroups.push(newGroup);
  } else {
    newGroup.children.forEach((id) => {
      if (!existingGroup.children.includes(id)) {
        existingGroup.children.push(id);
      }
      mergeGroupData(newGroup, existingGroup);
    });
  }
};

export const mergeGroups = (newGroups: NodeModel[], existingGroups: NodeModel[]): void => {
  if (!newGroups || !newGroups.length) {
    return;
  }
  newGroups.forEach((newGroup) => {
    mergeGroup(newGroup, existingGroups);
  });
};

export const addToTopologyDataModel = (
  newModel: Model,
  graphModel: Model,
  dataModelDepicters: TopologyDataModelDepicted[] = [],
) => {
  graphModel.edges.push(...newModel.edges);
  graphModel.nodes.push(
    ...newModel.nodes.filter(
      (n) =>
        !n.group &&
        !graphModel.nodes.find((existing) => {
          if (n.id === existing.id) {
            return true;
          }
          return !!dataModelDepicters.find((depicter) =>
            depicter(getTopologyResourceObject(n.data), graphModel),
          );
        }),
    ),
  );
  mergeGroups(
    newModel.nodes.filter((n) => n.group),
    graphModel.nodes,
  );
};

/**
 * Mapping of TopologyResourcesObject key to k8s resource kind
 */
export interface KindsMap {
  [key: string]: string;
}

export const getWorkloadResources = (
  resources: TopologyDataResources,
  kindsMap: KindsMap,
  workloadTypes: string[] = WORKLOAD_TYPES,
) => {
  return _.flatten(
    workloadTypes.map((resourceKind) => {
      return resources[resourceKind]
        ? resources[resourceKind].data.map((res) => {
            const resKind = res.kind || kindsMap[resourceKind];
            let kind = resKind;
            let apiVersion;
            if (resKind && isGroupVersionKind(resKind)) {
              kind = kindForReference(resKind);
              apiVersion = apiVersionForReference(resKind);
            }
            return {
              kind,
              apiVersion,
              ...res,
            };
          })
        : [];
    }),
  );
};

export const getBaseWatchedResources = (namespace: string): WatchK8sResources<any> => {
  return {
    deploymentConfigs: {
      isList: true,
      kind: 'DeploymentConfig',
      namespace,
      optional: true,
    },
    deployments: {
      isList: true,
      kind: 'Deployment',
      namespace,
      optional: true,
    },
    daemonSets: {
      isList: true,
      kind: 'DaemonSet',
      namespace,
      optional: true,
    },
    pods: {
      isList: true,
      kind: 'Pod',
      namespace,
      optional: true,
    },
    replicationControllers: {
      isList: true,
      kind: 'ReplicationController',
      namespace,
      optional: true,
    },
    routes: {
      isList: true,
      kind: 'Route',
      namespace,
      optional: true,
    },
    services: {
      isList: true,
      kind: 'Service',
      namespace,
      optional: true,
    },
    replicaSets: {
      isList: true,
      kind: 'ReplicaSet',
      namespace,
      optional: true,
    },
    jobs: {
      isList: true,
      kind: 'Job',
      namespace,
      optional: true,
    },
    cronJobs: {
      isList: true,
      kind: 'CronJob',
      namespace,
      optional: true,
    },
    buildConfigs: {
      isList: true,
      kind: 'BuildConfig',
      namespace,
      optional: true,
    },
    builds: {
      isList: true,
      kind: 'Build',
      namespace,
      optional: true,
    },
    statefulSets: {
      isList: true,
      kind: 'StatefulSet',
      namespace,
      optional: true,
    },
    secrets: {
      isList: true,
      kind: 'Secret',
      namespace,
      optional: true,
    },
    hpas: {
      isList: true,
      kind: 'HorizontalPodAutoscaler',
      namespace,
      optional: true,
    },
    clusterServiceVersions: {
      isList: true,
      kind: referenceForModel(ClusterServiceVersionModel),
      namespace,
      optional: true,
    },
    ...tknPipelineAndPipelineRunsWatchResources(namespace),
  };
};
