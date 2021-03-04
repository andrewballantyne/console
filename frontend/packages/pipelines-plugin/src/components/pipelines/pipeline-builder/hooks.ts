import * as React from 'react';
import * as _ from 'lodash';
import { useTranslation } from 'react-i18next';
import { useFormikContext } from 'formik';
import { referenceForModel } from '@console/internal/module/k8s';
import {
  useK8sWatchResources,
  WatchK8sResultsObject,
} from '@console/internal/components/utils/k8s-watch-hook';
import { ClusterTaskModel, TaskModel } from '../../../models';
import {
  TektonResource,
  TaskKind,
  PipelineTask,
  PipelineTaskRef,
  PipelineWorkspace,
} from '../../../types';
import { PipelineVisualizationTaskItem } from '../../../utils/pipeline-utils';
import { AddNodeDirection } from '../pipeline-topology/const';
import {
  PipelineBuilderTaskNodeModel,
  PipelineMixedNodeModel,
  PipelineTaskListNodeModel,
} from '../pipeline-topology/types';
import {
  createInvalidTaskListNode,
  createTaskListNode,
  handleParallelToParallelNodes,
  tasksToBuilderNodes,
} from '../pipeline-topology/utils';
import {
  PipelineBuilderFormikValues,
  PipelineBuilderResourceGrouping,
  PipelineBuilderTaskGroup,
  SelectTaskCallback,
  TaskErrorMap,
  UpdateErrors,
  UpdateOperationAddData,
  UpdateOperationConvertToTaskData,
  UpdateOperationFixInvalidTaskListData,
  UpdateTasksCallback,
} from './types';
import { nodeTaskErrors, TaskErrorType, UpdateOperationType } from './const';
import { getErrorMessage } from './utils';

export const useFormikFetchAndSaveTasks = (namespace: string) => {
  const { t } = useTranslation();
  const { setFieldValue, setStatus } = useFormikContext<PipelineBuilderFormikValues>();

  const { namespacedTasks, clusterTasks } = useK8sWatchResources<{
    namespacedTasks: TaskKind[];
    clusterTasks: TaskKind[];
  }>({
    namespacedTasks: {
      kind: referenceForModel(TaskModel),
      isList: true,
      namespace,
    },
    clusterTasks: {
      kind: referenceForModel(ClusterTaskModel),
      isList: true,
      namespaced: false,
    },
  });

  // Handle load state
  const isReady = (resource: WatchK8sResultsObject<TaskKind[]>) =>
    resource.loaded && !resource.loadError;
  if (isReady(namespacedTasks)) {
    setFieldValue('formData.namespacedTasks', namespacedTasks.data);
  }
  if (isReady(clusterTasks)) {
    setFieldValue('formData.clusterTasks', clusterTasks.data);
  }

  // Handle errors
  if (namespacedTasks.loadError) {
    setStatus({
      taskLoadingError: t('pipelines-plugin~Failed to load namespace Tasks. {{tasksLoadError}}', {
        tasksLoadError: namespacedTasks.loadError,
      }),
    });
  } else if (clusterTasks.loadError) {
    setStatus({
      taskLoadingError: t(
        'pipelines-plugin~Failed to load ClusterTasks. {{clusterTasksLoadError}}',
        {
          clusterTasksLoadError: clusterTasks.loadError,
        },
      ),
    });
  }
};

