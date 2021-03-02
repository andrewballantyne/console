import { merge } from 'lodash';
import { getRandomChars } from '@console/shared';
import { EditorType } from '@console/shared/src/components/synced-editor/editor-toggle';
import { PipelineTask, PipelineTaskSpec, TaskKind, TektonTaskSteps } from '../../../../types';
import { initialPipelineFormData } from '../const';
import { validationSchema } from '../validation-utils';

export const createSafeTask = (name = `name-${getRandomChars()}`): PipelineTask => ({
  name,
  taskRef: {
    name: 'not-a-real-task',
  },
});

const taskSpecTemplate: TektonTaskSteps[] = [
  {
    name: 'echo',
    image: 'ubuntu',
    command: ['echo'],
    args: ['$(params.some-value-that-does-not-break-tests)'],
  },
];
const embeddedTaskTemplate: PipelineTaskSpec = {
  steps: taskSpecTemplate,
};
const externalTaskTemplate: TaskKind = {
  apiVersion: 'tekton.dev/v1beta1',
  kind: 'ClusterTask',
  metadata: {
    name: 'external-task',
  },
  spec: {
    params: [],
    steps: taskSpecTemplate,
  },
};
export const externalTaskNoDefaultParam = merge({}, externalTaskTemplate, {
  spec: { params: [{ name: 'echo-value' }] },
});
export const externalTaskWithDefaultParam = merge({}, externalTaskTemplate, {
  spec: { params: [{ name: 'echo-value-with-default', default: 'some value' }] },
});
export const externalTaskWitEmptyDefaultParam = merge({}, externalTaskTemplate, {
  spec: { params: [{ name: 'echo-value-with-default', default: '' }] },
});
export const embeddedTaskSpec = embeddedTaskTemplate;

const externalTaskWithResourcesTemplate: TaskKind = {
  apiVersion: 'tekton.dev/v1beta1',
  kind: 'ClusterTask',
  metadata: {
    name: 'external-task-with-resources',
  },
  spec: {
    params: [
      { name: 'username', description: 'The username to log the request against' },
      { name: 'branch', description: "The branch within' the source code" },
    ],
    resources: {
      inputs: [{ name: 'source-git', type: 'git' }],
      outputs: [{ name: 'source-image', type: 'image' }],
    },
    steps: [
      {
        name: 'manage-credentials',
        image: 'ubuntu',
        command: ['echo'],
        args: [
          'Logging in on behalf of $(params.username).\n\nUsername: kube:admin\nPassword: *********\n\nCredentials verified successfully.',
        ],
      },
      {
        name: 'pull-repo',
        image: 'ubuntu',
        command: ['echo'],
        args: ['git clone $(resources.inputs.source-git.url)'],
      },
    ],
  },
};
export const resourceTask = externalTaskWithResourcesTemplate;

const externalTaskWithWorkspacesTemplate: TaskKind = {
  apiVersion: 'tekton.dev/v1beta1',
  kind: 'ClusterTask',
  metadata: {
    name: 'external-task-with-workspace',
  },
  spec: {
    workspaces: [
      {
        name: 'output',
        description: 'The git repo will be cloned onto the volume backing this workspace',
      },
      {
        name: 'second',
        description: 'secondness',
      },
    ],
    steps: [
      {
        name: 'clone',
        image: 'gcr.io/tekton-releases/github.com/tektoncd/pipeline/cmd/git-init:v0.14.2',
        script: ['echo "hello"'],
      },
    ],
  },
};
export const workspaceTask = externalTaskWithWorkspacesTemplate;

// Helper test methods for .then/.catch invocations
export const hasResults = (results) => expect(results).toBeTruthy(); // success for .then
export const shouldHaveFailed = (success) => expect(success).toBe('should have failed'); // failure for .then
export const shouldHavePassed = (err) => expect(err).toBe('should not have this error'); // failure for .catch

const t = jest.fn((f) => f);
export const withFormData = (formData) =>
  validationSchema(t).validate({
    editorType: EditorType.Form,
    yamlData: '',
    formData,
  });

export const formDataBasicPassState = {
  ...initialPipelineFormData,
  tasks: [createSafeTask()],
};
