import CourseDetailsPageClient from '@/app/courses/[courseId]/page-client';

type StaffCourseDetailsPageProps = {
  params: { courseId: string };
};

export default function StaffCourseDetailsPage({ params }: StaffCourseDetailsPageProps) {
  return <CourseDetailsPageClient params={params} />;
}
