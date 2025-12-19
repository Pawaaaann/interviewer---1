"use server";

import { GoogleGenAI } from "@google/genai";
import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";

// Using Replit AI Integrations for Gemini access
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role}: ${sentence.content}\n`
      )
      .join("");

    const prompt = `
        You are an AI interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed in your analysis. Don't be lenient with the candidate. If there are mistakes or areas for improvement, point them out.
        Transcript:
        ${formattedTranscript}

        Please score the candidate from 0 to 100 in the following areas. Do not add categories other than the ones provided:
        - **Communication Skills**: Clarity, articulation, structured responses.
        - **Technical Knowledge**: Understanding of key concepts for the role.
        - **Problem-Solving**: Ability to analyze problems and propose solutions.
        - **Cultural & Role Fit**: Alignment with company values and job role.
        - **Confidence & Clarity**: Confidence in responses, engagement, and clarity.

        Return your response as valid JSON with this structure: { "totalScore": number, "categoryScores": { "communicationSkills": number, "technicalKnowledge": number, "problemSolving": number, "culturalFit": number, "confidenceClarity": number }, "strengths": string[], "areasForImprovement": string[], "finalAssessment": string }
        `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error("No response from Gemini");
    }

    const object = JSON.parse(responseText);

    const feedback = {
      interviewId: interviewId,
      userId: userId,
      totalScore: object.totalScore,
      categoryScores: object.categoryScores,
      strengths: object.strengths,
      areasForImprovement: object.areasForImprovement,
      finalAssessment: object.finalAssessment,
      createdAt: new Date().toISOString(),
    };

    let feedbackRef;

    if (!db) {
      console.error("Database not configured");
      return { success: false };
    }

    if (feedbackId) {
      feedbackRef = db.collection("feedback").doc(feedbackId);
    } else {
      feedbackRef = db.collection("feedback").doc();
    }

    await feedbackRef.set(feedback);

    return { success: true, feedbackId: feedbackRef.id };
  } catch (error) {
    console.error("Error saving feedback:", error);
    return { success: false };
  }
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  if (!db) {
    console.error("Database not configured");
    return null;
  }

  const interview = await db.collection("interviews").doc(id).get();

  return interview.data() as Interview | null;
}

export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  const { interviewId, userId } = params;

  if (!db) {
    console.error("Database not configured");
    return null;
  }

  const querySnapshot = await db
    .collection("feedback")
    .where("interviewId", "==", interviewId)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (querySnapshot.empty) return null;

  const feedbackDoc = querySnapshot.docs[0];
  return { id: feedbackDoc.id, ...feedbackDoc.data() } as Feedback;
}

export async function getLatestInterviews(
  params: GetLatestInterviewsParams
): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;

  if (!db) {
    console.error("Database not configured");
    return null;
  }

  try {
    // Try the optimal query first (requires composite index)
    const interviews = await db
      .collection("interviews")
      .orderBy("createdAt", "desc")
      .where("finalized", "==", true)
      .where("userId", "!=", userId)
      .limit(limit)
      .get();

    return interviews.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Interview[];

  } catch (error: any) {
    // If index is missing, fall back to simpler query and filter client-side
    if (error.code === 9 || error.message?.includes('index')) {
      console.warn("Firestore index missing for getLatestInterviews, using fallback");
      try {
        // Simpler query: just get finalized interviews and filter/sort client-side
        const interviews = await db
          .collection("interviews")
          .where("finalized", "==", true)
          .limit(limit * 3) // Get more to account for filtering out current user
          .get();

        const interviewData = interviews.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Interview[];

        // Filter out current user's interviews and sort by createdAt desc
        const filteredInterviews = interviewData
          .filter((interview) => interview.userId !== userId)
          .sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateB - dateA; // desc order
          })
          .slice(0, limit); // Apply limit after sorting

        return filteredInterviews;

      } catch (fallbackError) {
        console.error("Error in fallback query for getLatestInterviews:", fallbackError);
        return []; // Return empty array instead of null to prevent crashes
      }
    }
    
    console.error("Error fetching latest interviews:", error);
    return []; // Return empty array instead of null
  }
}

export async function getInterviewsByUserId(
  userId: string
): Promise<Interview[] | null> {
  if (!db) {
    console.error("Database not configured");
    return null;
  }

  try {
    // Try the optimal query first (requires composite index)
    const interviews = await db
      .collection("interviews")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    return interviews.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Interview[];

  } catch (error: any) {
    // If index is missing, fall back to simpler query and sort client-side
    if (error.code === 9 || error.message?.includes('index')) {
      console.warn("Firestore index missing, using fallback query");
      try {
        const interviews = await db
          .collection("interviews")
          .where("userId", "==", userId)
          .get();

        const interviewData = interviews.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Interview[];

        // Sort client-side by createdAt desc
        return interviewData.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA; // desc order
        });

      } catch (fallbackError) {
        console.error("Error in fallback query:", fallbackError);
        return []; // Return empty array instead of null to prevent crashes
      }
    }
    
    console.error("Error fetching interviews:", error);
    return []; // Return empty array instead of null
  }
}
