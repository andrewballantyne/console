import { breakIntoIsolatedPaths } from '../utils';
import { NODE_PATHS, PathType } from './utils-test-data';

describe('breakIntoIsolatedNodePaths properly gets isolated paths', () => {
  const testPath = (pathType: PathType, expectedPaths: number) => {
    it(`expect ${PathType[pathType]} to return ${expectedPaths} path(s)`, () => {
      const result = breakIntoIsolatedPaths(NODE_PATHS[pathType]);
      expect(result.length).toBe(expectedPaths);
    });

    it(`expect no data loss with ${PathType[pathType]}`, () => {
      const data = NODE_PATHS[pathType];
      const result = breakIntoIsolatedPaths(data);
      const totalCount = result.reduce((total, path) => total + path.length, 0);
      expect(totalCount).toBe(data.length);
    });
  };

  testPath(PathType.ONE_PATH, 1);
  testPath(PathType.TWO_PATHS, 2);
  // testPath(PathType.THREE_STARTS_ONE_PATH, 1);
});