type UseNodes = {
  nodes: PipelineMixedNodeModel[];
  tasksCount: number;
};
export const useNodes = (
  namespace: string,
  onTaskSelection: SelectTaskCallback,
  onUpdateTasks: UpdateTasksCallback,
  taskGroup: PipelineBuilderTaskGroup,
  taskResources: PipelineBuilderResourceGrouping,
  tasksInError: TaskErrorMap,
): UseNodes => {
  const { clusterTasks, namespacedTasks } = taskResources;

  const getTask = (taskRef: PipelineTaskRef) => {
    if (taskRef?.kind === ClusterTaskModel.kind) {
      return clusterTasks?.find((task) => task.metadata.name === taskRef?.name);
    }
    return namespacedTasks?.find((task) => task.metadata.name === taskRef?.name);
  };

  const taskGroupRef = React.useRef(taskGroup);
  taskGroupRef.current = taskGroup;

  const onNewListNode = (task: PipelineVisualizationTaskItem, direction: AddNodeDirection) => {
    const data: UpdateOperationAddData = { direction, relatedTask: task };
    onUpdateTasks(taskGroupRef.current, { type: UpdateOperationType.ADD_LIST_TASK, data });
  };
  const onNewTask = (resource: TaskKind, name: string, runAfter?: string[]) => {
    const data: UpdateOperationConvertToTaskData = { resource, name, runAfter };
    onUpdateTasks(taskGroupRef.current, { type: UpdateOperationType.CONVERT_LIST_TO_TASK, data });
  };

  const newListNode = (
    name: string,
    runAfter?: string[],
    firstTask?: boolean,
  ): PipelineTaskListNodeModel =>
    createTaskListNode(name, {
      namespaceTaskList: namespacedTasks,
      clusterTaskList: clusterTasks,
      onNewTask: (resource: TaskKind) => {
        onNewTask(resource, name, runAfter);
      },
      onRemoveTask: firstTask
        ? null
        : () => {
            onUpdateTasks(taskGroupRef.current, {
              type: UpdateOperationType.DELETE_LIST_TASK,
              data: { listTaskName: name },
            });
          },
      task: {
        name,
        runAfter: runAfter || [],
      },
    });
  const soloTask = (name = 'initial-node') => newListNode(name, undefined, true);
  const newInvalidListNode = (name: string, runAfter?: string[]): PipelineTaskListNodeModel =>
    createInvalidTaskListNode(name, {
      namespaceTaskList: namespacedTasks,
      clusterTaskList: clusterTasks,
      onNewTask: (resource: TaskKind) => {
        const data: UpdateOperationFixInvalidTaskListData = {
          existingName: name,
          resource,
          runAfter,
        };

        onUpdateTasks(taskGroupRef.current, {
          type: UpdateOperationType.FIX_INVALID_LIST_TASK,
          data,
        });
      },
      onRemoveTask: () => {
        onUpdateTasks(taskGroupRef.current, {
          type: UpdateOperationType.REMOVE_TASK,
          data: { taskName: name },
        });
      },
      task: {
        name,
        runAfter: runAfter || [],
      },
    });

  const invalidTaskList = taskGroup.tasks.filter((task) => !getTask(task.taskRef));
  const validTaskList = taskGroup.tasks.filter((task) => !!getTask(task.taskRef));

  const invalidTaskListNodes: PipelineTaskListNodeModel[] = invalidTaskList.map((task) =>
    newInvalidListNode(task.name, task.runAfter),
  );
  const taskNodes: PipelineBuilderTaskNodeModel[] =
    validTaskList.length > 0
      ? tasksToBuilderNodes(
          validTaskList,
          onNewListNode,
          (task) => onTaskSelection(task, getTask(task.taskRef)),
          getErrorMessage(nodeTaskErrors, tasksInError),
          taskGroup.highlightedIds,
        )
      : [];
  const taskListNodes: PipelineTaskListNodeModel[] =
    taskGroup.tasks.length === 0 && taskGroup.listTasks.length <= 1
      ? [soloTask(taskGroup.listTasks[0]?.name)]
      : taskGroup.listTasks.map((listTask) => newListNode(listTask.name, listTask.runAfter));

  const nodes: PipelineMixedNodeModel[] = handleParallelToParallelNodes([
    ...taskNodes,
    ...taskListNodes,
    ...invalidTaskListNodes,
  ]);

  const localTaskCount = namespacedTasks?.length || 0;
  const clusterTaskCount = clusterTasks?.length || 0;

  return {
    tasksCount: localTaskCount + clusterTaskCount,
    nodes,
  };
};

export const useResourceValidation = (
  tasks: PipelineTask[],
  resourceValues: TektonResource[],
  workspaceValues: PipelineWorkspace[],
  onError: UpdateErrors,
) => {
  const [previousErrorIds, setPreviousErrorIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    const resourceNames = resourceValues.map((r) => r.name);

    const errors = tasks.reduce((acc, task) => {
      const output = task.resources?.outputs || [];
      const input = task.resources?.inputs || [];
      const missingResources = [...output, ...input].filter(
        (r) => !resourceNames.includes(r.resource),
      );

      const workspaceNames = workspaceValues.map((w) => w.name);
      const missingWorkspaces =
        task.workspaces?.filter((w) => !workspaceNames.includes(w.workspace)) || [];

      if (missingResources.length === 0 && missingWorkspaces.length === 0) {
        return acc;
      }

      const taskErrors: TaskErrorType[] = [];
      if (missingResources.length > 0) {
        taskErrors.push(TaskErrorType.MISSING_RESOURCES);
      }
      if (missingWorkspaces.length > 0) {
        taskErrors.push(TaskErrorType.MISSING_WORKSPACES);
      }

      return {
        ...acc,
        [task.name]: taskErrors,
      };
    }, {});

    if (!_.isEmpty(errors) || previousErrorIds.length > 0) {
      const outputErrors = previousErrorIds.reduce((acc, id) => {
        if (acc[id]) {
          // Error exists, leave it alone
          return acc;
        }

        // Error doesn't exist but we had it once, make sure it is cleared
        return {
          ...acc,
          [id]: null,
        };
      }, errors);

      const currentErrorIds = Object.keys(outputErrors).filter((id) => !!outputErrors[id]);
      if (!_.isEqual(currentErrorIds, previousErrorIds)) {
        setPreviousErrorIds(currentErrorIds);
      }
      onError(outputErrors);
    }
  }, [tasks, resourceValues, workspaceValues, onError, previousErrorIds, setPreviousErrorIds]);
};
