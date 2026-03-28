import { ReviewView } from "@/components/review-view";

export default function ReviewPage({
  params
}: {
  params: {
    applicationId: string;
  };
}) {
  return <ReviewView applicationId={params.applicationId} />;
}
