import { redirect } from "next/navigation";

type BusinessPageProps = {
  params: Promise<{ business: string }>;
};

export default async function BusinessPage({ params }: BusinessPageProps) {
  const { business } = await params;
  redirect(`/${business}/dashboard`);
}
