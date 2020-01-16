import * as React from 'react';
import { Alert } from '@patternfly/react-core';
import { Pipeline, PipelineRun } from '../../../../utils/pipeline-augment';
import PipelineTopologyGraph from '../../pipeline-topology/PipelineTopologyGraph';
import { getTopologyNodesEdges } from '../../pipeline-topology/utils';

interface PipelineTopologyVisualizationProps {
  pipeline: Pipeline;
  pipelineRun?: PipelineRun;
}

const PipelineVisualization: React.FC<PipelineTopologyVisualizationProps> = ({
  pipeline,
  pipelineRun,
}) => {
  const { nodes, edges } = getTopologyNodesEdges(pipeline, pipelineRun);

  if (nodes.length === 0 && edges.length === 0) {
    // Nothing to render
    // TODO: Confirm wording with UX; ODC-1860
    return <Alert variant="info" isInline title="This Pipeline has no tasks to visualize." />;
  }

  return (
    <PipelineTopologyGraph
      id={pipelineRun?.metadata?.name || pipeline.metadata.name}
      nodes={nodes}
      edges={edges}
    />
  );
};

export default PipelineVisualization;
