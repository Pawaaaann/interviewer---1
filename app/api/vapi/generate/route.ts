import { GoogleGenAI } from "@google/genai";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { interviewDomains } from "@/constants";

// Using Replit AI Integrations for Gemini access
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export async function POST(request: Request) {
  const { type, role, level, techstack, amount, domain } = await request.json();

  // Get the authenticated user from server session
  const user = await getCurrentUser();
  if (!user?.id) {
    return Response.json({ 
      success: false, 
      error: "Authentication required" 
    }, { status: 401 });
  }

  // Validate domain if provided
  if (domain && !interviewDomains.find(d => d.id === domain)) {
    return Response.json({ 
      success: false, 
      error: "Invalid domain selected" 
    }, { status: 400 });
  }

  try {
    // Check if database is available
    if (!db) {
      return Response.json({ 
        success: false, 
        error: "Database not configured. Please set up Firebase configuration." 
      }, { status: 500 });
    }

    // Create domain-specific prompt enhancement
    const domainContext = domain ? `
        This interview is specifically for the ${domain} domain.
        Focus on domain-specific scenarios, challenges, and best practices.
        Include questions about industry trends, common tools, and real-world applications in this domain.
    ` : '';

    const prompt = `Prepare questions for a job interview.
        The job role is ${role}.
        The job experience level is ${level}.
        The tech stack used in the job is: ${techstack}.
        The focus between behavioural and technical questions should lean towards: ${type}.
        ${domainContext}
        The amount of questions required is: ${amount}.
        
        Create a mix of:
        - Technical questions specific to the role and tech stack
        - Problem-solving scenarios relevant to the domain
        - Behavioral questions about teamwork and communication
        - Questions about industry best practices and trends
        
        Please return only the questions, without any additional text.
        The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
        Return the questions formatted like this:
        ["Question 1", "Question 2", "Question 3"]
        
        Thank you! <3
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const questions = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!questions) {
      throw new Error("Failed to generate interview questions");
    }

    // Parse and validate questions with error handling
    let parsedQuestions;
    try {
      parsedQuestions = JSON.parse(questions);
      if (!Array.isArray(parsedQuestions)) {
        throw new Error("Questions must be an array");
      }
    } catch (parseError) {
      console.error("Failed to parse questions:", parseError);
      return Response.json({ 
        success: false, 
        error: "Failed to generate valid interview questions. Please try again." 
      }, { status: 500 });
    }

    const interview = {
      role: role,
      type: type,
      level: level,
      techstack: techstack.split(",").map((tech: string) => tech.trim()),
      questions: parsedQuestions,
      userId: user.id, // Use authenticated user ID
      domain: domain || null,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    const docRef = await db.collection("interviews").add(interview);

    return Response.json({ 
      success: true, 
      interviewId: docRef.id 
    }, { status: 200 });
  } catch (error: any) {
    console.error("Error:", error);
    const errorMessage = error?.message || "An unexpected error occurred";
    return Response.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ success: true, data: "Thank you!" }, { status: 200 });
}
