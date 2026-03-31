import StudentResultDetailsPageClient from '@/app/results/[assignmentId]/page-client';

type StudentResultDetailsPageProps = {
  params: {
    assignmentId: string;
  };
};

export default function StudentResultDetailsPage({
  params,
}: StudentResultDetailsPageProps) {
  return <StudentResultDetailsPageClient params={params} />;
}
