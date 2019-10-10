import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { Link } from 'react-router-dom';
import { runStatus } from '../../../utils/pipeline-augment';
import { TooltipColoredStatusIcon } from '../../pipelines/PipelineVisualizationStepList';
import Decorator from './Decorator';
import PipelineBuildDecoratorTooltip from './PipelineBuildDecoratorTooltip';

export interface PipelineBuildDecoratorProps {
  link: string;
  radius: number;
  x: number;
  y: number;
}

const PipelineBuildDecorator: React.FC<PipelineBuildDecoratorProps> = ({ link, radius, x, y }) => {
  return (
    <Tooltip
      key="build"
      content={<PipelineBuildDecoratorTooltip />}
      position={TooltipPosition.left}
    >
      <Link to={link} className="odc-decorator__link">
        <Decorator x={x} y={y} radius={radius}>
          <g transform={`translate(-${radius / 2}, -${radius / 2})`}>
            <foreignObject width="1.1em" height="1.1em" style={{ fontSize: radius }}>
              <TooltipColoredStatusIcon size={radius} status={runStatus.Succeeded} />
            </foreignObject>
          </g>
        </Decorator>
      </Link>
    </Tooltip>
  );
};

export default PipelineBuildDecorator;
