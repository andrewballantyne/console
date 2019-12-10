import * as React from 'react';
import * as _ from 'lodash';
import { observer } from 'mobx-react';
import {
  ComponentFactory,
  DagreLayout,
  Edge,
  Graph,
  GraphComponent,
  LayoutFactory,
  ModelKind,
  Node,
  Visualization,
  VisualizationSurface,
} from '@console/topology/src';
import { k8sGet } from '@console/internal/module/k8s';
import { Edge as EdgeType, Node as NodeType } from '../../../topology/topology-types';
import { getPipelineTasks } from '../../../../utils/pipeline-utils';
import './PipelineVisualizationTask.scss';
import { PipelineModel } from '../../../../models';
import { pipelineRunFilterReducer } from '../../../../utils/pipeline-filter-reducer';
import { PipelineVisualizationTask } from './PipelineVisualizationTask';

const useDefaultColor = true;
const lineThickness = useDefaultColor ? 1 : 2;

const MyNode: React.FC<{ element: Node }> = ({ element }) => {
  const { height, width } = element.getBounds();
  const { color, node: task, pipeline } = element.getData();
  const reuseExisting = pipeline && pipeline.latestRun;

  let node = null;
  if (reuseExisting) {
    node = (
      <PipelineVisualizationTask
        pipelineRun={pipeline.latestRun}
        task={task}
        pipelineRunStatus={pipelineRunFilterReducer(pipeline.latestRun)}
        namespace={pipeline.metadata.namespace}
      />
    );
  } else {
    node = (
      <div
        className="odc-pipeline-vis-task__content"
        style={{ borderColor: color, borderWidth: lineThickness }}
      >
        <div className="odc-pipeline-vis-task__title-wrapper is-text-center">
          <div className="odc-pipeline-vis-task__title">{task.name}</div>
        </div>
      </div>
    );
  }

  return (
    <foreignObject width={width} height={height}>
      {node}
    </foreignObject>
  );
};

const MyEdge: React.FC<{ element: Edge }> = ({ element }) => {
  const startPoint = element.getStartPoint();
  const endPoint = element.getEndPoint();

  const linePoints = [];
  linePoints.push(`M ${startPoint.x},${startPoint.y}`);
  if (startPoint.y !== endPoint.y) {
    // Different levels, bend up to the line
    const d = startPoint.x > endPoint.x ? -1 : 1;
    const bendDistance = Math.floor(Math.abs(startPoint.x - endPoint.x) / 2);
    const distance = 0.9;

    const point1X = startPoint.x + bendDistance * d;
    const cornerPointPre1 = `${point1X * distance},${startPoint.y}`;
    const cornerPoint1 = `${point1X},${startPoint.y}`;
    const cornerPointPost1 = `${point1X},${(startPoint.y - endPoint.y) * distance + endPoint.y}`;
    linePoints.push(`L ${cornerPointPre1} Q ${cornerPoint1} ${cornerPointPost1}`);

    const cornerPointB = `${endPoint.x - bendDistance * d},${endPoint.y}`;

    linePoints.push(`L ${cornerPointB}`);
  }
  linePoints.push(`L ${endPoint.x},${endPoint.y}`);

  return (
    <path
      d={linePoints.join(' ')}
      stroke={element.getData().color}
      strokeWidth={lineThickness}
      fill="none"
    />
  );
};

const ObservedNode = observer(MyNode);

const componentFactory: ComponentFactory = (kind: ModelKind) => {
  switch (kind) {
    case ModelKind.graph:
      return GraphComponent;
    case ModelKind.node:
      return ObservedNode;
    case ModelKind.edge:
      return MyEdge;
    default:
      return undefined;
  }
};

class DagreCustomLayout extends DagreLayout {
  layout() {
    super.layout();

    const nodes = this.graph.getNodes();
    const firstNodes = nodes.filter((node) => {
      const data = node.getData();
      return !data.runAfter;
    });
    if (firstNodes.length === 1) {
      return;
    }

    const firstNodeX = firstNodes.reduce(
      (acc, node) => Math.min(node.getBounds().x, acc),
      Infinity,
    );
    firstNodes.map((node) => {
      node.getBounds().setLocation(firstNodeX, node.getBounds().y);
      return node;
    });
  }
}

const layoutFactory: LayoutFactory = (type: string, graph: Graph) => {
  switch (type) {
    case 'Dagre-default':
      return new DagreLayout(graph);
    case 'Dagre-custom':
      return new DagreCustomLayout(graph, { ranker: 'tight-tree' });
    case 'Dagre-inverse':
      return new DagreLayout(graph, { rankdir: 'RL' });
    default:
      return undefined;
  }
};

