"use client";
import React, { useEffect, useState } from "react";
import DOMPurify from "dompurify";

// Loading Spinner Component
function LoadingSpinner({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };
  
  return (
    <div className={`inline-block ${className}`}>
      <svg
        className={`animate-spin ${sizeClasses[size]} text-indigo-600`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    </div>
  );
}

// Pulsing dots loader
function PulsingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></span>
      <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></span>
      <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></span>
    </div>
  );
}

function createSanitizedMarkup(html: string) {
  // DOMPurify.sanitize removes scripts and unsafe attributes.
  // You can pass options to allow/deny tags or attributes if needed.
  return { __html: DOMPurify.sanitize(html) };
}

type Lead = {
  id: number;
  first_name: string;
  last_name: string;
  age?: number;
  zip?: string;
  interest?: string;
  email: string;
  insight?: string;
  status?: string;
};

type Variant = {
  id: string;
  subject: string;
  body: string;
  used_tokens: string[];
  confidence?: number; // 0..1
  tokens_used?: number;
};

type PreviewResponse = {
  variants: Variant[];
  rationale: string;
  subject_suggestions: string[];
  model: string;
};

const TONES = ["Friendly", "Professional", "Empathetic", "Urgent"] as const;
type Tone = typeof TONES[number];

export default function DemoPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [tone, setTone] = useState<Tone>("Friendly");
  const [variantsCount, setVariantsCount] = useState<number>(3);
  const [creativity, setCreativity] = useState<number>(0.6); // 0..1
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);

  // Batch send functionality
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set());
  const [batchSending, setBatchSending] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    total: number;
    completed: number;
    failed: number;
    current?: string;
  } | null>(null);
  const [batchResults, setBatchResults] = useState<{
    sent: number;
    failed: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    setLoadingLeads(true);
    try {
      const res = await fetch("/api/leads");
      if (!res.ok) throw new Error("Failed to load leads");
      const data: Lead[] = await res.json();
      setLeads(data.slice(0, 10));
    } catch (e) {
      console.error(e);
      showToast("Error loading leads");
    } finally {
      setLoadingLeads(false);
    }
  }

  function showToast(msg: string, ms = 3500) {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }

  async function handlePreview(lead: Lead) {
    setSelectedLead(lead);
    setPreview(null);
    setLoadingPreview(true);
    setSelectedVariantIndex(0);
    try {
      const q = new URLSearchParams({
        id: String(lead.id),
        tone,
        variants: String(variantsCount),
        creativity: String(creativity),
      }).toString();

      const res = await fetch(`/api/email-preview?${q}`);
      if (!res.ok) throw new Error("Preview error");
      const data: PreviewResponse = await res.json();
      setPreview(data);
    } catch (e) {
      console.error(e);
      showToast("Failed to fetch preview");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleRegenerate() {
    if (!selectedLead) return;
    await handlePreview(selectedLead);
  }

  async function handleSend() {
    if (!selectedLead || !preview) return;
    setSending(true);
    try {
      const variant = preview.variants[selectedVariantIndex];
      const body = {
        leadId: selectedLead.id,
        variantId: variant.id,
        subject: variant.subject,
        body: variant.body,
        consent_snapshot: {
          source: "demo",
          captured_at: new Date().toISOString(),
          exact_text: "User opted in via demo form",
        },
      };
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error("Send failed");
      showToast(`Email sent to ${selectedLead.first_name}`);
      setLeads((prev) =>
        prev.map((l) => (l.id === selectedLead.id ? { ...l, status: "sent" } : l))
      );
      setSelectedLead(null);
      setPreview(null);
    } catch (e) {
      console.error(e);
      showToast("Failed to send email");
    } finally {
      setSending(false);
    }
  }

  // Batch selection handlers
  function handleSelectLead(leadId: number) {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  }

  function handleSelectAll() {
    if (selectedLeadIds.size === leads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(leads.map((l) => l.id)));
    }
  }

  // Batch send handler
  async function handleBatchSend() {
    if (selectedLeadIds.size === 0) {
      showToast("Please select at least one lead");
      return;
    }

    const selectedLeads = leads.filter((l) => selectedLeadIds.has(l.id));
    setBatchSending(true);
    setBatchProgress({ total: selectedLeads.length, completed: 0, failed: 0 });
    setBatchResults(null);

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < selectedLeads.length; i++) {
      const lead = selectedLeads[i];
      
      // Update progress to show current lead being processed
      setBatchProgress({
        total: selectedLeads.length,
        completed: sentCount,
        failed: failedCount,
        current: `${lead.first_name} ${lead.last_name}`,
      });

      try {
        // Generate email for this lead
        const q = new URLSearchParams({
          id: String(lead.id),
          tone,
          variants: String(1), // Use 1 variant for batch sends
          creativity: String(creativity),
        }).toString();

        const previewRes = await fetch(`/api/email-preview?${q}`);
        if (!previewRes.ok) {
          const errorText = await previewRes.text();
          throw new Error(`Preview generation failed: ${errorText}`);
        }
        const previewData: PreviewResponse = await previewRes.json();

        if (previewData.variants.length === 0) {
          throw new Error("No variants generated");
        }

        // Use first variant for batch send
        const variant = previewData.variants[0];

        // Send email
        const sendRes = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId: lead.id,
            variantId: variant.id,
            subject: variant.subject,
            body: variant.body,
            consent_snapshot: {
              source: "batch_demo",
              captured_at: new Date().toISOString(),
              exact_text: "Batch send via demo",
            },
          }),
        });

        const sendData = await sendRes.json();
        
        // Check if send was successful
        if (!sendRes.ok || sendData.ok === false || (sendData.status && sendData.status !== "success")) {
          throw new Error(`Send failed: ${sendData.error || sendData.message || sendRes.statusText}`);
        }

        sentCount++;
        // Update lead status
        setLeads((prev) =>
          prev.map((l) => (l.id === lead.id ? { ...l, status: "sent" } : l))
        );
      } catch (e) {
        console.error(`Failed to send to ${lead.first_name}:`, e);
        failedCount++;
        setLeads((prev) =>
          prev.map((l) => (l.id === lead.id ? { ...l, status: "failed" } : l))
        );
      }

      // Update progress after each attempt
      setBatchProgress({
        total: selectedLeads.length,
        completed: sentCount,
        failed: failedCount,
        current: i < selectedLeads.length - 1 ? `${selectedLeads[i + 1].first_name} ${selectedLeads[i + 1].last_name}` : undefined,
      });

      // Small delay between sends to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setBatchProgress(null);
    setBatchSending(false);
    setBatchResults({
      sent: sentCount,
      failed: failedCount,
      total: selectedLeads.length,
    });
    setSelectedLeadIds(new Set());

    if (sentCount > 0) {
      showToast(`Successfully sent ${sentCount} email${sentCount > 1 ? "s" : ""}${failedCount > 0 ? `, ${failedCount} failed` : ""}`);
    } else {
      showToast("All emails failed to send");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Demo Email Notice Banner */}
        <div className="bg-blue-600 text-white rounded-lg shadow-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Demo Mode</h3>
              <p className="text-sm opacity-90">
                All emails will be sent to <strong>goledc123@gmail.com</strong> for demonstration purposes. 
                This allows you to see all generated emails in one inbox without sending to actual leads.
              </p>
            </div>
          </div>
        </div>

        <header className="mb-6">
          <h1 className="text-2xl font-semibold">AI Outreach — Demo</h1>
          <p className="text-sm text-gray-600 mt-1">
            Focused demo: AI generates multiple personalized variations and explains why each should convert.
          </p>
        </header>

        {/* Batch Results Summary */}
        {batchResults && (
          <div className="bg-white rounded-lg shadow p-4 mb-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg mb-2">Batch Send Complete</h3>
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-gray-600">Total:</span>{" "}
                    <span className="font-semibold">{batchResults.total}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Sent:</span>{" "}
                    <span className="font-semibold text-green-600">{batchResults.sent}</span>
                  </div>
                  {batchResults.failed > 0 && (
                    <div>
                      <span className="text-gray-600">Failed:</span>{" "}
                      <span className="font-semibold text-red-600">{batchResults.failed}</span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setBatchResults(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Batch Progress */}
        {batchProgress && (
          <div className="bg-white rounded-lg shadow p-4 mb-6 border-l-4 border-blue-500">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <LoadingSpinner size="sm" />
                Sending Emails...
              </h3>
              <span className="text-sm text-gray-600">
                {batchProgress.completed + batchProgress.failed} / {batchProgress.total}
              </span>
            </div>
            {batchProgress.current && (
              <p className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                Currently processing: <strong>{batchProgress.current}</strong>
              </p>
            )}
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 relative"
                style={{
                  width: `${((batchProgress.completed + batchProgress.failed) / batchProgress.total) * 100}%`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
              </div>
            </div>
          </div>
        )}

        <section className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Sample Leads</h2>
            <div className="flex items-center gap-3">
              {selectedLeadIds.size > 0 && (
                <button
                  onClick={handleBatchSend}
                  disabled={batchSending}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-70 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                >
                  {batchSending && <LoadingSpinner size="sm" className="text-white" />}
                  {batchSending ? `Sending... (${batchProgress?.completed || 0}/${batchProgress?.total || 0})` : `Send to ${selectedLeadIds.size} Lead${selectedLeadIds.size > 1 ? "s" : ""}`}
                </button>
              )}
              <button
                onClick={fetchLeads}
                disabled={loadingLeads}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loadingLeads && <LoadingSpinner size="sm" className="text-white" />}
                {loadingLeads ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left table-auto">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="py-2 px-3">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.size === leads.length && leads.length > 0}
                      onChange={handleSelectAll}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3">Age</th>
                  <th className="py-2 px-3">ZIP</th>
                  <th className="py-2 px-3">Interest</th>
                  <th className="py-2 px-3">Email</th>
                  <th className="py-2 px-3">Insight</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, idx) => (
                  <tr key={lead.id} className={`border-b hover:bg-gray-50 transition ${selectedLeadIds.has(lead.id) ? "bg-blue-50" : ""}`}>
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.has(lead.id)}
                        onChange={() => handleSelectLead(lead.id)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-700">{idx + 1}</td>
                    <td className="py-2 px-3 text-sm font-medium">
                      {lead.first_name} {lead.last_name}
                    </td>
                    <td className="py-2 px-3 text-sm">{lead.age ?? "-"}</td>
                    <td className="py-2 px-3 text-sm">{lead.zip ?? "-"}</td>
                    <td className="py-2 px-3 text-sm">{lead.interest ?? "-"}</td>
                    <td className="py-2 px-3 text-sm text-gray-600">{lead.email}</td>
                    <td className="py-2 px-3 text-sm text-gray-500">{lead.insight ?? "-"}</td>
                    <td className="py-2 px-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        lead.status === "sent" 
                          ? "bg-green-100 text-green-700" 
                          : lead.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {lead.status ?? "pending"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-sm">
                      <button onClick={() => handlePreview(lead)} className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                        Preview
                      </button>
                    </td>
                  </tr>
                ))}
                {loadingLeads && leads.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <LoadingSpinner size="lg" />
                        <div className="text-gray-600">Loading leads...</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {leads.length === 0 && !loadingLeads && <div className="p-4 text-sm text-gray-500">No leads found.</div>}
          </div>
        </section>

        {/* Controls: Tone, Variants, Creativity */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <div className="text-sm text-gray-600 mb-1">Tone</div>
              <div className="flex gap-2">
                {TONES.map((t) => (
                  <button key={t} onClick={() => setTone(t)} className={`px-3 py-1 rounded ${tone === t ? "bg-indigo-600 text-white" : "bg-gray-100"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600 mb-1">Variations (Preview Only)</div>
              <select value={variantsCount} onChange={(e) => setVariantsCount(Number(e.target.value))} className="px-2 py-1 border rounded">
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={5}>5</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Batch sends use 1 variant</p>
            </div>

            <div className="flex-1 min-w-[200px]">
              <div className="text-sm text-gray-600 mb-1">Creativity: {creativity.toFixed(1)}</div>
              <input type="range" min={0} max={1} step={0.1} value={creativity} onChange={(e) => setCreativity(Number(e.target.value))} className="w-full" />
            </div>
          </div>
          
          {selectedLeadIds.size > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <strong>{selectedLeadIds.size}</strong> lead{selectedLeadIds.size > 1 ? "s" : ""} selected for batch send
                </p>
                <button
                  onClick={() => setSelectedLeadIds(new Set())}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear selection
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Preview / Modal area */}
        {selectedLead && (
          <div className="fixed inset-0 flex items-start justify-center z-50 pt-24 px-4">
            <div className="absolute inset-0 bg-black opacity-30" onClick={() => { setSelectedLead(null); setPreview(null); }}></div>

            <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full z-10 p-6 relative">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Preview Email for {selectedLead.first_name} {selectedLead.last_name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{selectedLead.email} — {selectedLead.zip ?? "—"}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setSelectedLead(null); setPreview(null); }} className="text-gray-500">Close</button>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4">
                {/* Variants / carousel */}
                <div className="col-span-7">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm text-gray-600">Generated Variations</div>
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                      {loadingPreview && <LoadingSpinner size="sm" />}
                      {loadingPreview ? "Generating…" : `Showing ${preview?.variants.length ?? 0} variants`}
                    </div>
                  </div>

                  {loadingPreview && (
                    <div className="p-6 border rounded bg-gray-50 flex flex-col items-center justify-center gap-4 min-h-[200px]">
                      <LoadingSpinner size="lg" />
                      <div className="text-gray-600 font-medium">Generating personalized variations</div>
                      <PulsingDots />
                      <div className="text-sm text-gray-500">This may take a few moments...</div>
                    </div>
                  )}

                  {preview && (
                    <div>
                      <div className="flex gap-2 mb-3">
                        {preview.variants.map((v, i) => (
                          <button key={v.id} onClick={() => setSelectedVariantIndex(i)} className={`px-3 py-1 rounded ${selectedVariantIndex === i ? "bg-indigo-600 text-white" : "bg-gray-100"}`}>
                            Variant {i + 1}
                          </button>
                        ))}
                      </div>

                      <div className="border rounded p-4 bg-gray-50 min-h-[120px]">
                        <div className="text-sm text-gray-500 mb-2">Subject</div>
                        <div className="mb-3 text-base font-medium">{preview.variants[selectedVariantIndex].subject}</div>

                        <div className="text-sm text-gray-500 mb-2">Body</div>
                        <div
                          className="prose max-w-none text-sm text-gray-800 whitespace-pre-line"
                          dangerouslySetInnerHTML={createSanitizedMarkup(
                            highlightPersonalization(
                              preview.variants[selectedVariantIndex].body,
                              preview.variants[selectedVariantIndex].used_tokens,
                              selectedLead
                            )
                          )}
                        />
                      </div>

                      <div className="mt-3 flex items-center gap-3">
                        <button 
                          onClick={handleRegenerate} 
                          disabled={loadingPreview}
                          className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {loadingPreview && <LoadingSpinner size="sm" />}
                          Regenerate
                        </button>
                        <button 
                          onClick={handleSend} 
                          disabled={sending || loadingPreview} 
                          className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {sending && <LoadingSpinner size="sm" className="text-white" />}
                          {sending ? "Sending…" : "Send Email"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right panel: tokens, rationale, subjects */}
                <div className="col-span-5">
                  <div className="mb-4">
                    <div className="text-sm text-gray-600 mb-2">Personalization used</div>
                    <div className="flex flex-wrap gap-2">
                      {/* compute tokens from preview */}
                      {(preview ? unionUsedTokens(preview.variants) : []).map((token) => (
                        <span key={token} className="px-2 py-1 bg-gray-100 rounded text-xs">{token}</span>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-sm text-gray-600 mb-2">Why this message should convert</div>
                    <div className="text-sm text-gray-700">{preview ? preview.rationale : "Generate a preview to see a short AI rationale explaining what the message leverages."}</div>
                  </div>

                  <div className="mb-4">
                    <div className="text-sm text-gray-600 mb-2">Subject suggestions</div>
                    <div className="flex flex-col gap-2">
                      {preview ? preview.subject_suggestions.map((s, i) => (
                        <button key={i} onClick={() => {
                          // replace selected variant subject with this quick suggestion (local only)
                          if (!preview) return;
                          const variants = [...preview.variants];
                          variants[selectedVariantIndex] = { ...variants[selectedVariantIndex], subject: s };
                          setPreview({ ...preview, variants });
                        }} className="text-left px-3 py-2 border rounded text-sm">{s}</button>
                      )) : <div className="text-sm text-gray-500">No suggestions yet</div>}
                    </div>
                  </div>

                  <div className="text-xs text-gray-400">Model: {preview?.model ?? "—"}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {toast && <div className="fixed right-6 bottom-6 bg-gray-900 text-white px-4 py-2 rounded shadow">{toast}</div>}
      </div>
    </div>
  );
}

/* helper: highlight tokens occurrences (very simple) */
function highlightPersonalization(body: string, usedTokens: string[], lead: any) {
  if (!usedTokens || usedTokens.length === 0) return body;
  // naive highlight: replace token values in body with wrapped span markers
  let out = body;
  usedTokens.forEach((t) => {
    const val = String(lead?.[t] ?? "");
    if (!val) return;
    // escape regex
    const re = new RegExp(escapeRegExp(val), "g");
    out = out.replace(re, `<strong>${val}</strong>`); // HTML-style bold
  });
  // convert **bold** to minimal JSX - but since we return string, keep bold markers.
  // For demo simplicity we return string with markers; the element renders them plainly.
  return out;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unionUsedTokens(variants: Variant[]) {
  const set = new Set<string>();
  variants.forEach((v) => (v.used_tokens || []).forEach((t) => set.add(t)));
  return Array.from(set);
}
