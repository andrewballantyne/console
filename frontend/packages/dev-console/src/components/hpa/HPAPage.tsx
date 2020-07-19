import * as React from 'react';
import { Helmet } from 'react-helmet';
import { PageBody } from '@console/shared';
import { LoadingInline, PageComponentProps } from '@console/internal/components/utils';
import { useK8sWatchResource } from '@console/internal/components/utils/k8s-watch-hook';
import { getGroupVersionKind, K8sResourceKind } from '@console/internal/module/k8s';
import { HorizontalPodAutoscalerModel } from '@console/internal/models';
import NamespacedPage, { NamespacedPageVariants } from '../NamespacedPage';
import HPAFormikForm from './HPAFormikForm';
import HPAPageHeader from './HPAPageHeader';
import { getLimitWarning, VALID_HPA_TARGET_KINDS } from './hpa-utils';
import { useRelatedHPA } from './hooks';

const HPAPage: React.FC<PageComponentProps> = (props) => {
  const {
    match: {
      params: { ns, resourceRef, name },
      path,
    },
  } = props;
  const editHPA = path === '/workload-hpa/:ns/:resourceRef/:name/edit';
  const [group, version, kind] = getGroupVersionKind(resourceRef);
  const [hpa, hpaError] = useRelatedHPA(`${group}/${version}`, kind, name, ns);
  const resource = React.useMemo(
    () => ({
      kind,
      namespace: ns,
      name,
    }),
    [kind, ns, name],
  );
  const [data, loaded, workloadError] = useK8sWatchResource<K8sResourceKind>(resource);

  const fullyLoaded = editHPA ? !!hpa && !!data : loaded && !!data;
  const error = (editHPA ? hpaError : null) || workloadError?.message;

  const validSupportedType = VALID_HPA_TARGET_KINDS.includes(kind);
  const title = `${editHPA ? 'Edit' : 'Add'} ${HorizontalPodAutoscalerModel.label}`;
  return (
    <NamespacedPage disabled variant={NamespacedPageVariants.light} hideApplications>
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <PageBody flexLayout>
        <HPAPageHeader
          kind={kind}
          limitWarning={loaded && validSupportedType ? getLimitWarning(data) : null}
          loadError={error}
          name={name}
          title={title}
          validSupportedType={validSupportedType}
        />
        {!error && validSupportedType && (
          <>
            {fullyLoaded ? (
              <HPAFormikForm existingHPA={hpa} targetResource={data} />
            ) : (
              <LoadingInline />
            )}
          </>
        )}
      </PageBody>
    </NamespacedPage>
  );
};

export default HPAPage;
