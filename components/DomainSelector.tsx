"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { interviewDomains } from "@/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DomainSelectorProps {
  userId: string;
}

const DomainSelector = ({ userId }: DomainSelectorProps) => {
  const router = useRouter();
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDomainSelect = async (domainId: string) => {
    setSelectedDomain(domainId);
    setIsGenerating(true);

    const domain = interviewDomains.find(d => d.id === domainId);
    if (!domain) {
      toast.error("Invalid domain selection");
      setIsGenerating(false);
      return;
    }

    try {
      // Get a random role from the domain's common roles
      const randomRole = domain.commonRoles[Math.floor(Math.random() * domain.commonRoles.length)];
      
      // Create the interview with domain-specific data
      const response = await fetch("/api/vapi/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "Mixed", // Default to mixed for domain interviews
          role: randomRole,
          level: "Mid-level", // Default level
          techstack: domain.techStack.join(", "),
          amount: 5, // Default number of questions
          domain: domainId, // Add domain info
        }),
      });

      const data = await response.json();

      if (data.success && data.interviewId) {
        toast.success(`${domain.name} interview created successfully!`);
        router.push(`/interview/${data.interviewId}`);
      } else {
        const errorMessage = typeof data.error === 'string' ? data.error : "Failed to create interview";
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error("Error creating interview:", error);
      toast.error("Failed to create interview. Please try again.");
    } finally {
      setIsGenerating(false);
      setSelectedDomain(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Choose Your Interview Domain</h2>
        <p className="text-muted-foreground">
          Select a domain to start a specialized interview with AI
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {interviewDomains.map((domain) => (
          <div
            key={domain.id}
            className={cn(
              "card-border p-6 cursor-pointer transition-all duration-200 hover:scale-105",
              selectedDomain === domain.id && "ring-2 ring-primary"
            )}
            onClick={() => !isGenerating && handleDomainSelect(domain.id)}
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="text-4xl">{domain.icon}</div>
              <h3 className="font-semibold text-lg">{domain.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {domain.description}
              </p>
              
              <div className="flex flex-wrap gap-2 justify-center">
                {domain.techStack.slice(0, 3).map((tech) => (
                  <span
                    key={tech}
                    className="px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-xs"
                  >
                    {tech}
                  </span>
                ))}
                {domain.techStack.length > 3 && (
                  <span className="px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-xs">
                    +{domain.techStack.length - 3}
                  </span>
                )}
              </div>

              <Button
                className="w-full"
                disabled={isGenerating}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDomainSelect(domain.id);
                }}
              >
                {selectedDomain === domain.id && isGenerating ? (
                  "Generating Interview..."
                ) : (
                  "Start Interview"
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Each interview will be tailored to the selected domain with relevant questions and scenarios.
        </p>
      </div>
    </div>
  );
};

export default DomainSelector;