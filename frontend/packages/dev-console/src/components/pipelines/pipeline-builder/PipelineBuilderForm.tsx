import * as React from 'react';
import * as _ from 'lodash';
import { FormikProps, FormikValues } from 'formik';
import {
  ActionGroup,
  Button,
  ButtonVariant,
  Form,
  Stack,
  StackItem,
  TextInputTypes,
} from '@patternfly/react-core';
import { InputField } from '@console/shared';
import { ButtonBar } from '@console/internal/components/utils';
import { K8sResourceKind } from '@console/internal/module/k8s';
import { PipelineParameters, PipelineResources } from '../detail-page-tabs';
import { UpdateOperationType } from './const';
import { useResourceValidation } from './hooks';
import { removeTaskModal } from './modals';
import PipelineBuilderHeader from './PipelineBuilderHeader';
import PipelineBuilderVisualization from './PipelineBuilderVisualization';
import Sidebar from './task-sidebar/Sidebar';
import TaskSidebar from './task-sidebar/TaskSidebar';
import {
  CleanupResults,
  PipelineBuilderTaskGroup,
  SelectedBuilderTask,
  UpdateErrors,
  UpdateOperationUpdateTaskData,
} from './types';
import { applyChange } from './update-utils';

import './PipelineBuilderForm.scss';

type PipelineBuilderFormProps = FormikProps<FormikValues> & {
  existingPipeline: K8sResourceKind;
  namespace: string;
};

const PipelineBuilderForm: React.FC<PipelineBuilderFormProps> = (props) => {
  const {
    existingPipeline,
    status,
    isSubmitting,
    dirty,
    handleReset,
    handleSubmit,
    errors,
    namespace,
    setFieldValue,
    setStatus,
    values,
  } = props;

  const [selectedTask, setSelectedTask] = React.useState<SelectedBuilderTask>(null);
  const statusRef = React.useRef(status);
  statusRef.current = status;

  console.debug('errors', errors);
  console.debug('status', status);
  console.debug('values', values);

  const updateErrors: UpdateErrors = React.useCallback(
    (taskErrors) => {
      if (taskErrors) {
        setStatus({
          ...statusRef.current,
          tasks: _.omitBy(_.merge({}, statusRef.current?.tasks, taskErrors), (v) => !v),
        });
      }
    },
    [setStatus],
  );

  useResourceValidation(values.tasks, values.resources, updateErrors);

  const updateTasks = (changes: CleanupResults): void => {
    const { tasks, listTasks, errors: taskErrors } = changes;

    setFieldValue('tasks', tasks);
    setFieldValue('listTasks', listTasks);
    updateErrors(taskErrors);
  };

  const taskGroup: PipelineBuilderTaskGroup = { tasks: values.tasks, listTasks: values.listTasks };

  return (
    <Stack className="odc-pipeline-builder-form">
      <StackItem>
        <PipelineBuilderHeader
          formIsDirty={dirty}
          existingPipeline={existingPipeline}
          namespace={namespace}
        />
      </StackItem>
      <StackItem isFilled className="odc-pipeline-builder-form__content">
        <Form className="odc-pipeline-builder-form__grid" onSubmit={handleSubmit}>
          <div className="odc-pipeline-builder-form__short-section">
            <InputField
              label="Name"
              name="name"
              type={TextInputTypes.text}
              isDisabled={!!existingPipeline}
              required
            />
          </div>

          <div>
            <h2>Tasks</h2>
            <PipelineBuilderVisualization
              clusterTasks={values.clusterTasks}
              namespacedTasks={values.namespacedTasks}
              onTaskSelection={(task, resource) => {
                setSelectedTask({
                  taskIndex: values.tasks.findIndex(({ name }) => name === task.name),
                  resource,
                });
              }}
              onUpdateTasks={(updatedTaskGroup, op) =>
                updateTasks(applyChange(updatedTaskGroup, op))
              }
              tasksInError={status?.tasks || {}}
              taskGroup={taskGroup}
            />
          </div>

          <div>
            <h2>Parameters</h2>
            <PipelineParameters addLabel="Add Parameters" fieldName="params" />
          </div>

          <div>
            <h2>Resources</h2>
            <PipelineResources addLabel="Add Resources" fieldName="resources" />
          </div>

          <ButtonBar errorMessage={status?.submitError} inProgress={isSubmitting}>
            <ActionGroup className="pf-c-form">
              <Button
                type="submit"
                variant={ButtonVariant.primary}
                isDisabled={
                  !dirty ||
                  !_.isEmpty(errors) ||
                  !_.isEmpty(status?.tasks) ||
                  values.tasks.length === 0
                }
                data-test-id="import-git-create-button"
              >
                {existingPipeline ? 'Save' : 'Create'}
              </Button>
              <Button type="button" variant={ButtonVariant.secondary} onClick={handleReset}>
                Cancel
              </Button>
            </ActionGroup>
          </ButtonBar>
          <Sidebar open={!!selectedTask} onRequestClose={() => setSelectedTask(null)}>
            {() => (
              <TaskSidebar
                resourceList={values.resources || []}
                errorMap={status?.tasks || {}}
                onUpdateTask={(data: UpdateOperationUpdateTaskData) => {
                  updateTasks(
                    applyChange(taskGroup, { type: UpdateOperationType.UPDATE_TASK, data }),
                  );
                }}
                onRemoveTask={(taskName) => {
                  removeTaskModal(taskName, () => {
                    setSelectedTask(null);
                    updateTasks(
                      applyChange(taskGroup, {
                        type: UpdateOperationType.REMOVE_TASK,
                        data: { taskName },
                      }),
                    );
                  });
                }}
                selectedPipelineTaskIndex={selectedTask.taskIndex}
                taskResource={selectedTask.resource}
              />
            )}
          </Sidebar>
        </Form>
      </StackItem>
    </Stack>
  );
};

export default PipelineBuilderForm;
