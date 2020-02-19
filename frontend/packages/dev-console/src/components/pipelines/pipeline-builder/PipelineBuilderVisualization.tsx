import * as React from 'react';
import { PipelineResourceTask } from '../../../utils/pipeline-augment';
import { PipelineLayout } from '../pipeline-topology/const';
import PipelineTopologyGraph from '../pipeline-topology/PipelineTopologyGraph';
import { getEdgesFromNodes } from '../pipeline-topology/utils';
import { useNodes } from './hooks';
import {
  PipelineBuilderTaskGroup,
  SelectTaskCallback,
  TaskErrorMap,
  UpdateTasksCallback,
} from './types';

type PipelineBuilderVisualizationProps = {
  clusterTasks: PipelineResourceTask[];
  namespacedTasks: PipelineResourceTask[];
  onTaskSelection: SelectTaskCallback;
  onUpdateTasks: UpdateTasksCallback;
  taskGroup: PipelineBuilderTaskGroup;
  tasksInError: TaskErrorMap;
};

const PipelineBuilderVisualization: React.FC<PipelineBuilderVisualizationProps> = ({
  clusterTasks,
  namespacedTasks,
  onTaskSelection,
  onUpdateTasks,
  taskGroup,
  tasksInError,
}) => {
  const nodes = useNodes(
    clusterTasks,
    namespacedTasks,
    onTaskSelection,
    onUpdateTasks,
    taskGroup,
    tasksInError,
  );

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
