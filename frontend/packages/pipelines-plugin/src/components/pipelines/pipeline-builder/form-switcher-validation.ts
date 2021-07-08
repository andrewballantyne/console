import * as _ from 'lodash';
import { safeJSToYAML } from '@console/shared/src/utils/yaml';
import { PipelineKind } from '../../../types';
import { initialPipelineFormData } from './const';
import { pipelineBuilderYAMLSchema } from './switch-to-form-validation-utils';
import { PipelineBuilderFormValues } from './types';
import { convertBuilderFormToPipeline } from './utils';

export const getFormData = (
  formData: PipelineBuilderFormValues,
  yamlPipeline: PipelineKind,
): PipelineBuilderFormValues => {
  const { finally: finallyTasks, ...specProps } = yamlPipeline.spec;
  const pipelineSpecProperties = _.omit(specProps, ['listTasks', 'finallyListTasks']);
  return {
    ...formData,
    ...pipelineSpecProperties, // support & keep unknown values as well as whatever they may have changed that we use
    name: yamlPipeline.metadata?.name,
    finallyTasks,
  };
};
export const validateFormData = async (
  newFormData: PipelineBuilderFormValues,
  yamlPipeline: PipelineKind,
) => {
  return pipelineBuilderYAMLSchema(newFormData).validate(yamlPipeline, {
    abortEarly: false,
    strict: true,
  });
};
export const safeOmit = (object: PipelineKind, path: string): PipelineKind => {
  // Check if it's a `path.to.array[#]`
  const match = path.match(/(.*)\[(\d+)\]$/);
  if (match) {
    const [, pathToArray, index] = match;
    if (pathToArray && index) {
      return _.update(object, pathToArray, (array) => {
        array.splice(index, 1);
        return array;
      });
    }
  }
  return _.omit(object, path);
};

export const handleSanitizeToFormError = async (
  formData: PipelineBuilderFormValues,
  error: any,
  yamlPipeline: PipelineKind,
) => {
  const paths: string[] = error?.inner?.map((err) => err.path) || [];
  const validatedYamlData: PipelineKind = paths.reduce(
    (acc: PipelineKind, pathOrPaths: string | string[]) => {
      const processPath = (pipeline: PipelineKind, currPath: string) => {
        const pathComponents = currPath.split('.');
        const lastPathItem: string = pathComponents[pathComponents.length - 1];
        switch (lastPathItem) {
          case 'name': {
            const namePath = pathComponents.slice(0, pathComponents.length - 1).join('.');
            return safeOmit(pipeline, namePath);
          }
          case 'runAfter':
          default:
            return safeOmit(pipeline, currPath);
        }
      };

      if (Array.isArray(pathOrPaths)) {
        return pathOrPaths.reduce(processPath, acc);
      }

      return processPath(acc, pathOrPaths);
    },
    yamlPipeline,
  );
  const validatedFormData = getFormData(formData, validatedYamlData);
  try {
    await validateFormData(formData, validatedYamlData);
  } catch (err) {
    return undefined;
  }
  return _.merge({}, initialPipelineFormData, validatedFormData);
};

export const sanitizeToForm = async (
  formData: PipelineBuilderFormValues,
  yamlPipeline: PipelineKind,
) => {
  const newFormData: PipelineBuilderFormValues = getFormData(formData, yamlPipeline);
  try {
    await validateFormData(newFormData, yamlPipeline);
  } catch (error) {
    const safeReturn =
      (await handleSanitizeToFormError(newFormData, error, yamlPipeline)) || formData;
    return () => safeReturn;
  }
  return _.merge({}, initialPipelineFormData, newFormData);
};

export const sanitizeToYaml = (
  formData: PipelineBuilderFormValues,
  namespace: string,
  existingPipeline?: PipelineKind,
) =>
  safeJSToYAML(convertBuilderFormToPipeline(formData, namespace, existingPipeline), 'yamlData', {
    skipInvalid: true,
  });
