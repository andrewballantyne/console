import * as _ from 'lodash';
import { apiVersionForModel, referenceForModel } from '@console/internal/module/k8s';
import { getRandomChars } from '@console/shared';
import { ClusterTaskModel, PipelineModel, TaskModel } from '../../../models';
import { PipelineKind, PipelineTask, PipelineTaskRef, TaskKind, TektonParam } from '../../../types';
import { removeEmptyDefaultFromPipelineParams } from '../detail-page-tabs';
import { getTaskParameters } from '../resource-utils';
import { TASK_ERROR_STRINGS } from './const';
import { GetErrorMessage, PipelineBuilderFormValues, PipelineBuilderTaskResources } from './types';

export const getTopLevelErrorMessage: GetErrorMessage = (errors) => (taskIndex) => {
  const taskError = Object.values(errors[taskIndex] || {})[0] as string;
  // We only want a specific set of top-level error messages
  return Object.values(TASK_ERROR_STRINGS).includes(taskError) ? taskError : null;
};

export const findTask = (
  resourceTasks: Omit<PipelineBuilderTaskResources, 'tasksLoaded'>,
  taskRef: PipelineTaskRef,
): TaskKind => {
  if (!resourceTasks?.clusterTasks || !resourceTasks?.namespacedTasks) {
    return null;
  }
  if (!taskRef?.kind) {
    return null;
  }

  if (taskRef.kind === ClusterTaskModel.kind) {
    return resourceTasks.clusterTasks.find((task) => task.metadata.name === taskRef.name);
  }
  return resourceTasks.namespacedTasks.find((task) => task.metadata.name === taskRef.name);
};

export const convertResourceParamsToTaskParams = (resource: TaskKind): TektonParam[] => {
  return getTaskParameters(resource).map((param) => ({
    name: param.name,
    value: param.default,
  }));
};

export const taskParamIsRequired = (param: TektonParam): boolean => {
  return !!param && !('default' in param);
};

export const safeName = (reservedNames: string[], desiredName: string): string => {
  if (reservedNames.includes(desiredName)) {
    const newName = `${desiredName}-${getRandomChars(3)}`;
    if (reservedNames.includes(newName)) {
      return safeName(reservedNames, desiredName);
    }
    return newName;
  }
  return desiredName;
};

export const convertResourceToTask = (
  usedNames: string[],
  resource: TaskKind,
  runAfter?: string[],
): PipelineTask => {
  const kind = resource.kind ?? TaskModel.kind;
  return {
    name: safeName(usedNames, resource.metadata.name),
    runAfter,
    taskRef: {
      kind,
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
  formValues: PipelineBuilderFormValues,
  namespace: string,
  existingPipeline?: PipelineKind,
): PipelineKind => {
  const { name, resources, params, workspaces, tasks, listTasks, ...unhandledSpec } = formValues;
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
      ...unhandledSpec,
      params: removeEmptyDefaultFromPipelineParams(params),
      resources,
      workspaces,
      tasks: tasks.map((task) => removeEmptyDefaultParams(removeListRunAfters(task, listIds))),
    },
  };
};

export const convertPipelineToBuilderForm = (
  pipeline: PipelineKind,
): Omit<PipelineBuilderFormValues, 'clusterTasks' | 'namespacedTasks' | 'tasksLoaded'> => {
  if (!pipeline) return null;

  const {
    metadata: { name },
    spec: { params = [], resources = [], workspaces = [], tasks = [] },
  } = pipeline;

  return {
    name,
    params,
    resources,
    workspaces,
    tasks,
    listTasks: [],
  };
};

export const hasEmptyString = (arr: string[]) => _.find(arr, _.isEmpty) === '';

export const isFieldValid = (value: string | string[], dirty: boolean, emptyIsInvalid: boolean) =>
  dirty && emptyIsInvalid ? (_.isArray(value) ? !hasEmptyString(value) : !_.isEmpty(value)) : true;
