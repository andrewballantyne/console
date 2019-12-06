import * as React from 'react';
import * as _ from 'lodash';
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
import { Edge as EdgeType, Node as NodeType } from '../../../topology/topology-types';
import { getPipelineTasks } from '../../../../utils/pipeline-utils';
import './PipelineVisualizationTask.scss';

const useDefaultColor = true;
const lineThickness = useDefaultColor ? 1 : 2;

type MyNodeType = {
  element: Node;
};

const MyNode: React.FC<MyNodeType> = ({ element }) => {
  const { height, width } = element.getBounds();

  return (
    <foreignObject width={width} height={height}>
      <div
        className="odc-pipeline-vis-task__content"
        style={{ borderColor: element.getData().color, borderWidth: lineThickness }}
      >
        <div className="odc-pipeline-vis-task__title-wrapper is-text-center">
          <div className="odc-pipeline-vis-task__title">{element.getData().name}</div>
        </div>
      </div>
    </foreignObject>
  );
};

type MyEdgeProps = {
  element: Edge;
};

const MyEdge: React.FC<MyEdgeProps> = ({ element }) => {
  const startPoint = element.getStartPoint();
  const endPoint = element.getEndPoint();

  const pathPoints = [];
  pathPoints.push(`${startPoint.x},${startPoint.y}`);
  if (startPoint.y !== endPoint.y) {
    // Different levels, bend up to the line
    const d = startPoint.x > endPoint.x ? -1 : 1;
    const bendDistance = Math.floor(Math.abs(startPoint.x - endPoint.x) / 2);
    pathPoints.push(
      `${startPoint.x + bendDistance * d},${startPoint.y}`,
      `${endPoint.x - bendDistance * d},${endPoint.y}`,
    );
  }
  pathPoints.push(`${endPoint.x},${endPoint.y}`);

  return (
    <polyline
      stroke={element.getData().color}
      strokeWidth={lineThickness}
      points={pathPoints.join(' ')}
      fill="none"
    />
  );
};

const componentFactory: ComponentFactory = (kind: ModelKind) => {
  switch (kind) {
    case ModelKind.graph:
      return GraphComponent;
    case ModelKind.node:
      return MyNode;
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
    ...node,
    color: getColor(node.name),
  },
  id: node.name,
  width: WIDTH,
  height: HEIGHT,
});

const pipelineToNodesAndEdges = (pipeline, mapForNode) => {
  const graph = getPipelineTasks(pipeline);
  const graphColumns: NodeType[][] = graph.map(mapForNode);
  const flatNodes: NodeType[] = _.flatten(graphColumns);

  const edges: EdgeType[] = _.flatten(
    flatNodes
      .map((node) => {
        const thisId = node.id;
        const beforeIds = (node.data as any).runAfter || [];

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

  return (
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
  );
};

const styles = {
  background: '#eee',
  borderRadius: 20,
  fontSize: 12,
  overflow: 'hidden',
};

const PipelineTopologyVisualization = ({ pipeline }) => {
  return (
    <>
      <p>Topology w/ Dagre Layout</p>
      <div style={styles}>
        <DagreVisualization pipeline={pipeline} />
      </div>
      <br />
      <p>Topology w/ Custom Dagre Layout</p>
      <div style={styles}>
        <DagreVisualization dagreVariant="custom" pipeline={pipeline} />
      </div>
      <br />
      <p>Topology w/ Dagre Layout (Inverse Edge Direction)</p>
      <div style={styles}>
        <DagreVisualization dagreVariant="inverse" pipeline={pipeline} />
      </div>
      <br />
    </>
  );
};

export default PipelineTopologyVisualization;
