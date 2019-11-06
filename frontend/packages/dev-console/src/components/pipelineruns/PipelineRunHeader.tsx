import { sortable } from '@patternfly/react-table';
import { tableColumnClasses } from './pipelinerun-table';

const PipelineRunHeader = () => {
  return [
    {
      title: 'Name',
      sortField: 'metadata.name',
      transforms: [sortable],
      props: { className: tableColumnClasses[0] },
    },
    {
      title: 'Started',
      sortField: 'status.startTime',
      transforms: [sortable],
      props: { className: tableColumnClasses[1] },
    },
    {
      title: 'Status',
      sortField: 'status.completionTime',
      transforms: [sortable],
      props: { className: tableColumnClasses[2] },
    },
    {
      title: 'Task Status',
      sortField: 'status.completionTime',
      transforms: [sortable],
      props: { className: tableColumnClasses[3] },
    },
    {
      title: '',
      props: { className: tableColumnClasses[4] },
    },
  ];
};

export default PipelineRunHeader;
