import * as React from 'react';
import * as _ from 'lodash';
import { FormikProps, FormikValues } from 'formik';
import { useTranslation } from 'react-i18next';
import { FormFooter, FlexForm, FormBody } from '@console/shared/src/components/form-utils';
import { usePreventDataLossLock } from '@console/internal/components/utils';
import { DeployImageFormProps } from './import-types';
import ImageSearchSection from './image-search/ImageSearchSection';
import IconSection from './section/IconSection';
import AppSection from './app/AppSection';
import AdvancedSection from './advanced/AdvancedSection';
import ResourceSection from './section/ResourceSection';

const DeployImageForm: React.FC<FormikProps<FormikValues> & DeployImageFormProps> = ({
  values,
  errors,
  handleSubmit,
  handleReset,
  status,
  isSubmitting,
  dirty,
  projects,
}) => {
  const { t } = useTranslation();
  usePreventDataLossLock(isSubmitting);

  return (
    <FlexForm className="co-deploy-image" data-test-id="deploy-image-form" onSubmit={handleSubmit}>
      <FormBody>
        <ImageSearchSection />
        <IconSection />
        <AppSection
          project={values.project}
          noProjectsAvailable={projects.loaded && _.isEmpty(projects.data)}
        />
        <ResourceSection />
        <AdvancedSection values={values} />
      </FormBody>
      <FormFooter
        handleReset={handleReset}
        errorMessage={status && status.submitError}
        isSubmitting={isSubmitting}
        submitLabel={t('devconsole~Create')}
        sticky
        disableSubmit={!dirty || !_.isEmpty(errors) || isSubmitting}
        resetLabel={t('devconsole~Cancel')}
      />
    </FlexForm>
  );
};

export default DeployImageForm;
