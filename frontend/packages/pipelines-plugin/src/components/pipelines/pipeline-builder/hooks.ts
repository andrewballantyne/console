import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useFormikContext, FormikErrors } from 'formik';
import { referenceForModel } from '@console/internal/module/k8s';
import { useK8sWatchResources } from '@console/internal/components/utils/k8s-watch-hook';
import { ClusterTaskModel, TaskModel } from '../../../models';
import { TaskKind, PipelineTask, PipelineTaskRef } from '../../../types';
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
  PipelineBuilderTaskResources,
  PipelineBuilderTaskGroup,
  SelectTaskCallback,
  UpdateOperationAddData,
  UpdateOperationConvertToTaskData,
  UpdateOperationFixInvalidTaskListData,
  UpdateTasksCallback,
} from './types';
import { UpdateOperationType } from './const';
import { getTopLevelErrorMessage } from './utils';

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
  const namespacedTaskData = namespacedTasks.loaded ? namespacedTasks.data : null;
  const clusterTaskData = clusterTasks.loaded ? clusterTasks.data : null;

  React.useEffect(() => {
    if (namespacedTaskData) {
      setFieldValue('formData.namespacedTasks', namespacedTaskData);
    }
    if (clusterTaskData) {
      setFieldValue('formData.clusterTasks', clusterTaskData);
    }
    setFieldValue('formData.tasksLoaded', !!namespacedTaskData && !!clusterTaskData);
  }, [setFieldValue, namespacedTaskData, clusterTaskData]);

  const error = namespacedTasks.loadError || clusterTasks.loadError;
  React.useEffect(() => {
    if (!error) return;

    setStatus({
      taskLoadingError: t('pipelines-plugin~Failed to load Tasks. {{error}}', { error }),
    });
  }, [t, setStatus, error]);
};

export const useNodes = (
  onTaskSelection: SelectTaskCallback,
  onUpdateTasks: UpdateTasksCallback,
  taskGroup: PipelineBuilderTaskGroup,
  taskResources: PipelineBuilderTaskResources,
  tasksInError: FormikErrors<PipelineTask>[],
): PipelineMixedNodeModel[] => {
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
          getTopLevelErrorMessage(tasksInError),
          taskGroup.highlightedIds,
        )
      : [];
  const taskListNodes: PipelineTaskListNodeModel[] =
    taskGroup.tasks.length === 0 && taskGroup.listTasks.length <= 1
      ? [soloTask(taskGroup.listTasks[0]?.name)]
      : taskGroup.listTasks.map((listTask) => newListNode(listTask.name, listTask.runAfter));

  return handleParallelToParallelNodes([...taskNodes, ...taskListNodes, ...invalidTaskListNodes]);
};
