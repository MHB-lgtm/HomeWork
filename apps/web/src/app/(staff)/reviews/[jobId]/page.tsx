import ReviewPageClient from '@/app/reviews/[jobId]/page-client';

type StaffReviewPageProps = {
  params: Promise<{ jobId: string }>;
};

export default function StaffReviewPage({ params }: StaffReviewPageProps) {
  return <ReviewPageClient params={params} />;
}
