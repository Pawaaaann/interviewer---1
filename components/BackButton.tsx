"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const BackButton = () => {
  const router = useRouter();
  const pathname = usePathname();

  // Don't show back button on the main dashboard
  if (pathname === '/') {
    return null;
  }

  const handleBack = () => {
    router.back();
  };

  return (
    <Button 
      onClick={handleBack}
      className="btn-secondary flex items-center gap-2"
      type="button"
    >
      <ArrowLeft size={16} />
      Back
    </Button>
  );
};

export default BackButton;