const PipelineTest: React.FC<any> = ({ model }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current === null) {
      ref.current = new Visualization();
      ref.current.registerLayoutFactory(layoutFactory);
      ref.current.registerComponentFactory(componentFactory);
    }
    // console.debug(
    //   '++++++\n',
    //   model.nodes.map((n) => `${n.id}: ${_.get(n, 'data.node.status.reason')}`).join(',\n'),
    // );
    ref.current.fromModel(model);
  }, [model]);

  if (!ref.current) return null;

  return <VisualizationSurface visualization={ref.current} />;
};

const colorList = [
  'green',
  'blue',
  'orange',
  'maroon',
  'red',
  'magenta',
  'black',
  'olive',
  'purple',
];
let i = 0;

const colors = {};
const getColor = (id) => {
  if (useDefaultColor) {
    return 'var(--pf-global--BorderColor--light-100)';
  }

  if (colors[id]) {
    return colors[id];
  }

  const color = colorList[i++];
  colors[id] = color;

  if (i >= colorList.length) {
    i = 0;
  }

  return color;
};

const WIDTH = 120;
const HEIGHT = 30;
const makeNode = (node) => ({
  data: {
    node,
    color: getColor(node.name),
  },
  id: node.name,
  width: WIDTH,
  height: HEIGHT,
});

const pipelineToNodesAndEdges = (pipeline, mapForNode) => {
  const graph = getPipelineTasks(pipeline, pipeline.latestRun);
  const graphColumns: NodeType[][] = graph.map(mapForNode);
  const flatNodes: NodeType[] = _.flatten(graphColumns).map((n) => ({
    ...n,
    data: { ...n.data, pipeline },
  }));

  const edges: EdgeType[] = _.flatten(
    flatNodes
      .map((node) => {
        const thisId = node.id;
        const beforeIds = ((node.data as any).node as any).runAfter || [];

        if (beforeIds.length === 0) return null;

        return beforeIds.map((beforeId) => ({
          id: `e${thisId}-${beforeId}`,
          type: 'edge',
          source: beforeId,
          target: thisId,
          data: { color: getColor(thisId) },
        }));
      })
      .filter((e) => !!e),
  );

  return {
    nodes: flatNodes,
    edges,
  };
};

const getTitle = (variant) => {
  switch (variant) {
    case 'custom':
      return 'Topology w/ Custom Dagre Layout';
    case 'inverse':
      return 'Topology w/ Dagre Layout (Inverse Edge Direction)';
    case 'default':
    default:
      return 'Topology w/ Dagre Layout';
  }
};

const DagreVisualization = ({ dagreVariant = 'default', pipeline }) => {
  const items = pipelineToNodesAndEdges(pipeline, (columnNodes) => {
    return columnNodes.map(makeNode);
  });

  if (dagreVariant === 'inverse') {
    items.edges = items.edges.map((edge) => ({
      ...edge,
      source: edge.target,
      target: edge.source,
    }));
  }

  const title = getTitle(dagreVariant);

  return (
    <div style={{ marginBottom: 15 }}>
      {title && <p>{title}</p>}
      <div
        style={{
          background: '#eee',
          borderRadius: 20,
          fontSize: 12,
          overflow: 'hidden',
        }}
      >
        <PipelineTest
          model={{
            graph: {
              type: 'graph',
              layout: `Dagre-${dagreVariant}`,
            },
            nodes: items.nodes,
            edges: items.edges,
          }}
        />
      </div>
    </div>
  );
};

export const PipelineTopologyVisualization = ({ pipeline }) => {
  return (
    <>
      <DagreVisualization pipeline={pipeline} />
      <DagreVisualization dagreVariant="custom" pipeline={pipeline} />
      <DagreVisualization dagreVariant="inverse" pipeline={pipeline} />
    </>
  );
};

export const PipelineRunTopologyVisualization = ({ pipelineRun }) => {
  const [pipeline, setPipeline] = React.useState(null);

  React.useEffect(() => {
    k8sGet(PipelineModel, pipelineRun.spec.pipelineRef.name, pipelineRun.metadata.namespace)
      .then((res) => {
        setPipeline(res);
      })
      .catch(console.error);
  });

  if (!pipeline) return null;

  return <DagreVisualization pipeline={{ ...pipeline, latestRun: pipelineRun }} />;
};
