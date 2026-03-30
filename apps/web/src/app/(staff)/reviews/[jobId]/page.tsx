import ReviewPageClient from '@/app/[locale]/reviews/[jobId]/page';

type StaffReviewPageProps = {
  params: Promise<{ jobId: string }>;
};

export default function StaffReviewPage({ params }: StaffReviewPageProps) {
  return <ReviewPageClient params={params} />;
}
