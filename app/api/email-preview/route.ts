// app/api/email-preview/route.ts
import { NextResponse } from "next/server";

// The base URL for your FastAPI backend.
// It's good practice to use an environment variable for this.
const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8000";

export async function GET(req: Request) {
  try {
    // 1. Parse query parameters from the incoming request
    const url = new URL(req.url);
    const id = url.searchParams.get("id") ?? "1";
    const tone = url.searchParams.get("tone") ?? "Friendly";
    const variants = Number(url.searchParams.get("variants") ?? "3");
    const creativity = Number(url.searchParams.get("creativity") ?? "0.6");

    // In a real implementation: fetch lead by id from DB or call your backend
    // For this demo, we'll continue to build a mock lead object based on the ID.
    const lead = {
      id,
      first_name: id === "2" ? "Sarah" : id === "3" ? "Carlos" : "John",
      last_name: "Demo",
      zip: "90210",
      insight: "recently searched for coverage options",
      business_specialization: "Life insurance for new families",
    };

    // 2. Prepare the request payload for the FastAPI backend
    const backendRequestBody = {
      lead: lead,
      tone: tone,
      variants: Math.min(variants, 5), // Cap variants to 5 for the demo
      temperature: creativity, // Map frontend 'creativity' to backend 'temperature'
    };

    // 3. Call the /generate endpoint on the FastAPI backend
    let response;
    let lastError: Error | undefined;
    for (let i = 0; i < 3; i++) {
      try {
        response = await fetch(`${BACKEND_API_URL}/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(backendRequestBody),
        });

        if (response.ok) {
          lastError = undefined;
          break;
        }
        const errorBody = await response.text();
        lastError = new Error(`Backend API error: ${response.status} ${response.statusText} - ${errorBody}`);
        
      } catch (error: any) {
        lastError = error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!response || !response.ok) {
      throw lastError || new Error("Backend request failed after multiple retries");
    }

    const data = await response.json();

    // 4. Format the response for the frontend
    const subjectSuggestions = data.variants.slice(0, 3).map((v: any) => v.subject);
    const rationale = `This message uses ${lead.first_name}'s recent search intent and local context to establish relevance, offers a low-friction CTA (10-min call), and matches a ${tone.toLowerCase()} tone.`;

    return NextResponse.json({
      variants: data.variants,
      rationale,
      subject_suggestions: subjectSuggestions,
      model: data.model || "google/gemma-2-27b-it:free", // Use model from backend or default
    });
  } catch (err) {
    console.error(err);
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
    return NextResponse.json({ error: "failed to fetch from backend", details: errorMessage }, { status: 500 });
  }
}
