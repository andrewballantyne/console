import * as React from 'react';
import { SectionHeading, ResourceSummary } from '@console/internal/components/utils';
import { K8sResourceKind } from '@console/internal/module/k8s';
import { PipelineRunVisualization } from './PipelineRunVisualization';
import { PipelineRunTopologyVisualization } from '../../pipelines/detail-page-tabs/pipeline-details/PipelineTopologyVisualization';

export interface PipelineRunDetailsProps {
  obj: K8sResourceKind;
}

export const PipelineRunDetails: React.FC<PipelineRunDetailsProps> = ({ obj: pipelineRun }) => {
  return (
    <div className="co-m-pane__body">
      <SectionHeading text="Pipeline Run Overview" />
      <PipelineRunTopologyVisualization pipelineRun={pipelineRun} />
      <PipelineRunVisualization pipelineRun={pipelineRun} />
      <div className="row">
        <div className="col-sm-6">
          <ResourceSummary resource={pipelineRun} />
        </div>
      </div>
    </div>
  );
};
