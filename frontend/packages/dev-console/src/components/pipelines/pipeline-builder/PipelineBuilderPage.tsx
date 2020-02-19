import * as React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { LoadingBox } from '@console/internal/components/utils';
import { Alert } from '@patternfly/react-core';
import { Pipeline } from '../../../utils/pipeline-augment';
import { useTasks } from './hooks';
import PipelineBuilderFormikWrapper from './PipelineBuilderFormikWrapper';

import './PipelineBuilderPage.scss';

type PipelineBuilderPageProps = RouteComponentProps<{ ns?: string }> & {
  existingPipeline?: Pipeline;
};

const PipelineBuilderPage: React.FC<PipelineBuilderPageProps> = (props) => {
  const {
    existingPipeline,
    match: {
      params: { ns },
    },
  } = props;
  const { namespacedTasks, clusterTasks, errorMsg } = useTasks(ns);

  const localTaskCount = namespacedTasks?.length || 0;
  const clusterTaskCount = clusterTasks?.length || 0;
  const tasksCount = localTaskCount + clusterTaskCount;
  const tasksLoaded = !!namespacedTasks && !!clusterTasks;

  if (errorMsg) {
    // Failed to load the tasks
    return (
      <Alert variant="danger" isInline title="Error loading the tasks.">
        {errorMsg}
      </Alert>
    );
  }
  if (!tasksLoaded) {
    return <LoadingBox />;
  }
  if (tasksCount === 0) {
    // No tasks to pick from, nothing we can do here...
    return <Alert variant="danger" isInline title="Unable to locate any tasks." />;
  }

  return (
    <div className="odc-pipeline-builder-page">
      <Helmet>
        <title>Pipeline Builder</title>
      </Helmet>
      <PipelineBuilderFormikWrapper
        clusterTasks={clusterTasks}
        existingPipeline={existingPipeline}
        namespacedTasks={namespacedTasks}
        namespace={ns}
      />
    </div>
  );
};

export default PipelineBuilderPage;
