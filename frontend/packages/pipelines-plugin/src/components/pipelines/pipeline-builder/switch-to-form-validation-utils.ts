import i18n from 'i18next';
import * as yup from 'yup';
import { nameValidationSchema } from '@console/shared';
import { PipelineTask } from '../../../types';
import { PipelineBuilderFormYamlValues } from './types';
import { validRunAfter } from './validation-utils';

const resourceDefinitionYAML = () => {
  return yup.array().of(
    yup.object({
      name: yup.string(),
      resource: yup.string(),
    }),
  );
};

const taskValidationYAMLSchema = (formValues: PipelineBuilderFormYamlValues) => {
  return yup.array().of(
    yup
      .object({
        name: nameValidationSchema((tKey) => i18n.t(tKey)),
        taskRef: yup
          .object({
            name: yup.string(),
            kind: yup.string(),
          })
          .default(undefined),
        taskSpec: yup.object(),
        runAfter: validRunAfter(formValues),
        params: yup.array().of(
          yup.object({
            name: yup.string(),
            value: yup.lazy((value) => {
              if (Array.isArray(value)) {
                return yup.array().of(yup.string());
              }
              return yup.string();
            }),
          }),
        ),
        resources: yup.object({
          inputs: resourceDefinitionYAML(),
          outputs: resourceDefinitionYAML(),
        }),
        when: yup.array().of(
          yup.object({
            input: yup.string(),
            operator: yup.string(),
            values: yup.array().of(yup.string()),
          }),
        ),

        workspaces: yup.array().of(
          yup.object({
            name: yup.string(),
            workspace: yup.string(),
          }),
        ),
      })
      .test(
        'taskRef-or-taskSpec',
        i18n.t('pipelines-plugin~TaskSpec or TaskRef must be provided.'),
        function(task: PipelineTask) {
          return !!task.taskRef || !!task.taskSpec;
        },
      ),
  );
};

export const pipelineBuilderYAMLSchema = (formValues: PipelineBuilderFormYamlValues) => {
  return yup.object({
    metadata: yup.object({ name: yup.string() }),
    spec: yup.object({
      params: yup.array().of(
        yup.object({
          name: yup.string(),
          description: yup.string(),
          default: yup.string(),
        }),
      ),
      resources: yup.array().of(
        yup.object({
          name: yup.string(),
          type: yup.string(),
        }),
      ),
      workspaces: yup.array().of(
        yup.object({
          name: yup.string(),
        }),
      ),
      tasks: taskValidationYAMLSchema(formValues),
      finally: taskValidationYAMLSchema(formValues),
    }),
  });
};
