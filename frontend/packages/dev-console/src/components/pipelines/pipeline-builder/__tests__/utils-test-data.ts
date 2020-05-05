import { PipelineMixedNodeModel } from '../../pipeline-topology/types';
import { createBuilderNode, createSpacerNode } from '../../pipeline-topology/utils';

const node = (name: string, runAfter?: string[]) =>
  createBuilderNode(name, {
    task: { name, taskRef: { name }, runAfter },
    onAddNode: jest.fn(),
    onNodeSelection: jest.fn(),
  });

const spacer = (name: string, runAfter?: string[]) =>
  createSpacerNode(name, { task: { name, runAfter } });

export enum PathType {
  ONE_PATH,
  TWO_PATHS,
  THREE_STARTS_ONE_PATH,
  TWO_STARTS_JOINED_PATHS,
  X_JOINED_PATH,
}

export const NODE_PATHS: { [key in PathType]: PipelineMixedNodeModel[] } = {
  /**
   * A - B
   */
  [PathType.ONE_PATH]: [node('A'), node('B', ['A'])],
  /**
   * A - B - C
   *   \
   *     D
   *
   * E - F
   */
  [PathType.TWO_PATHS]: [
    node('A'),
    node('B', ['A']),
    node('C', ['B']),
    node('D', ['A']),
    node('E'),
    node('F', ['E']),
  ],
  /**
   * A - D - G - I
   *           /
   * B - E - H
   *       /
   * C - F
   */
  [PathType.THREE_STARTS_ONE_PATH]: [
    node('A'),
    node('B'),
    node('C'),
    node('D', ['A']),
    node('E', ['B']),
    node('F', ['C']),
    node('H', ['E', 'F']),
    node('I', ['G', 'H']),
  ],
  /**
   * A - B - C --- H
   *   \   /     /
   *     D      |
   *           /
   * E - F - G
   */
  [PathType.TWO_STARTS_JOINED_PATHS]: [
    node('A'),
    node('B', ['A']),
    node('C', ['B', 'D']),
    node('D', ['A']),
    node('E'),
    node('F', ['E']),
    node('G', ['F']),
    node('H', ['C', 'G']),
  ],
  /**
   * A - . - C - E
   *   /   \
   * B       D - F
   */
  [PathType.X_JOINED_PATH]: [
    node('A'),
    node('B'),
    spacer('.', ['A', 'B']),
    node('C', ['.']),
    node('D', ['.']),
    node('E', ['C']),
    node('F', ['D']),
  ],
};
