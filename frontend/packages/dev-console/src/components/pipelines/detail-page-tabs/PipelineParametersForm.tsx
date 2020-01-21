import * as React from 'react';
import * as _ from 'lodash';
import { Form } from '@patternfly/react-core';
import { FormikProps, FormikValues } from 'formik';
import { useAccessReview } from '@console/internal/components/utils';
import { getActiveNamespace } from '@console/internal/actions/ui';
import { FormFooter } from '@console/shared';
import PipelineParameters from './PipelineParameters';

const PipelineParametersForm: React.FC<FormikProps<FormikValues>> = ({
  handleSubmit,
  handleReset,
  isSubmitting,
  status,
  errors,
  dirty,
}) => {
  const pipelineParameterAccess = useAccessReview({
    group: 'tekton.dev',
    resource: 'pipelines',
    namespace: getActiveNamespace(),
    verb: 'update',
  });
  return (
    <Form onSubmit={handleSubmit}>
      <div className="co-m-pane__form">
        <PipelineParameters fieldName="parameters" isReadOnly={!pipelineParameterAccess} />
        <hr />
        {pipelineParameterAccess && (
          <FormFooter
            handleReset={handleReset}
            isSubmitting={isSubmitting}
            errorMessage={status && status.submitError}
            successMessage={status && !dirty && status.success}
            disableSubmit={!dirty || !_.isEmpty(errors)}
            showAlert={dirty}
          />
        )}
      </div>
    </Form>
  );
};

export default PipelineParametersForm;
