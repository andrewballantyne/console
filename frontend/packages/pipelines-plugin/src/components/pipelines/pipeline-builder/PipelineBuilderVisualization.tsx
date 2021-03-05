import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useFormikContext, FormikErrors } from 'formik';
import { Alert } from '@patternfly/react-core';
import { LoadingBox } from '@console/internal/components/utils';
import { hasInlineTaskSpec } from '../../../utils/pipeline-utils';
import { PipelineLayout } from '../pipeline-topology/const';
import PipelineTopologyGraph from '../pipeline-topology/PipelineTopologyGraph';
import { getEdgesFromNodes } from '../pipeline-topology/utils';
import { useNodes } from './hooks';
import {
  PipelineBuilderFormikValues,
  PipelineBuilderTaskResources,
  PipelineBuilderTaskGroup,
  SelectTaskCallback,
  UpdateTasksCallback,
} from './types';
import { PipelineTask } from '../../../types';

type PipelineBuilderVisualizationProps = {
  onTaskSelection: SelectTaskCallback;
  onUpdateTasks: UpdateTasksCallback;
  taskGroup: PipelineBuilderTaskGroup;
  taskResources: PipelineBuilderTaskResources;
};

const isTaskArrayErrors = (
  errors: string | FormikErrors<PipelineTask>[] | string[],
): errors is FormikErrors<PipelineTask>[] => {
  return Array.isArray(errors) && typeof errors[0] === 'object';
};

const PipelineBuilderVisualization: React.FC<PipelineBuilderVisualizationProps> = ({
  onTaskSelection,
  onUpdateTasks,
  taskGroup,
  taskResources,
}) => {
  const { t } = useTranslation();
  const { errors, status } = useFormikContext<PipelineBuilderFormikValues>();
  let taskErrors: FormikErrors<PipelineTask>[] = [];
  if (isTaskArrayErrors(errors?.formData?.tasks)) {
    taskErrors = errors.formData.tasks;
  }
  const nodes = useNodes(onTaskSelection, onUpdateTasks, taskGroup, taskResources, taskErrors);
  const taskCount = taskResources.namespacedTasks.length + taskResources.clusterTasks.length;

  if (status?.taskLoadingError) {
    return (
      <Alert variant="danger" isInline title={t('pipelines-plugin~Error loading the tasks.')}>
        {status.taskLoadingError}
      </Alert>
    );
  }
  if (!taskResources.tasksLoaded) {
    return <LoadingBox />;
  }
  if (taskCount === 0 && taskGroup.tasks.length === 0) {
    // No tasks, nothing we can do here...
    return (
      <Alert variant="danger" isInline title={t('pipelines-plugin~Unable to locate any tasks.')} />
    );
  }

  if (hasInlineTaskSpec(taskGroup.tasks)) {
    return (
      <Alert
        variant="info"
        isInline
        title={t(
          'pipelines-plugin~This Pipeline cannot be visualized. Pipeline taskSpec is not supported.',
        )}
      />
    );
  }

  return (
    <PipelineTopologyGraph
      // TODO: fix this; the graph layout isn't properly laying out nodes
      key={nodes.map((n) => n.id).join('-')}
      id="pipeline-builder"
      fluid
      nodes={nodes}
      edges={getEdgesFromNodes(nodes)}
      layout={PipelineLayout.DAGRE_BUILDER}
    />
  );
};

export default PipelineBuilderVisualization;
