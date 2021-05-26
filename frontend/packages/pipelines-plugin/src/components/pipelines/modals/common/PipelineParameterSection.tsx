import * as React from 'react';
import { FieldArray, useFormikContext } from 'formik';
import { useTranslation } from 'react-i18next';
import { TextInputTypes } from '@patternfly/react-core';
import { InputField } from '@console/shared';
import FormSection from '@console/dev-console/src/components/import/section/FormSection';
import { TektonParam } from '../../../../types';
import { paramIsRequired } from '../../../../utils/general-utils';
import AutoCompletePopover from '../../../shared/common/auto-complete/AutoCompletePopover';
import { AddTriggerFormValues } from '../triggers/types';

type ParametersSectionProps = {
  autoCompleteValues?: string[];
  parameters: TektonParam[];
};

const PipelineParameterSection: React.FC<ParametersSectionProps> = ({
  autoCompleteValues,
  parameters,
}) => {
  const { t } = useTranslation();

  const { setFieldValue } = useFormikContext<AddTriggerFormValues>();

  return (
    <FieldArray
      name="parameters"
      key="parameters-row"
      render={() =>
        parameters.length > 0 && (
          <FormSection title={t('pipelines-plugin~Parameters')} fullWidth>
            {parameters.map((parameter, index) => {
              const name = `parameters.${index}.default`;
              const isRequired = paramIsRequired(parameter);

              const input = (ref?) => (
                <InputField
                  ref={ref}
                  key={parameter.name}
                  name={name}
                  type={TextInputTypes.text}
                  label={parameter.name}
                  helpText={parameter.description}
                  required={isRequired}
                  autoComplete="off"
                />
              );

              return autoCompleteValues ? (
                <AutoCompletePopover
                  key={parameter.name}
                  autoCompleteValues={autoCompleteValues}
                  onAutoComplete={(value: string) => setFieldValue(name, value)}
                >
                  {(callbackRef) => input(callbackRef)}
                </AutoCompletePopover>
              ) : (
                input()
              );
            })}
          </FormSection>
        )
      }
    />
  );
};

export default PipelineParameterSection;
