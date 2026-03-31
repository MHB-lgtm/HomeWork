import AssignmentDetailsPageClient from '@/app/assignments/[assignmentId]/page-client';

type AssignmentDetailsPageProps = {
  params: {
    assignmentId: string;
  };
};

export default function AssignmentDetailsPage({
  params,
}: AssignmentDetailsPageProps) {
  return <AssignmentDetailsPageClient params={params} />;
}
