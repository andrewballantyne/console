import { history, resourcePathFromModel } from '@console/internal/components/utils';
import { apiVersionForModel, referenceForModel } from '@console/internal/module/k8s';
import { ClusterTaskModel, PipelineModel } from '../../../models';
import { Pipeline, PipelineResourceTask, PipelineTask } from '../../../utils/pipeline-augment';
import { getTaskParameters } from '../resource-utils';
import { TASK_ERROR_STRINGS, TaskErrorType } from './const';
import { PipelineBuilderFormikValues, PipelineBuilderFormValues, TaskErrorMap } from './types';
import { PipelineMixedNodeModel } from '../pipeline-topology/types';

export const getErrorMessage = (errorTypes: TaskErrorType[], errorMap: TaskErrorMap) => (
  taskName: string,
): string => {
  if (!taskName) {
    return TASK_ERROR_STRINGS[TaskErrorType.MISSING_NAME];
  }

  const errorList: TaskErrorType[] | undefined = errorMap?.[taskName];
  if (!errorList) return null;

  const hasRequestedError = errorList.filter((error) => errorTypes.includes(error));
  return hasRequestedError.length > 0 ? TASK_ERROR_STRINGS[hasRequestedError[0]] : null;
};

export const convertResourceToTask = (
  resource: PipelineResourceTask,
  runAfter?: string[],
): PipelineTask => {
  return {
    name: resource.metadata.name,
    runAfter,
    taskRef: {
      kind: resource.kind === ClusterTaskModel.kind ? ClusterTaskModel.kind : undefined,
      name: resource.metadata.name,
    },
    params: getTaskParameters(resource).map((param) => ({
      name: param.name,
      value: param.default,
    })),
  };
};

export const getPipelineURL = (namespace: string) => {
  return `/k8s/ns/${namespace}/${referenceForModel(PipelineModel)}`;
};

const removeListRunAfters = (task: PipelineTask, listIds: string[]): PipelineTask => {
  if (task?.runAfter && listIds.length > 0) {
    // Trim out any runAfters pointing at list nodes
    const runAfter = (task.runAfter || []).filter(
      (runAfterName) => !listIds.includes(runAfterName),
    );

    return {
      ...task,
      runAfter,
    };
  }

  return task;
};

const removeEmptyDefaultParams = (task: PipelineTask): PipelineTask => {
  if (task.params?.length > 0) {
    // Since we can submit, this param has a default; check for empty values and remove
    return {
      ...task,
      params: task.params.filter((param) => !!param.value),
    };
  }

  return task;
};

export const convertBuilderFormToPipeline = (
  formValues: PipelineBuilderFormikValues,
  namespace: string,
  existingPipeline?: Pipeline,
): Pipeline => {
  const { name, resources, params, tasks, listTasks } = formValues;
  const listIds = listTasks.map((listTask) => listTask.name);

  return {
    ...existingPipeline,
    apiVersion: apiVersionForModel(PipelineModel),
    kind: PipelineModel.kind,
    metadata: {
      ...existingPipeline?.metadata,
      name,
      namespace,
    },
    spec: {
      ...existingPipeline?.spec,
      params,
      resources,
      tasks: tasks.map((task) => removeEmptyDefaultParams(removeListRunAfters(task, listIds))),
    },
  };
};

export const convertPipelineToBuilderForm = (pipeline: Pipeline): PipelineBuilderFormValues => {
  if (!pipeline) return null;

  const {
    metadata: { name },
    spec: { params = [], resources = [], tasks = [] },
  } = pipeline;

  return {
    name,
    params,
    resources,
    tasks,
    listTasks: [],
  };
};

export const goToYAML = (existingPipeline?: Pipeline, namespace?: string) => {
  history.push(
    existingPipeline
      ? `${resourcePathFromModel(
          PipelineModel,
          existingPipeline?.metadata?.name,
          existingPipeline?.metadata?.namespace,
        )}/yaml`
      : `${getPipelineURL(namespace)}/~new`,
  );
};

const getRunAfter = (node: PipelineMixedNodeModel): string[] | undefined =>
  node.data?.task?.runAfter;

export const breakIntoIsolatedPaths = (
  nodes: PipelineMixedNodeModel[],
): PipelineMixedNodeModel[][] => {
  // loop runAfter nodes and build listing
  // look listing until no more nodes
  // eliminate paths that rejoin
  // => Break if only 1

  const startingNodes = nodes.filter((n) => !Array.isArray(getRunAfter(n)));

  if (startingNodes.length === 1) {
    // Everything is connected
    return [nodes];
  }

  const otherNodes = nodes.filter((n) => Array.isArray(getRunAfter(n)));

  const paths: PipelineMixedNodeModel[][] = startingNodes.map((node) => [node]);

  const buildPaths = (
    nodeList: PipelineMixedNodeModel[],
    pathList: PipelineMixedNodeModel[][],
    idx: number = 0,
  ): PipelineMixedNodeModel[][] => {
    return pathList.map((path) => {
      const thisNode: PipelineMixedNodeModel = path[idx];
      if (thisNode === undefined) {
        return path;
      }

      const runAfters = nodeList.filter((n) => getRunAfter(n).includes(thisNode.id));

      const result = buildPaths(nodeList, [[...path, ...runAfters]], idx + 1);

      return result[0];
    });
  };

  const fullPaths = buildPaths(otherNodes, paths);

  // trim full paths for overlaps

  return fullPaths;
};
