import * as yup from 'yup';
import { TFunction } from 'i18next';

const nameRegex = /^([a-z]([-a-z0-9]*[a-z0-9])?)*$/;
export const nameValidationSchema = (t: TFunction) =>
  yup
    .string()
    .matches(nameRegex, {
      message: t(
        'console-shared~Name must consist of lower-case letters, numbers and hyphens. It must start with a letter and end with a letter or number.',
      ),
      excludeEmptyString: true,
    })
    .max(253, t('console-shared~Cannot be longer than 253 characters.'))
    .required(t('console-shared~Required'));
