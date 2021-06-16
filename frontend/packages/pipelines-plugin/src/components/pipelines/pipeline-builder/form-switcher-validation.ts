import * as _ from 'lodash';
import { safeJSToYAML } from '@console/shared/src/utils/yaml';
import { PipelineKind } from '../../../types';
import { initialPipelineFormData } from './const';
import { pipelineBuilderYAMLSchema } from './switch-to-form-validation-utils';
import {
  PipelineBuilderFormikValues,
  PipelineBuilderFormValues,
  PipelineBuilderFormYamlValues,
} from './types';
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
export const validateFormData = (
  prevValues: PipelineBuilderFormikValues,
  newFormData: PipelineBuilderFormValues,
  yamlPipeline: PipelineKind,
) => {
  const newValues: PipelineBuilderFormYamlValues = { ...prevValues, formData: newFormData };
  return pipelineBuilderYAMLSchema(newValues).validate(yamlPipeline, {
    abortEarly: false,
    strict: true,
  });
};
export const safeOmit = (object, path) => {
  const acc = _.omit(object, path);
  const pathComponents = path.split('.');
  const objectKeys = Object.keys(acc[pathComponents[0]]);
  const objectKey = objectKeys.find((key) =>
    pathComponents[pathComponents.length - 1].startsWith(key),
  );
  const omittedObjectContainerPath = [
    pathComponents.slice(0, pathComponents.length - 1),
    objectKey,
  ].join('.');
  const omittedObjectContainer = _.get(acc, omittedObjectContainerPath, undefined);
  return Array.isArray(omittedObjectContainer)
    ? _.set(acc, omittedObjectContainerPath, _.filter(omittedObjectContainer))
    : acc;
};

export const handleSanitizeToFormError = (
  prevValues: PipelineBuilderFormikValues,
  formData: PipelineBuilderFormValues,
  error: any,
  yamlPipeline: PipelineKind,
) => {
  const paths: string[] = error?.inner?.map((err) => err.path);
  const validatedYamlData: PipelineKind = paths.reduce((acc, currPath) => {
    const pathComponents = currPath.split('.');
    const lastPathItem: string = pathComponents[pathComponents.length - 1];
    switch (lastPathItem) {
      case 'name': {
        const path = pathComponents.slice(0, pathComponents.length - 1).join('.');
        return safeOmit(acc, path);
      }
      case 'runAfter':
        return safeOmit(acc, currPath);
      default:
        return safeOmit(acc, currPath);
    }
  }, yamlPipeline);
  const validatedFormData = getFormData(formData, validatedYamlData);
  try {
    validateFormData(prevValues, formData, validatedYamlData);
  } catch (err) {
    return undefined;
  }
  return _.merge({}, initialPipelineFormData, validatedFormData);
};

export const sanitizeToForm = async (
  values: PipelineBuilderFormikValues,
  formData: PipelineBuilderFormValues,
  yamlPipeline: PipelineKind,
) => {
  const newFormData: PipelineBuilderFormValues = getFormData(formData, yamlPipeline);
  try {
    await validateFormData(values, newFormData, yamlPipeline);
  } catch (error) {
    return () => handleSanitizeToFormError(values, newFormData, error, yamlPipeline);
  }
  return _.merge({}, initialPipelineFormData, newFormData);
};

export const sanitizeToYaml = (
  formData: PipelineBuilderFormValues,
  namespace: string,
  existingPipeline: PipelineKind,
) =>
  safeJSToYAML(convertBuilderFormToPipeline(formData, namespace, existingPipeline), 'yamlData', {
    skipInvalid: true,
  });
