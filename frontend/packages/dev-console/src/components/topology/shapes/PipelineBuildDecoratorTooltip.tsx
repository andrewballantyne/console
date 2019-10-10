import * as React from 'react';
import {
  DataState,
  PipelineExampleNames,
  taskStatusData,
} from '../../../utils/__tests__/pipeline-augment-test-data';
import { getRunStatusColor, getTaskStatus, runStatus } from '../../../utils/pipeline-augment';
import HorizontalStackedBars from '../../charts/HorizontalStackedBars';
import TaskStatusToolTip from '../../pipelineruns/TaskStatusTooltip';
import './PipelineBuildDecoratorTooltip.scss';

export interface PipelineBuildDecoratorTooltipProps {}

const PipelineBuildDecoratorTooltip: React.FC<PipelineBuildDecoratorTooltipProps> = ({}) => {
  const pipelineData = taskStatusData[PipelineExampleNames.SIMPLE_PIPELINE];
  const pipelineRun = pipelineData.pipelineRuns[DataState.SUCCESS];
  const taskStatus = getTaskStatus(pipelineRun, pipelineData.pipeline);
  const pipelineBars = (
    <HorizontalStackedBars
      height="1em"
      inline
      values={Object.keys(runStatus).map((status) => ({
        color: getRunStatusColor(runStatus[status]).pftoken.value,
        name: status,
        size: taskStatus[runStatus[status]],
      }))}
    />
  );
  const breakdownInfo = <TaskStatusToolTip taskStatus={taskStatus} />;

  return (
    <div className="odc-pipeline-build-decorator-tooltip">
      <div className="odc-pipeline-build-decorator-tooltip__title">Pipeline (Something)</div>
      <div className="odc-pipeline-build-decorator-tooltip__status-bars">{pipelineBars}</div>
      <div className="odc-pipeline-build-decorator-tooltip__status-breakdown">{breakdownInfo}</div>
    </div>
  );
};

export default PipelineBuildDecoratorTooltip;
