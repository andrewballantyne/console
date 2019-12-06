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

type MyNodeType = {
  element: Node;
};

const MyNode: React.FC<MyNodeType> = ({ element }) => {
  const { height, width } = element.getBounds();

  // return (
  //   <g>
  //     <rect stroke="#000000" fill="#cccccc" rx={10} ry={10} width={width} height={height} />
  //     <text x={width / 2} y={height / 2} textAnchor="middle">
  //       {element.getData().name}
  //     </text>
  //   </g>
  // );
  return (
    <foreignObject width={width} height={height}>
      <div className="odc-pipeline-vis-task__content">
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

  return (
    <line
      stroke="var(--pf-global--BorderColor--light-100)"
      strokeWidth={1}
      x1={startPoint.x}
      y1={startPoint.y}
      x2={endPoint.x}
      y2={endPoint.y}
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

const layoutFactory: LayoutFactory = (type: string, graph: Graph) => {
  switch (type) {
    case 'Dagre':
      return new DagreLayout(graph);
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

const WIDTH = 140;
const HEIGHT = 35;

const pipelineToNodesAndEdges = (pipeline, mapForNode) => {
  const graph = getPipelineTasks(pipeline);
  const graphColumns: NodeType[][] = graph.map(mapForNode);
  const flatNodes: NodeType[] = _.flatten(graphColumns);

  const edges: EdgeType[] = _.flatten(
    flatNodes
      .map((node) => {
        const sourceId = node.id;
        const targetIds = (node.data as any).runAfter || [];

        if (targetIds.length === 0) return null;

        return targetIds.map((targetId) => ({
          id: `e${sourceId}-${targetId}`,
          type: 'edge',
          source: sourceId,
          target: targetId,
        }));
      })
      .filter((e) => !!e),
  );

  return {
    nodes: flatNodes,
    edges,
  };
};

const SimpleVisualization = ({ pipeline }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    ref.current = pipelineToNodesAndEdges(pipeline, (columnNodes, col) => {
      return columnNodes.map((node, row) => {
        return {
          data: node,
          id: node.name,
          x: 10 + col * WIDTH + col * 20,
          y: 10 + row * HEIGHT + row * 20,
          width: WIDTH,
          height: HEIGHT,
        };
      });
    });
  }, [pipeline]);

  if (!ref.current) return null;

  return (
    <PipelineTest
      model={{
        graph: {
          id: 'g1',
          type: 'graph',
        },
        nodes: ref.current.nodes,
        edges: ref.current.edges,
      }}
    />
  );
};

const DagreVisualization = ({ pipeline }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    ref.current = pipelineToNodesAndEdges(pipeline, (columnNodes) => {
      return columnNodes.map((node) => {
        return {
          data: node,
          id: node.name,
          width: WIDTH,
          height: HEIGHT,
        };
      });
    });
  }, [pipeline]);

  if (!ref.current) return null;

  return (
    <PipelineTest
      model={{
        graph: {
          id: 'g1',
          type: 'graph',
          layout: 'Dagre',
        },
        nodes: ref.current.nodes,
        edges: ref.current.edges,
      }}
    />
  );
};

const styles = { background: '#eee', border: '1px solid black', fontSize: 12 };

export const PipelineVisualization = ({ pipeline }) => {
  return (
    <>
      <p>Topology w/ Default Structure</p>
      <div style={styles}>
        <SimpleVisualization pipeline={pipeline} />
      </div>
      <br />
      <p>Topology w/ Dagre Layout</p>
      <div style={styles}>
        <DagreVisualization pipeline={pipeline} />
      </div>
    </>
  );
};
