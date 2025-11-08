// app/api/send-email/route.ts
import { NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8000";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    // data: { leadId, variantId, subject, body, consent_snapshot }
    console.log("Original request to /api/send-email:", data);

    // We need to construct a body that matches the SendRequest model in main.py
    const backendRequestBody = {
      recipient_email: "test@example.com", // The backend requires this field, even if it uses a hardcoded email for sending.
      subject: data.subject,
      body: data.body,
      consent_snapshot: data.consent_snapshot,
      // The backend's SendRequest model has an optional `lead` object, but we only have `leadId`.
      // In a real app, we might fetch the full lead details here to pass to the backend.
      // For now, we'll send what we have that matches the backend model.
    };

    console.log("Forwarding to backend /send:", backendRequestBody);

    let response;
    let lastError: Error | undefined;
    for (let i = 0; i < 3; i++) {
      try {
        response = await fetch(`${BACKEND_API_URL}/send`, { // Corrected endpoint
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
      // Wait for 1 second before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!response || !response.ok) {
      throw lastError || new Error("Backend request failed after multiple retries");
    }

    const responseData = await response.json();
    return NextResponse.json(responseData);

  } catch (err) {
    console.error("send-email error", err);
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
    return NextResponse.json({ ok: false, error: "Failed to send email via backend", details: errorMessage }, { status: 500 });
  }
}
