import DomainSelector from "@/components/DomainSelector";
import { getCurrentUser } from "@/lib/actions/auth.action";

const Page = async () => {
  const user = await getCurrentUser();

  return (
    <div className="container mx-auto px-4 py-8">
      <DomainSelector
        userId={user?.id!}
      />
    </div>
  );
};

export default Page;
