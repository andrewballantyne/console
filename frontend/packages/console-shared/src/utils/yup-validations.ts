import yup from 'yup';
import i18n from 'i18next';

const nameRegex = /^([a-z]([-a-z0-9]*[a-z0-9])?)*$/;
export const nameValidationSchema = yup
  .string()
  .matches(nameRegex, {
    message: i18n.t(
      'console-shared~Name must consist of lower-case letters, numbers and hyphens. It must start with a letter and end with a letter or number.',
    ),
    excludeEmptyString: true,
  })
  .max(253, i18n.t('console-shared~Cannot be longer than 253 characters.'))
  .required(i18n.t('console-shared~Required'));
