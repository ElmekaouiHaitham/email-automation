"use client";
import React, { useEffect, useState } from "react";
import DOMPurify from "dompurify";

// Analytics type
type Analytics = {
  totalPreviews: number;
  totalVariants: number;
  avgVariantsPerPreview: number;
  mostUsedTone: string;
  totalPersonalizations: number;
};

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
  const [toast, setToast] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"single" | "compare">("single");
  const [copiedVariant, setCopiedVariant] = useState<string | null>(null);

  const [tone, setTone] = useState<Tone>("Friendly");
  const [variantsCount, setVariantsCount] = useState<number>(3);
  const [creativity, setCreativity] = useState<number>(0.6); // 0..1
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);
  
  // Analytics
  const [previewHistory, setPreviewHistory] = useState<Array<{
    leadId: number;
    leadName: string;
    tone: string;
    variantCount: number;
    timestamp: Date;
  }>>([]);
  const [analytics, setAnalytics] = useState<Analytics>({
    totalPreviews: 0,
    totalVariants: 0,
    avgVariantsPerPreview: 0,
    mostUsedTone: "Friendly",
    totalPersonalizations: 0,
  });

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
    setViewMode("single");
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
      
      // Update analytics
      const newHistory = {
        leadId: lead.id,
        leadName: `${lead.first_name} ${lead.last_name}`,
        tone,
        variantCount: data.variants.length,
        timestamp: new Date(),
      };
      setPreviewHistory((prev) => {
        const updated = [newHistory, ...prev.slice(0, 49)]; // Keep last 50
        updateAnalytics(updated);
        return updated;
      });
      
      showToast(`✨ Generated ${data.variants.length} personalized variant${data.variants.length > 1 ? "s" : ""}`);
    } catch (e) {
      console.error(e);
      showToast("Failed to generate preview");
    } finally {
      setLoadingPreview(false);
    }
  }

  function updateAnalytics(history: typeof previewHistory) {
    const totalPreviews = history.length;
    const totalVariants = history.reduce((sum, h) => sum + h.variantCount, 0);
    const avgVariantsPerPreview = totalPreviews > 0 ? totalVariants / totalPreviews : 0;
    
    // Count tone usage
    const toneCounts = history.reduce((acc, h) => {
      acc[h.tone] = (acc[h.tone] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    let mostUsedTone = "Friendly";
    if (Object.keys(toneCounts).length > 0) {
      mostUsedTone = Object.entries(toneCounts).reduce((a, b) => 
        (b[1] > a[1] ? b : a)
      )[0];
    }
    
    setAnalytics({
      totalPreviews,
      totalVariants,
      avgVariantsPerPreview,
      mostUsedTone,
      totalPersonalizations: totalVariants, // Simplified for demo
    });
  }

  async function handleRegenerate() {
    if (!selectedLead) return;
    await handlePreview(selectedLead);
  }

  async function handleCopyEmail(variantIndex: number) {
    if (!preview || !selectedLead) return;
    const variant = preview.variants[variantIndex];
    const emailText = `Subject: ${variant.subject}\n\n${variant.body}`;
    
    try {
      await navigator.clipboard.writeText(emailText);
      setCopiedVariant(variant.id);
      showToast("Email copied to clipboard!");
      setTimeout(() => setCopiedVariant(null), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
      showToast("Failed to copy to clipboard");
    }
  }

  function handleExportEmail(variantIndex: number) {
    if (!preview || !selectedLead) return;
    const variant = preview.variants[variantIndex];
    const emailData = {
      lead: {
        name: `${selectedLead.first_name} ${selectedLead.last_name}`,
        email: selectedLead.email,
        zip: selectedLead.zip,
        interest: selectedLead.interest,
      },
      email: {
        subject: variant.subject,
        body: variant.body,
        tone,
        creativity,
        personalization_tokens: variant.used_tokens,
      },
      generated_at: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(emailData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `email-${selectedLead.first_name}-${selectedLead.last_name}-variant-${variantIndex + 1}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Email exported successfully!");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                AI Email Outreach Platform
              </h1>
              <p className="text-sm text-gray-600 mt-2">
                Generate personalized email variations powered by AI. Compare variants, analyze performance, and export your campaigns.
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">Demo Mode</div>
              <div className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                Preview & Export Only
              </div>
            </div>
          </div>
        </header>

        {/* Analytics Dashboard */}
        {analytics.totalPreviews > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-indigo-500">
              <div className="text-sm text-gray-600 mb-1">Total Previews</div>
              <div className="text-2xl font-bold text-indigo-600">{analytics.totalPreviews}</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-purple-500">
              <div className="text-sm text-gray-600 mb-1">Variants Generated</div>
              <div className="text-2xl font-bold text-purple-600">{analytics.totalVariants}</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
              <div className="text-sm text-gray-600 mb-1">Avg Variants/Preview</div>
              <div className="text-2xl font-bold text-green-600">{analytics.avgVariantsPerPreview.toFixed(1)}</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
              <div className="text-sm text-gray-600 mb-1">Most Used Tone</div>
              <div className="text-2xl font-bold text-blue-600">{analytics.mostUsedTone}</div>
            </div>
          </div>
        )}

        <section className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Sample Leads</h2>
            <button
              onClick={fetchLeads}
              disabled={loadingLeads}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {loadingLeads && <LoadingSpinner size="sm" className="text-white" />}
              {loadingLeads ? "Refreshing..." : "Refresh Leads"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-semibold text-gray-600 border-b-2 border-gray-200">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Age</th>
                  <th className="py-3 px-4">ZIP</th>
                  <th className="py-3 px-4">Interest</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Insight</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, idx) => (
                  <tr key={lead.id} className="border-b hover:bg-indigo-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-700 font-medium">{idx + 1}</td>
                    <td className="py-3 px-4 text-sm font-semibold text-gray-800">
                      {lead.first_name} {lead.last_name}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{lead.age ?? "-"}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{lead.zip ?? "-"}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{lead.interest ?? "-"}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">{lead.email}</td>
                    <td className="py-3 px-4 text-sm text-gray-500 max-w-xs truncate">{lead.insight ?? "-"}</td>
                    <td className="py-3 px-4">
                      <button 
                        onClick={() => handlePreview(lead)} 
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm"
                      >
                        Generate Preview
                      </button>
                    </td>
                  </tr>
                ))}
                {loadingLeads && leads.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <LoadingSpinner size="lg" />
                        <div className="text-gray-600 font-medium">Loading leads...</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {leads.length === 0 && !loadingLeads && (
              <div className="p-8 text-center text-gray-500">No leads found.</div>
            )}
          </div>
        </section>

        {/* Controls: Tone, Variants, Creativity */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Generation Settings</h3>
          <div className="flex items-center gap-8 flex-wrap">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Email Tone</div>
              <div className="flex gap-2">
                {TONES.map((t) => (
                  <button 
                    key={t} 
                    onClick={() => setTone(t)} 
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      tone === t 
                        ? "bg-indigo-600 text-white shadow-md scale-105" 
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Number of Variants</div>
              <select 
                value={variantsCount} 
                onChange={(e) => setVariantsCount(Number(e.target.value))} 
                className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
              >
                <option value={1}>1 Variant</option>
                <option value={2}>2 Variants</option>
                <option value={3}>3 Variants</option>
                <option value={5}>5 Variants</option>
              </select>
            </div>

            <div className="flex-1 min-w-[250px]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-700">Creativity Level</div>
                <div className="text-sm font-bold text-indigo-600">{creativity.toFixed(1)}</div>
              </div>
              <input 
                type="range" 
                min={0} 
                max={1} 
                step={0.1} 
                value={creativity} 
                onChange={(e) => setCreativity(Number(e.target.value))} 
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Conservative</span>
                <span>Creative</span>
              </div>
            </div>
          </div>
        </div>

        {/* Preview / Modal area */}
        {selectedLead && (
          <div className="fixed inset-0 flex items-start justify-center z-50 pt-12 pb-12 px-4 overflow-y-auto">
            <div className="absolute inset-0 bg-black opacity-40" onClick={() => { setSelectedLead(null); setPreview(null); }}></div>

            <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full z-10 p-8 relative my-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Email Preview for {selectedLead.first_name} {selectedLead.last_name}</h3>
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-4">
                    <span>📧 {selectedLead.email}</span>
                    <span>📍 {selectedLead.zip ?? "—"}</span>
                    <span>💼 {selectedLead.interest ?? "—"}</span>
                  </p>
                </div>
                <button 
                  onClick={() => { setSelectedLead(null); setPreview(null); }} 
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                >
                  ×
                </button>
              </div>

              {loadingPreview && (
                <div className="p-12 border-2 border-dashed border-indigo-200 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col items-center justify-center gap-4 min-h-[300px]">
                  <LoadingSpinner size="lg" />
                  <div className="text-gray-700 font-semibold text-lg">Generating personalized email variations</div>
                  <PulsingDots />
                  <div className="text-sm text-gray-500">AI is crafting unique messages tailored to {selectedLead.first_name}...</div>
                </div>
              )}

              {preview && !loadingPreview && (
                <div>
                  {/* View Mode Toggle */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewMode("single")}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          viewMode === "single"
                            ? "bg-indigo-600 text-white shadow-md"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        Single View
                      </button>
                      <button
                        onClick={() => setViewMode("compare")}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          viewMode === "compare"
                            ? "bg-indigo-600 text-white shadow-md"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        Compare All
                      </button>
                    </div>
                    <button 
                      onClick={handleRegenerate} 
                      disabled={loadingPreview}
                      className="px-4 py-2 border-2 border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerate
                    </button>
                  </div>

                  {viewMode === "single" ? (
                    <div className="grid grid-cols-12 gap-6">
                      {/* Variants / carousel */}
                      <div className="col-span-7">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="text-sm font-medium text-gray-700">Generated Variations</div>
                          <div className="text-sm text-gray-500">
                            {preview.variants.length} variant{preview.variants.length > 1 ? "s" : ""}
                          </div>
                        </div>

                        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                          {preview.variants.map((v, i) => (
                            <button 
                              key={v.id} 
                              onClick={() => setSelectedVariantIndex(i)} 
                              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                                selectedVariantIndex === i 
                                  ? "bg-indigo-600 text-white shadow-md" 
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              Variant {i + 1}
                            </button>
                          ))}
                        </div>

                        <div className="border-2 border-gray-200 rounded-xl p-6 bg-gradient-to-br from-white to-gray-50 min-h-[300px] shadow-inner">
                          <div className="mb-4">
                            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Subject Line</div>
                            <div className="text-lg font-bold text-gray-800">{preview.variants[selectedVariantIndex].subject}</div>
                          </div>

                          <div className="mb-4">
                            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Email Body</div>
                            <div
                              className="prose max-w-none text-sm text-gray-700 whitespace-pre-line leading-relaxed"
                              dangerouslySetInnerHTML={createSanitizedMarkup(
                                highlightPersonalization(
                                  preview.variants[selectedVariantIndex].body,
                                  preview.variants[selectedVariantIndex].used_tokens,
                                  selectedLead
                                )
                              )}
                            />
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-3">
                          <button 
                            onClick={() => handleCopyEmail(selectedVariantIndex)} 
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium shadow-sm transition-colors"
                          >
                            {copiedVariant === preview.variants[selectedVariantIndex].id ? (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied!
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy Email
                              </>
                            )}
                          </button>
                          <button 
                            onClick={() => handleExportEmail(selectedVariantIndex)} 
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium shadow-sm transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export JSON
                          </button>
                        </div>
                      </div>

                      {/* Right panel: tokens, rationale, subjects */}
                      <div className="col-span-5">
                        <div className="bg-indigo-50 rounded-xl p-4 mb-4 border border-indigo-100">
                          <div className="text-sm font-semibold text-indigo-900 mb-2">Personalization Tokens</div>
                          <div className="flex flex-wrap gap-2">
                            {(unionUsedTokens(preview.variants)).map((token) => (
                              <span key={token} className="px-3 py-1 bg-white rounded-lg text-xs font-medium text-indigo-700 border border-indigo-200">
                                {token}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="bg-purple-50 rounded-xl p-4 mb-4 border border-purple-100">
                          <div className="text-sm font-semibold text-purple-900 mb-2">Why This Should Convert</div>
                          <div className="text-sm text-purple-800 leading-relaxed">{preview.rationale}</div>
                        </div>

                        <div className="bg-green-50 rounded-xl p-4 mb-4 border border-green-100">
                          <div className="text-sm font-semibold text-green-900 mb-2">Alternative Subject Lines</div>
                          <div className="flex flex-col gap-2">
                            {preview.subject_suggestions.map((s, i) => (
                              <button 
                                key={i} 
                                onClick={() => {
                                  const variants = [...preview.variants];
                                  variants[selectedVariantIndex] = { ...variants[selectedVariantIndex], subject: s };
                                  setPreview({ ...preview, variants });
                                }} 
                                className="text-left px-3 py-2 border border-green-200 rounded-lg text-sm text-green-800 hover:bg-green-100 transition-colors"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="text-xs text-gray-400 mt-4">
                          AI Model: <span className="font-semibold">{preview.model}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-sm font-medium text-gray-700 mb-4">Compare All Variants Side by Side</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
                        {preview.variants.map((variant, idx) => (
                          <div key={variant.id} className="border-2 border-gray-200 rounded-xl p-4 bg-white hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <div className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                                Variant {idx + 1}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCopyEmail(idx)}
                                  className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Copy email"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleExportEmail(idx)}
                                  className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title="Export email"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div className="mb-3">
                              <div className="text-xs font-semibold text-gray-500 mb-1">Subject</div>
                              <div className="text-sm font-bold text-gray-800">{variant.subject}</div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-gray-500 mb-1">Body</div>
                              <div
                                className="text-xs text-gray-700 whitespace-pre-line line-clamp-6"
                                dangerouslySetInnerHTML={createSanitizedMarkup(
                                  highlightPersonalization(variant.body, variant.used_tokens, selectedLead)
                                )}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed right-6 bottom-6 bg-gray-900 text-white px-6 py-4 rounded-lg shadow-2xl z-50 flex items-center gap-3 animate-slide-up">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{toast}</span>
          </div>
        )}
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
