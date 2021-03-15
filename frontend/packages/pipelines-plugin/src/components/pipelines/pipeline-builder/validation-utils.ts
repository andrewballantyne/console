import * as _ from 'lodash';
import * as yup from 'yup';
import { TFunction } from 'i18next';
import { EditorType } from '@console/shared/src/components/synced-editor/editor-toggle';
import { nameValidationSchema } from '@console/shared';
import { TASK_ERROR_STRINGS, TaskErrorType } from './const';
import { findTask, taskParamIsRequired } from './utils';
import { PipelineBuilderFormYamlValues, ResourceTarget } from './types';
import { getTaskParameters, getTaskResources } from '../resource-utils';
import {
  PipelineTaskResources,
  PipelineTaskRef,
  TaskKind,
  TektonResource,
  PipelineTaskResource,
  PipelineTask,
  PipelineTaskWorkspace,
  PipelineTaskParam,
} from '../../../types';
import { PipelineResourceType } from '../const';

const getTask = (
  formValues: PipelineBuilderFormYamlValues,
  path: string,
  distanceUnderTask: number = 2,
): TaskKind => {
  const {
    formData: { namespacedTasks, clusterTasks },
  } = formValues;

  const pathParts = path.split('.');
  // Walk back to the task so we can reference it's information
  const taskPath = pathParts.slice(0, pathParts.length - distanceUnderTask);
  const taskRef: PipelineTaskRef = _.get(formValues, `${taskPath.join('.')}.taskRef`);
  return findTask({ namespacedTasks, clusterTasks }, taskRef);
};

const areRequiredParamsAdded = (
  formValues: PipelineBuilderFormYamlValues,
  taskRef: PipelineTaskRef,
  params: PipelineTaskParam[] = [],
): boolean => {
  const {
    formData: { namespacedTasks, clusterTasks },
  } = formValues;

  const task = findTask({ namespacedTasks, clusterTasks }, taskRef);
  if (!task) {
    // No task, means we don't know if the param is nullable, so pass the test
    return true;
  }

  const requiredTaskParams = getTaskParameters(task).filter(taskParamIsRequired);
  if (requiredTaskParams.length === 0) {
    // No required params, no issue
    return true;
  }

  return requiredTaskParams.some(
    (requiredParam) =>
      !params.some(
        (addedParam) => addedParam.name === requiredParam.name && addedParam.value == null,
      ),
  );
};

const runAfterMatches = (
  formValues: PipelineBuilderFormYamlValues,
  runAfter: string[],
  thisTaskName: string,
): boolean => {
  if (!runAfter || runAfter.length === 0) {
    // No failure case if we don't have a run after
    return true;
  }
  if (runAfter.includes(thisTaskName)) {
    // Fails if it includes itself (can't run after yourself)
    return false;
  }

  const {
    formData: { tasks, listTasks },
  } = formValues;
  const taskNames = tasks.map((t) => t.name).concat(listTasks.map((t) => t.name));
  return !runAfter.some((name) => !taskNames.includes(name));
};

const getResourceTarget = (path: string): ResourceTarget | null => {
  return path.match(/(inputs|outputs)/)?.[0] as ResourceTarget | null;
};

const isResourceTheCorrectType = (
  formValues: PipelineBuilderFormYamlValues,
  path: string,
  resourceValue: string,
  resourceName: string,
): boolean => {
  const task = getTask(formValues, path, 3);
  const target = getResourceTarget(path);
  const resources = getTaskResources(task);
  const resource = resources[target]?.find(({ name }) => name === resourceName);
  const formResource = formValues.formData.resources.find(({ name }) => name === resourceValue);

  return resource?.type === formResource?.type;
};

const getRequiredResources = (
  formValues: PipelineBuilderFormYamlValues,
  taskRef: PipelineTaskRef,
): TektonResource[] => {
  const {
    formData: { namespacedTasks, clusterTasks },
  } = formValues;
  const task = findTask({ namespacedTasks, clusterTasks }, taskRef);
  if (!task) return [];

  const resources = getTaskResources(task);
  const inputResources = resources.inputs || [];
  const outputResources = resources.outputs || [];
  return [...inputResources, ...outputResources];
};

const isResourceRequired = (
  formValues: PipelineBuilderFormYamlValues,
  taskRef: PipelineTaskRef,
  taskResources?: PipelineTaskResource[],
): boolean => {
  if (!taskRef?.name) {
    // No task to reference, unsure if they are required; pass
    return true;
  }
  const resources = getRequiredResources(formValues, taskRef);

  return resources?.length === taskResources?.length;
};

const isWorkspacesRequired = (
  formValues: PipelineBuilderFormYamlValues,
  taskRef: PipelineTaskRef,
  taskWorkspaces?: PipelineTaskWorkspace[],
) => {
  const {
    formData: { namespacedTasks, clusterTasks },
  } = formValues;
  const task = findTask({ namespacedTasks, clusterTasks }, taskRef);
  if (!task) {
    // No matching task, can't verify if workspaces are needed
    return true;
  }
  const noWorkspaces = !taskWorkspaces || taskWorkspaces.length === 0;
  const needWorkspaces = task.spec.workspaces?.length > 0;
  if (noWorkspaces) {
    // If we have no workspaces, we are done; if we need workspaces we fail
    return !needWorkspaces;
  }

  const workspaceNames = taskWorkspaces.map(({ name }) => name);
  return !task.spec.workspaces.some(({ name }) => !workspaceNames.includes(name));
};

