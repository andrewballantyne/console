import * as React from 'react';
import { Formik, FormikBag } from 'formik';
import { history } from '@console/internal/components/utils';
import { k8sCreate, k8sUpdate } from '@console/internal/module/k8s';
import { PipelineModel } from '../../../models';
import { Pipeline, PipelineResourceTask } from '../../../utils/pipeline-augment';
import PipelineBuilderForm from './PipelineBuilderForm';
import { PipelineBuilderFormValues, PipelineBuilderFormikValues } from './types';
import {
  convertBuilderFormToPipeline,
  convertPipelineToBuilderForm,
  getPipelineURL,
} from './utils';
import { getValidationSchema } from './validation-utils';

type PipelineBuilderPageProps = {
  clusterTasks: PipelineResourceTask[];
  existingPipeline?: Pipeline;
  namespace?: string;
  namespacedTasks: PipelineResourceTask[];
};

const PipelineBuilderFormikWrapper: React.FC<PipelineBuilderPageProps> = (props) => {
  const { clusterTasks, existingPipeline, namespace, namespacedTasks } = props;

  const initialValues: PipelineBuilderFormValues = {
    name: 'new-pipeline',
    params: [],
    resources: [],
    tasks: [],
    listTasks: [],
    ...(convertPipelineToBuilderForm(existingPipeline) || {}),
    clusterTasks,
    namespacedTasks,
  };

  const handleSubmit = (
    values: PipelineBuilderFormikValues,
    actions: FormikBag<any, PipelineBuilderFormValues>,
  ) => {
    let resourceCall;
    if (existingPipeline) {
      resourceCall = k8sUpdate(
        PipelineModel,
        convertBuilderFormToPipeline(values, namespace, existingPipeline),
        namespace,
        existingPipeline.metadata.name,
      );
    } else {
      resourceCall = k8sCreate(PipelineModel, convertBuilderFormToPipeline(values, namespace));
    }

    return resourceCall
      .then(() => {
        actions.setSubmitting(false);
        history.push(`${getPipelineURL(namespace)}/${values.name}`);
      })
      .catch((e) => {
        actions.setStatus({ submitError: e.message });
      });
  };

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={handleSubmit}
      onReset={history.goBack}
      validationSchema={getValidationSchema(clusterTasks, namespacedTasks)}
      render={(formikProps) => (
        <PipelineBuilderForm
          {...formikProps}
          namespace={namespace}
          existingPipeline={existingPipeline}
        />
      )}
    />
  );
};

export default PipelineBuilderFormikWrapper;
