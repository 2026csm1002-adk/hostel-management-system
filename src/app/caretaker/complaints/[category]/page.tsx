import { notFound } from "next/navigation";
import { ComplaintQueue } from "@/components/caretaker/ComplaintQueue";
import { COMPLAINT_CATEGORIES } from "@/lib/constants";

// /caretaker/complaints/plumbing, /electrical, /carpenter ... one page per category.
export default async function CaretakerCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: raw } = await params;
  const slug = decodeURIComponent(raw).toLowerCase();
  const category = COMPLAINT_CATEGORIES.find((c) => c.toLowerCase() === slug);
  if (!category) notFound();
  return <ComplaintQueue key={category} category={category} />;
}
