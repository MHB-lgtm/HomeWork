import CourseDetailsPageClient from './page-client';

type CourseDetailsPageProps = {
  params: { courseId: string };
};

export default function CourseDetailsPage({ params }: CourseDetailsPageProps) {
  return <CourseDetailsPageClient params={params} />;
}
