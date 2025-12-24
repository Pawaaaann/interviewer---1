import { GoogleGenAI } from "@google/genai";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { interviewDomains } from "@/constants";

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
    // Use only the official Google Generative AI key and default endpoint
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      return Response.json({
        success: false,
        error: "Missing GOOGLE_GENERATIVE_AI_API_KEY. Please set it in your environment and restart the server."
      }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Check if database is available
    if (!db) {
      return Response.json({ 
        success: false, 
        error: "Database not configured. Please set up Firebase configuration." 
      }, { status: 500 });
    }

    const domainContext = domain ? ` Domain: ${domain}.` : '';

    const prompt = `Generate ${amount} interview questions for: Role: ${role}, Level: ${level}, Stack: ${techstack}, Type: ${type}${domainContext}
Return ONLY this JSON: ["Q1", "Q2", ...]
No "/" or "*" characters.`;

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
    const errObj: any = error?.error || error;
    const statusCandidate = errObj?.statusCode || errObj?.status || errObj?.code;
    const numericStatus = typeof statusCandidate === "string" ? parseInt(statusCandidate, 10) : statusCandidate;

    const message = errObj?.message || "An unexpected error occurred";
    const reason = errObj?.details?.[0]?.reason || errObj?.reason;

    if (reason === "API_KEY_INVALID" || /API key not valid/i.test(message)) {
      return Response.json(
        { success: false, error: "Invalid Gemini API key. Verify AI_INTEGRATIONS_GEMINI_API_KEY and that 'Generative Language API' is enabled for your project." },
        { status: 400 }
      );
    }

    const status = Number.isInteger(numericStatus) && numericStatus >= 400 && numericStatus < 600 ? numericStatus : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}

export async function GET() {
  return Response.json({ success: true, data: "Thank you!" }, { status: 200 });
}
