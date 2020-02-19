import * as yup from 'yup';
import { PipelineResourceTask } from '../../../utils/pipeline-augment';

const taskResourceValidation = yup.array().of(
  yup.object({
    name: yup.string().required('Required'),
    resource: yup.string().required('Required'),
  }),
);

export const getValidationSchema = (
  clusterTasks: PipelineResourceTask[],
  namespacedTasks: PipelineResourceTask[],
) => {
  return yup.object({
    name: yup.string().required('Required'),
    params: yup.array().of(
      yup.object({
        name: yup.string().required('Required'),
        description: yup.string(),
        default: yup.string(),
      }),
    ),
    resources: yup.array().of(
      yup.object({
        name: yup.string().required('Required'),
        type: yup.string().required('Required'),
      }),
    ),
    tasks: yup
      .array()
      .of(
        yup.object({
          name: yup.string().required('Required'),
          runAfter: yup.array().of(yup.string()),
          taskRef: yup
            .object({
              name: yup.string().required('Required'),
              kind: yup.string(),
            })
            .required('Required'),
          resources: yup.object({
            inputs: taskResourceValidation,
            outputs: taskResourceValidation,
          }),
        }),
      )
      .min(1, 'Must define at least one task')
      .required('Required'),
    taskList: yup.array().of(
      yup.object({
        name: yup.string().required('Required'),
        runAfter: yup.string(),
      }),
    ),
  });
};
