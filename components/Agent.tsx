"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { vapi, isVapiConfigured } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
  ERROR = "ERROR",
}

interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

const Agent = ({
  userName,
  userId,
  interviewId,
  feedbackId,
  type,
  questions,
}: AgentProps) => {
  const router = useRouter();
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Suppress Daily.co library errors at window level only
  useEffect(() => {
    // Override console error for specific Daily.co messages
    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args: any[]) => {
      const msg = String(args[0] || "").toLowerCase();
      if (msg.includes("meeting ended") || msg.includes("ejection")) {
        return; // Suppress
      }
      originalError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      const msg = String(args[0] || "").toLowerCase();
      if (msg.includes("ejection")) {
        return; // Suppress
      }
      originalWarn.apply(console, args);
    };

    const handleError = (event: ErrorEvent) => {
      const errorMsg = (event.message || "").toLowerCase();
      const ignoredErrors = [
        "meeting ended",
        "room was deleted",
        "exiting meeting",
        "ejection",
      ];

      if (ignoredErrors.some(err => errorMsg.includes(err))) {
        event.preventDefault();
        return false;
      }
    };

    window.addEventListener("error", handleError);
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener("error", handleError);
    };
  }, []);

  useEffect(() => {
    const onCallStart = () => {
      console.log("[VAPI] Call started");
      setCallStatus(CallStatus.ACTIVE);
      setError("");
      retryCountRef.current = 0;
    };

    const onCallEnd = () => {
      console.log("[VAPI] Call ended normally");
      setCallStatus(CallStatus.FINISHED);
    };

    const onMessage = (message: Message) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        const newMessage = { role: message.role, content: message.transcript };
        setMessages((prev) => [...prev, newMessage]);
      }
    };

    const onSpeechStart = () => {
      console.log("[VAPI] Speech started");
      setIsSpeaking(true);
    };

    const onSpeechEnd = () => {
      console.log("[VAPI] Speech ended");
      setIsSpeaking(false);
    };

    const onError = (error: Error | unknown) => {
      let errorMessage = "";
      
      // Properly serialize error objects
      if (error instanceof Error) {
        errorMessage = error.message || String(error);
      } else if (error && typeof error === "object") {
        const errorObj = error as any;
        errorMessage = errorObj.message || errorObj.reason || errorObj.code || JSON.stringify(error);
      } else {
        errorMessage = String(error);
      }

      // Don't treat normal call-end signals as errors (suppress noisy daily-js events)
      const ignoredMessages = [
        "Meeting ended",
        "ejection",
        "disconnect",
        "Signaling connection",
        "meeting state",
        "room was deleted",
        "Exiting meeting",
        "daily-call-join-error",
        "daily-error",
        "start-method-error",
      ];

      const shouldIgnore = ignoredMessages.some(msg => 
        errorMessage.toLowerCase().includes(msg.toLowerCase())
      );

      if (!shouldIgnore && errorMessage && errorMessage !== "[object Object]") {
        console.error("[VAPI] Real error:", errorMessage);
      } else if (!shouldIgnore) {
        console.debug("[VAPI] Event:", errorMessage);
      }
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("error", onError);
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content);
    }

    const handleGenerateFeedback = async (messages: SavedMessage[]) => {
      console.log("handleGenerateFeedback");

      try {
        const result = await createFeedback({
          interviewId: interviewId!,
          userId: userId!,
          transcript: messages,
          feedbackId,
        });

        if (result && result.success) {
          router.push(`/interview/${interviewId}/feedback`);
        } else {
          console.log("Error saving feedback - no success");
          router.push("/");
        }
      } catch (error) {
        console.error("Failed to generate feedback:", error);
        router.push("/");
      }
    };

    if (callStatus === CallStatus.FINISHED) {
      if (type === "generate") {
        router.push("/");
      } else {
        // Only generate feedback if we have messages from the interview
        if (messages.length > 0) {
          handleGenerateFeedback(messages);
        } else {
          console.log("No messages recorded, redirecting to home");
          router.push("/");
        }
      }
    }
  }, [messages, callStatus, feedbackId, interviewId, router, type, userId]);

  const handleCall = async () => {
    if (!isVapiConfigured()) {
      setError("Voice feature not configured");
      setCallStatus(CallStatus.ERROR);
      return;
    }

    setCallStatus(CallStatus.CONNECTING);
    setError("");

    const attemptCall = async (retryCount = 0) => {
      try {
        console.log(`[VAPI] Attempting to start call (attempt ${retryCount + 1}/${maxRetries + 1})`);
        
        if (type === "generate") {
          const workflowId = process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID;
          if (!workflowId) {
            throw new Error("Workflow ID not configured");
          }
          
          await vapi.start(workflowId, {
            variableValues: {
              username: userName,
              userid: userId,
            },
          });
        } else {
          let formattedQuestions = "";
          if (questions) {
            formattedQuestions = questions
              .map((question) => `- ${question}`)
              .join("\n");
          }

          await vapi.start(interviewer, {
            variableValues: {
              questions: formattedQuestions,
            },
          });
        }
        
        retryCountRef.current = 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[VAPI] Call attempt ${retryCount + 1} failed:`, message);
        
        if (retryCount < maxRetries) {
          console.log(`[VAPI] Retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          await attemptCall(retryCount + 1);
        } else {
          setCallStatus(CallStatus.INACTIVE);
          setError(`Failed after ${maxRetries + 1} attempts: ${message}`);
          throw error;
        }
      }
    };

    try {
      await attemptCall();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[VAPI] Call start failed:", message);
    }
  };

  const handleDisconnect = async () => {
    console.log("[VAPI] Ending call manually");
    setCallStatus(CallStatus.FINISHED);
    try {
      await vapi.stop();
    } catch (error) {
      console.error("[VAPI] Error stopping call:", error);
    }
  };

  return (
    <>
      <div className="call-view">
        {/* AI Interviewer Card */}
        <div className="card-interviewer">
          <div className="avatar">
            <Image
              src="/ai-avatar.png"
              alt="profile-image"
              width={65}
              height={54}
              className="object-cover"
            />
            {isSpeaking && <span className="animate-speak" />}
          </div>
          <h3>AI Interviewer</h3>
        </div>

        {/* User Profile Card */}
        <div className="card-border">
          <div className="card-content">
            <Image
              src="/user-avatar.png"
              alt="profile-image"
              width={539}
              height={539}
              className="rounded-full object-cover size-[120px]"
            />
            <h3>{userName}</h3>
          </div>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="transcript-border">
          <div className="transcript">
            <p
              key={lastMessage}
              className={cn(
                "transition-opacity duration-500 opacity-0",
                "animate-fadeIn opacity-100"
              )}
            >
              {lastMessage}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 left-4 right-4 bg-red-900 text-white p-4 rounded-lg max-w-md mx-auto">
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="w-full flex justify-center">
        {callStatus !== "ACTIVE" ? (
          <button 
            className="relative btn-call" 
            onClick={() => handleCall()}
            disabled={callStatus === "CONNECTING"}
          >
            <span
              className={cn(
                "absolute animate-ping rounded-full opacity-75",
                callStatus !== "CONNECTING" && "hidden"
              )}
            />

            <span className="relative">
              {callStatus === "INACTIVE" || callStatus === "FINISHED"
                ? "Call"
                : callStatus === "ERROR"
                ? "Retry"
                : ". . ."}
            </span>
          </button>
        ) : (
          <button className="btn-disconnect" onClick={() => handleDisconnect()}>
            End
          </button>
        )}
      </div>
    </>
  );
};

export default Agent;