const pipelineBuilderFormSchema = (formValues: PipelineBuilderFormYamlValues, t: TFunction) => {
  const {
    formData: { resources, workspaces },
  } = formValues;

  const resourceDefinition = yup.array().of(
    yup.object({
      name: yup.string().required(t('pipelines-plugin~Required')),
      resource: yup
        .string()
        .test(
          'is-resource-link-broken',
          'Resource name has changed, reselect',
          (resourceValue?: string) =>
            !!resourceValue && !!resources.find(({ name }) => name === resourceValue),
        )
        .test('is-resource-type-valid', 'Resource type has changed, reselect', function(
          resourceValue?: string,
        ) {
          return isResourceTheCorrectType(formValues, this.path, resourceValue, this.parent.name);
        })
        .required(t('pipelines-plugin~Required')),
    }),
  );
  const validRunAfter = yup
    .array()
    .of(yup.string())
    .test('tasks-matches-runAfters', 'failed runAfter', function(runAfter: string[]) {
      return runAfterMatches(formValues, runAfter, this.parent.name);
    });

  return yup.object({
    name: nameValidationSchema.required(t('pipelines-plugin~Required')),
    params: yup.array().of(
      yup.object({
        name: yup.string().required(t('pipelines-plugin~Required')),
        description: yup.string(),
        default: yup.string(), // TODO: should include string[]
        // TODO: should have type (string | string[])
      }),
    ),
    resources: yup.array().of(
      yup.object({
        name: yup.string().required(t('pipelines-plugin~Required')),
        type: yup
          .string()
          .oneOf(Object.values(PipelineResourceType))
          .required(t('pipelines-plugin~Required')),
        // TODO: should include optional flag
      }),
    ),
    workspaces: yup.array().of(
      yup.object({
        name: yup.string().required(t('pipelines-plugin~Required')),
        // TODO: should include optional flag
      }),
    ),
    tasks: yup
      .array()
      .of(
        yup
          .object({
            name: yup.string().required(t('pipelines-plugin~Required')),
            taskRef: yup
              .object({
                name: yup.string().required(t('pipelines-plugin~Required')),
                kind: yup.string(),
              })
              .default(undefined),
            taskSpec: yup.object(), // TODO: support TaskSpec
            runAfter: validRunAfter,
            params: yup
              .array()
              .of(
                yup.object({
                  name: yup.string().required(t('pipelines-plugin~Required')),
                  value: yup.lazy((value) => {
                    if (Array.isArray(value)) {
                      return yup.array().of(yup.string().required(t('pipelines-plugin~Required')));
                    }
                    return yup.string();
                  }),
                }),
              )
              .test(
                'is-param-optional',
                TASK_ERROR_STRINGS[TaskErrorType.MISSING_REQUIRED_PARAMS],
                function(params?: PipelineTaskParam[]) {
                  return areRequiredParamsAdded(formValues, this.parent.taskRef, params);
                },
              ),
            resources: yup
              .object({
                inputs: resourceDefinition,
                outputs: resourceDefinition,
              })
              .test(
                'is-resources-required',
                TASK_ERROR_STRINGS[TaskErrorType.MISSING_RESOURCES],
                function(resourceValue?: PipelineTaskResources) {
                  return isResourceRequired(formValues, this.parent.taskRef, [
                    ...(resourceValue?.inputs || []),
                    ...(resourceValue?.outputs || []),
                  ]);
                },
              ),
            workspaces: yup
              .array()
              .of(
                yup.object({
                  name: yup.string().required(t('pipelines-plugin~Required')),
                  workspace: yup
                    .string()
                    .test(
                      'is-workspace-link-broken',
                      'Workspace name has changed, reselect',
                      (workspaceValue?: string) =>
                        !!workspaceValue &&
                        !!workspaces.find(({ name }) => name === workspaceValue),
                    )
                    .required(t('pipelines-plugin~Required')),
                }),
              )
              .test(
                'is-workspaces-required',
                TASK_ERROR_STRINGS[TaskErrorType.MISSING_WORKSPACES],
                function(workspaceList?: PipelineTaskWorkspace[]) {
                  return isWorkspacesRequired(formValues, this.parent.taskRef, workspaceList);
                },
              ),
          })
          .test(
            'taskRef-or-taskSpec',
            t('pipelines-plugin~TaskSpec or TaskRef must be provided'),
            function(task: PipelineTask) {
              return !!task.taskRef || !!task.taskSpec;
            },
          ),
      )
      .min(1, 'Must define at least one task')
      .required(t('pipelines-plugin~Required')),
    listTasks: yup.array().of(
      yup.object({
        name: yup.string().required(t('pipelines-plugin~Required')),
        runAfter: validRunAfter,
      }),
    ),
  });
};

export const validationSchema = (t: TFunction) =>
  yup.mixed().test({
    test(formValues: PipelineBuilderFormYamlValues) {
      const formYamlDefinition = yup.object({
        editorType: yup.string().oneOf(Object.values(EditorType)),
        yamlData: yup.string(),
        formData: pipelineBuilderFormSchema(formValues, t),
      });

      return formYamlDefinition.validate(formValues, { abortEarly: false });
    },
  });
