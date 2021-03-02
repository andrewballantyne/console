import { K8sResourceCommon } from '@console/internal/module/k8s';
import { TektonParam, TektonResource, TektonTaskSteps } from './coreTekton';
import { PipelineTaskWorkspace } from './pipeline';

export type TaskResult = {
  name: string;
  description?: string;
};

export type TaskKind = K8sResourceCommon & {
  spec: {
    params?: TektonParam[];
    resources?: {
      inputs?: TektonResource[];
      outputs?: TektonResource[];
    };
    workspaces?: PipelineTaskWorkspace[];

    steps: TektonTaskSteps[];
    results?: TaskResult[];
  };
};
