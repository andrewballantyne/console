import * as React from 'react';
import * as _ from 'lodash';
import * as cx from 'classnames';
import { Tooltip } from '@patternfly/react-core';
import {
  SyncAltIcon,
  CheckCircleIcon,
  ErrorCircleOIcon,
  CircleIcon,
} from '@patternfly/react-icons';
import { K8sResourceKind } from '@console/internal/module/k8s';
import { Firehose } from '@console/internal/components/utils';
import { getRunStatusColor, runStatus } from '../../utils/pipeline-augment';
import HorizontalStackedBars, { StackedValue } from '../charts/HorizontalStackedBars';
import { PipelineVisualizationStepList } from './PipelineVisualizationStepList';

import './PipelineVisualizationTask.scss';

type TaskStatusStep = {
  name: string;
  running?: { startedAt: string };
  terminated?: {
    reason: string;
  };
  waiting?: {};
};

type TaskStatus = {
  reason: string;
  duration?: string;
  steps?: TaskStatusStep[];
};

interface TaskProps {
  name: string;
  loaded?: boolean;
  task?: {
    data: K8sResourceKind;
    spec?: {
      steps?: { name: string }[];
    };
  };
  status?: TaskStatus;
  namespace: string;
}

interface PipelineVisualizationTaskProp {
  namespace: string;
  task: {
    name?: string;
    taskRef: {
      name: string;
    };
    status?: TaskStatus;
  };
  taskRun?: string;
}

interface StatusIconProps {
  status: string;
}
export const StatusIcon: React.FC<StatusIconProps> = ({ status }) => {
  switch (status) {
    case 'In Progress':
      return <SyncAltIcon className="fa-spin" />;

    case 'Succeeded':
      return <CheckCircleIcon className="is-done" />;

    case 'Failed':
      return <ErrorCircleOIcon className="is-done" />;

    default:
      return <CircleIcon className="is-idle" />;
  }
};

export const PipelineVisualizationTask: React.FC<PipelineVisualizationTaskProp> = ({
  task,
  namespace,
}) => {
  return (
    <Firehose
      resources={[
        {
          kind: 'Task',
          name: task.taskRef.name,
          namespace,
          prop: 'task',
        },
      ]}
    >
      <TaskComponent
        name={task.name || ''}
        namespace={namespace}
        status={task.status || { duration: '', reason: 'pending' }}
      />
    </Firehose>
  );
};

const TaskComponent: React.FC<TaskProps> = ({ task, status, name }) => {
  const taskData = task.data;
  const stepList = (taskData.spec && taskData.spec.steps) || [];

  return (
    <li
      className={cx('odc-pipeline-vis-task')}
      style={{
        color:
          status && status.reason
            ? getRunStatusColor(status.reason).pftoken.value
            : getRunStatusColor(runStatus.Cancelled).pftoken.value,
      }}
    >
      <Tooltip
        position="bottom"
        enableFlip={false}
        content={<PipelineVisualizationStepList steps={stepList} />}
      >
        <div className="odc-pipeline-vis-task__content">
          <div className={cx('odc-pipeline-vis-task__title', { 'is-text-center': !status })}>
            {name || _.get(task, ['metadata', 'name'], '')}
          </div>
          {status && status.reason && (
            <div className="odc-pipeline-vis-task__status">
              <StatusIcon status={status.reason} />
            </div>
          )}
          {status && status.duration && (
            <div className="odc-pipeline-vis-task__stepcount">({status.duration})</div>
          )}
          <TaskComponentTaskStatus steps={stepList} status={status} />
        </div>
      </Tooltip>
    </li>
  );
};

const determineStepColor = (step: { name: string }, status: TaskStatus): string => {
  if (status.reason !== 'In Progress') {
    return getRunStatusColor(status.reason).pftoken.value;
  }

  // In progress, try to get granular statuses
  const stepStatuses = status.steps || [];
  const matchingStep = stepStatuses.find((stepStatus) => {
    // TODO: Find a better way to link them up
    return stepStatus.name.includes(step.name);
  });
  if (!matchingStep) {
    return getRunStatusColor(runStatus.Pending).pftoken.value;
  }

  let color;
  if (matchingStep.terminated) {
    color =
      matchingStep.terminated.reason === 'Completed'
        ? getRunStatusColor(runStatus.Succeeded).pftoken.value
        : getRunStatusColor(runStatus.Failed).pftoken.value;
  } else if (matchingStep.running) {
    color = getRunStatusColor(runStatus.Running).pftoken.value;
  } else if (matchingStep.waiting) {
    color = getRunStatusColor(runStatus.Pending).pftoken.value;
  }

  return color || getRunStatusColor(runStatus.PipelineNotStarted).pftoken.value;
};

interface TaskStatusProps {
  steps: { name: string }[];
  status: TaskStatus;
}

const TaskComponentTaskStatus: React.FC<TaskStatusProps> = ({ steps, status }) => {
  const visualValues: StackedValue[] =
    steps.length === 0
      ? [
          {
            color: getRunStatusColor(status.reason).pftoken.value,
            name: 'pending',
            size: 1,
          },
        ]
      : steps.map((step) => {
          return {
            color: determineStepColor(step, status),
            name: step.name,
            size: 1,
          };
        });

  return (
    <div style={{ position: 'absolute', left: 0, bottom: 1, width: '100%', height: 0 }}>
      <HorizontalStackedBars values={visualValues} barGap={2} height={2} />
    </div>
  );
};
