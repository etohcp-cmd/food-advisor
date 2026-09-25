import React, { useState } from 'react';
import {
  Server,
  Activity,
  BookOpen,
  Apple,
  Search,
  CheckCircle2,
  Terminal,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Flame,
  Dna,
  Zap,
  Layers,
  Sparkles,
  Bot,
  Send,
  MessageSquare,
  XCircle
} from 'lucide-react';

interface ToolResult {
  source?: string;
  fetched_at?: string;
  items?: any[];
  isError?: boolean;
  content?: Array<{ type: string; text: string }>;
}

interface AskToolCall {
  name: string;
  args: any;
  failed: boolean;
}

interface UnavailableServer {
  address: string;
  reason: string;
}

interface AskResponse {
  answer: string;
  tool_calls: AskToolCall[];
  unavailable: UnavailableServer[];
  model: string;
  answered_at: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'ask' | 'overview' | 'tools' | 'architecture' | 'calculator'>('ask');
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);

  // Ask Agent state
  const [askQuestion, setAskQuestion] = useState('How many calories and protein are in 100g of oats?');
  const [askLoading, setAskLoading] = useState(false);
  const [askResult, setAskResult] = useState<AskResponse | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  // Nutrition tool state
  const [nutritionQuery, setNutritionQuery] = useState('greek yogurt');
  const [nutritionBrand, setNutritionBrand] = useState('Chobani');
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [nutritionData, setNutritionData] = useState<ToolResult | null>(null);

  // Activity tool state
  const [activityUserId, setActivityUserId] = useState('usr_102');
  const [activityRange, setActivityRange] = useState('7d');
  const [activityMetric, setActivityMetric] = useState('calories');
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityData, setActivityData] = useState<ToolResult | null>(null);

  // Research tool state
  const [researchTopic, setResearchTopic] = useState('mediterranean diet cardiovascular');
  const [researchMaxResults, setResearchMaxResults] = useState(5);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchData, setResearchData] = useState<ToolResult | null>(null);

  // Direct JSON-RPC test state
  const [rpcMethod, setRpcMethod] = useState<'tools/list' | 'tools/call'>('tools/list');
  const [rpcLoading, setRpcLoading] = useState(false);
  const [rpcResponse, setRpcResponse] = useState<string | null>(null);

  // Calorie Calculator state
  const [weightKg, setWeightKg] = useState<number>(75);
  const [heightCm, setHeightCm] = useState<number>(178);
  const [age, setAge] = useState<number>(30);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [activityMultiplier, setActivityMultiplier] = useState<number>(1.375); // Lightly active
  const [goal, setGoal] = useState<'maintain' | 'cut' | 'bulk'>('maintain');

  const bmr = Math.round(
    gender === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161
  );
  const tdee = Math.round(bmr * activityMultiplier);
  const targetCalories =
    goal === 'cut' ? Math.round(tdee - 450) : goal === 'bulk' ? Math.round(tdee + 350) : tdee;

  // Macro distribution estimates (Protein 2.0g/kg, Fat 25% cals, remaining Carbs)
  const proteinGrams = Math.round(weightKg * 2.0);
  const fatGrams = Math.round((targetCalories * 0.25) / 9);
  const carbGrams = Math.max(0, Math.round((targetCalories - proteinGrams * 4 - fatGrams * 9) / 4));

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  // Submit question to /api/ask
  const handleAsk = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!askQuestion.trim() || askLoading) return;
    setAskLoading(true);
    setAskError(null);
    setAskResult(null);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: askQuestion.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setAskError(data.error || data.reason || `Agent failed with status ${res.status}`);
      } else {
        setAskResult(data);
      }
    } catch (err: any) {
      setAskError(err.message || 'Failed to communicate with /api/ask');
    } finally {
      setAskLoading(false);
    }
  };

  // Test g8_search_food_nutrition via /api/mcp
  const handleTestNutrition = async () => {
    setNutritionLoading(true);
    setNutritionData(null);
    try {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'g8_search_food_nutrition',
            arguments: {
              query: nutritionQuery,
              brand_filter: nutritionBrand || undefined
            }
          }
        })
      });
      const data = await res.json();
      if (data?.result?.content?.[0]?.text) {
        try {
          const parsed = JSON.parse(data.result.content[0].text);
          setNutritionData(parsed);
        } catch {
          setNutritionData({ content: data.result.content });
        }
      } else if (data?.result?.isError) {
        setNutritionData(data.result);
      } else {
        setNutritionData(data);
      }
    } catch (err: any) {
      setNutritionData({ isError: true, content: [{ type: 'text', text: err.message }] });
    } finally {
      setNutritionLoading(false);
    }
  };

  // Test g8_get_user_activity_data via /api/mcp
  const handleTestActivity = async () => {
    setActivityLoading(true);
    setActivityData(null);
    try {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'g8_get_user_activity_data',
            arguments: {
              user_id: activityUserId,
              date_range: activityRange,
              metric: activityMetric
            }
          }
        })
      });
      const data = await res.json();
      if (data?.result?.content?.[0]?.text) {
        try {
          const parsed = JSON.parse(data.result.content[0].text);
          setActivityData(parsed);
        } catch {
          setActivityData(data?.result);
        }
      } else {
        setActivityData(data?.result || data);
      }
    } catch (err: any) {
      setActivityData({ isError: true, content: [{ type: 'text', text: err.message }] });
    } finally {
      setActivityLoading(false);
    }
  };

  // Test g8_fetch_evidence_guidelines via /api/mcp
  const handleTestResearch = async () => {
    setResearchLoading(true);
    setResearchData(null);
    try {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'g8_fetch_evidence_guidelines',
            arguments: {
              topic: researchTopic,
              max_results: researchMaxResults
            }
          }
        })
      });
      const data = await res.json();
      if (data?.result?.content?.[0]?.text) {
        try {
          const parsed = JSON.parse(data.result.content[0].text);
          setResearchData(parsed);
        } catch {
          setResearchData({ content: data.result.content });
        }
      } else {
        setResearchData(data?.result || data);
      }
    } catch (err: any) {
      setResearchData({ isError: true, content: [{ type: 'text', text: err.message }] });
    } finally {
      setResearchLoading(false);
    }
  };

  // Run raw JSON-RPC query
  const handleRunRawRpc = async () => {
    setRpcLoading(true);
    setRpcResponse(null);
    try {
      const body =
        rpcMethod === 'tools/list'
          ? {
              jsonrpc: '2.0',
              id: 1,
              method: 'tools/list',
              params: {}
            }
          : {
              jsonrpc: '2.0',
              id: 2,
              method: 'tools/call',
              params: {
                name: 'g8_search_food_nutrition',
                arguments: { query: 'oats' }
              }
            };

      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      setRpcResponse(JSON.stringify(json, null, 2));
    } catch (err: any) {
      setRpcResponse(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setRpcLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Server className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white">Group 8 Food Advisor MCP Server</h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Streamable HTTP
                </span>
              </div>
              <p className="text-xs text-slate-400">Model Context Protocol 2025-11-25 at /api/mcp</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => copyToClipboard('https://app-mcp.vercel.app/api/mcp')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 border border-slate-700 transition"
              title="Copy public MCP server endpoint"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>/api/mcp</span>
              {copiedEndpoint ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-2 overflow-x-auto border-t border-slate-800/60 pt-1">
          <button
            onClick={() => setActiveTab('ask')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'ask'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-4 h-4 text-emerald-400" />
            <span>Ask Agent (/api/ask)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview & Gemini Integration
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'tools'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Live Tools Explorer</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === 'architecture'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Agent Architecture Diagram
          </button>
          <button
            onClick={() => setActiveTab('calculator')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === 'calculator'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            TDEE & Nutrition Synthesizer
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* TAB: ASK AGENT */}
        {activeTab === 'ask' && (
          <div className="space-y-8">
            {/* Ask Agent Hero Header */}
            <div className="rounded-2xl p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
                  <Bot className="w-3.5 h-3.5" />
                  <span>Gemini 3.8 Flash + MCP Autonomous Agent</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
                  Ask the Food & Nutrition Intelligence Agent
                </h2>
                <p className="text-slate-300 text-sm leading-relaxed mb-4">
                  Ask questions in natural language. The agent at <code className="text-emerald-300 bg-slate-800 px-2 py-0.5 rounded font-mono">POST /api/ask</code> automatically discovers and calls tools exposed by connected MCP servers (<code className="text-slate-300">MCP_SERVERS</code>) to gather verified figures, scientific research, and activity metrics.
                </p>
              </div>

              {/* Ask Input Form */}
              <form onSubmit={handleAsk} className="mt-4 space-y-3">
                <div className="relative">
                  <textarea
                    value={askQuestion}
                    onChange={(e) => setAskQuestion(e.target.value.slice(0, 500))}
                    placeholder="Ask about food nutrition, clinical diet guidelines, or fitness activity expenditure..."
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition resize-none font-sans"
                  />
                  <div className="absolute bottom-2.5 right-3 text-[11px] font-mono text-slate-500 pointer-events-none">
                    {askQuestion.length}/500
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Preset prompt pills */}
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <span className="text-slate-500 self-center text-[11px] mr-1">Try:</span>
                    <button
                      type="button"
                      onClick={() => setAskQuestion('How many calories and protein are in 100g of oats?')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition text-[11px]"
                    >
                      Oats nutrition
                    </button>
                    <button
                      type="button"
                      onClick={() => setAskQuestion('What does PubMed literature say about Mediterranean diet for cardiovascular health?')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition text-[11px]"
                    >
                      Mediterranean diet evidence
                    </button>
                    <button
                      type="button"
                      onClick={() => setAskQuestion('What is the calorie expenditure for user usr_102 over the last 7d?')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition text-[11px]"
                    >
                      User activity metrics
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={askLoading || !askQuestion.trim()}
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-semibold text-xs tracking-wide shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                  >
                    {askLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        <span>Consulting Gemini & MCP Tools...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Ask Agent</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Error Message */}
            {askError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3 shadow-lg">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-rose-200">Agent Error</div>
                  <div className="text-rose-300/90 leading-relaxed">{askError}</div>
                </div>
              </div>
            )}

            {/* Results Panel */}
            {askResult && (
              <div className="space-y-6">
                {/* 1. The Answer */}
                <div className="rounded-2xl p-6 bg-slate-900 border border-slate-800 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-base text-white">Agent Answer</h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono text-[11px] border border-slate-700">
                        {askResult.model || 'gemini-3.8-flash'}
                      </span>
                      <span>
                        Answered at: {new Date(askResult.answered_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-slate-100 text-sm leading-relaxed whitespace-pre-wrap bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 font-sans">
                    {askResult.answer}
                  </div>
                </div>

                {/* 2. Under it: Every tool called in order with its arguments */}
                <div className="rounded-2xl p-6 bg-slate-900 border border-slate-800 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                        <Terminal className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-base text-white">Tools Called by Agent</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
                        {askResult.tool_calls.length}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">Invoked via MCP in chronological order</span>
                  </div>

                  {askResult.tool_calls.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-500 text-xs italic text-center">
                      No tool calls were needed or invoked for this query.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {askResult.tool_calls.map((tool, index) => (
                        <div
                          key={index}
                          className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2 transition hover:border-slate-700"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded bg-slate-800 text-slate-400 flex items-center justify-center font-mono text-[10px] font-bold">
                                #{index + 1}
                              </span>
                              <span className="font-mono font-bold text-emerald-400 text-sm">
                                {tool.name}
                              </span>
                            </div>

                            {tool.failed ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                <span>Tool Reported Failure</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Success</span>
                              </span>
                            )}
                          </div>

                          <div className="mt-2">
                            <div className="text-[11px] text-slate-400 font-medium mb-1">Arguments:</div>
                            <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed">
                              {JSON.stringify(tool.args, null, 2)}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Unavailable servers in grey */}
                {askResult.unavailable && askResult.unavailable.length > 0 && (
                  <div className="rounded-2xl p-5 bg-slate-900/60 border border-slate-700/60 shadow-lg text-slate-400">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="w-4 h-4 text-slate-500" />
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Unavailable MCP Servers
                      </h4>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                        {askResult.unavailable.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {askResult.unavailable.map((srv, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-400 font-mono"
                        >
                          <div className="truncate text-slate-300 font-semibold">{srv.address}</div>
                          <div className="text-[11px] text-slate-400 italic font-sans">{srv.reason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Hero Banner */}
            <div className="rounded-2xl p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Agent-Ready MCP Toolset</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-3">
                  Decoupled Evidence & Nutrition Service for Autonomous Agents
                </h2>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6">
                  Published at <code className="text-emerald-300 bg-slate-800 px-2 py-0.5 rounded font-mono">/api/mcp</code> using the official Model Context Protocol (<code className="text-slate-300">@modelcontextprotocol/sdk@1.30.1</code>) over Streamable HTTP. Any external agent powered by Gemini, Claude, or custom LLM frameworks can discover and invoke these specialized read-only tools without prior knowledge of our database or UI.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-1">
                      <Apple className="w-4 h-4" />
                      <span>g8_search_food_nutrition</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Live OpenFoodFacts & USDA data. Natural language ingredient search & brand filtering.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                    <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm mb-1">
                      <Activity className="w-4 h-4" />
                      <span>g8_get_user_activity_data</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Connected fitness providers (Pace, Garmin, Strava). Calorie burn and historical exercise.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                    <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm mb-1">
                      <BookOpen className="w-4 h-4" />
                      <span>g8_fetch_evidence_guidelines</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Direct NCBI PubMed biomedical literature for clinical trial evidence and dietary guidelines.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Calling from Gemini SDK Code Sample */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl p-6 bg-slate-900 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-emerald-400" />
                      <h3 className="font-semibold text-white">How External Agents Connect</h3>
                    </div>
                    <span className="text-xs font-mono text-slate-400">Gemini 2.5 / 3.0 SDK</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-4">
                    External agents consume this server using Streamable HTTP. The server returns JSON-RPC 2.0 tool definitions with complete Zod schemas and annotations.
                  </p>
                  <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed">
{`import { GoogleGenAI } from '@google/genai';

// External agent connects to our published MCP server
const ai = new GoogleGenAI();

// Call tools/list via Streamable HTTP POST /api/mcp
const response = await fetch('https://app-mcp.vercel.app/api/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  })
});

const { result } = await response.json();
console.log('Discovered tools:', result.tools.map(t => t.name));
// ['g8_search_food_nutrition', 'g8_get_user_activity_data', 'g8_fetch_evidence_guidelines']`}
                  </pre>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Guardrail: Read-only tools only. No write, no login, no keys exposed.</span>
                  <span className="text-emerald-400 font-semibold">Stateless Transport</span>
                </div>
              </div>

              {/* JSON-RPC Quick Test Console */}
              <div className="rounded-2xl p-6 bg-slate-900 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-400" />
                      <h3 className="font-semibold text-white">Interactive JSON-RPC Console</h3>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRpcMethod('tools/list')}
                        className={`px-2.5 py-1 text-xs rounded-md transition ${
                          rpcMethod === 'tools/list'
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        tools/list
                      </button>
                      <button
                        onClick={() => setRpcMethod('tools/call')}
                        className={`px-2.5 py-1 text-xs rounded-md transition ${
                          rpcMethod === 'tools/call'
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        tools/call
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 mb-3">
                    Sends a live JSON-RPC 2.0 payload to the local endpoint <code className="text-emerald-300 font-mono">POST /api/mcp</code> with required Streamable HTTP headers.
                  </p>

                  <button
                    onClick={handleRunRawRpc}
                    disabled={rpcLoading}
                    className="w-full py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition mb-3 disabled:opacity-50"
                  >
                    {rpcLoading ? 'Executing JSON-RPC request...' : `Run ${rpcMethod} on /api/mcp`}
                  </button>

                  <div className="h-56 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-y-auto">
                    {rpcResponse ? (
                      <pre>{rpcResponse}</pre>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
                        Click above to run live query against /api/mcp
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-500 flex justify-between">
                  <span>Server: g8-server v1.0.0</span>
                  <span>HTTP Method Guard: 405 on non-POST</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE TOOLS EXPLORER */}
        {activeTab === 'tools' && (
          <div className="space-y-8">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>Published MCP Tools Explorer</span>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">3 Tools</span>
              </h2>
              <p className="text-sm text-slate-400">
                Test each tool exactly as external agents execute them via <code className="text-emerald-400">tools/call</code> on <code className="text-emerald-400">/api/mcp</code>.
              </p>
            </div>

            {/* Tool 1: Nutrition */}
            <div className="rounded-2xl p-6 bg-slate-900 border border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Apple className="w-5 h-5" />
                    </span>
                    <h3 className="font-bold text-lg text-white font-mono">g8_search_food_nutrition</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Upstream: OpenFoodFacts & USDA FoodData Central &bull; Annotations: readOnlyHint, openWorldHint
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-slate-800 text-xs font-mono text-emerald-400 border border-slate-700">
                    Max 20 Items
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    query (Food name or ingredient)
                  </label>
                  <input
                    type="text"
                    value={nutritionQuery}
                    onChange={(e) => setNutritionQuery(e.target.value)}
                    placeholder="e.g. rolled oats, salmon, almond milk"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    brand_filter (Optional)
                  </label>
                  <input
                    type="text"
                    value={nutritionBrand}
                    onChange={(e) => setNutritionBrand(e.target.value)}
                    placeholder="e.g. Chobani, Quaker"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                onClick={handleTestNutrition}
                disabled={nutritionLoading}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-2 transition disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5" />
                {nutritionLoading ? 'Calling g8_search_food_nutrition...' : 'Invoke Tool'}
              </button>

              {nutritionData && (
                <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3 border-b border-slate-800 pb-2">
                    <span className="font-semibold text-emerald-400">
                      Source: {nutritionData.source || 'OpenFoodFacts & USDA FoodData Central'}
                    </span>
                    <span>Fetched: {nutritionData.fetched_at || new Date().toISOString()}</span>
                  </div>

                  {nutritionData.isError ? (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{nutritionData.content?.[0]?.text || 'Upstream query failed.'}</span>
                    </div>
                  ) : nutritionData.items && nutritionData.items.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {nutritionData.items.slice(0, 6).map((item, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                          <div className="font-semibold text-white truncate" title={item.product_name}>
                            {item.product_name}
                          </div>
                          <div className="text-slate-400 flex justify-between">
                            <span>{item.brand}</span>
                            <span className="text-emerald-400 font-mono">{item.serving_size}</span>
                          </div>
                          <div className="pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-1 text-[11px] text-slate-300">
                            <div><span className="text-slate-500">Cals:</span> {item.calories_kcal ?? '-'}</div>
                            <div><span className="text-slate-500">Prot:</span> {item.protein_g ? `${item.protein_g}g` : '-'}</div>
                            <div><span className="text-slate-500">Carb:</span> {item.carbohydrates_g ? `${item.carbohydrates_g}g` : '-'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs italic">No items found for this query.</div>
                  )}

                  <details className="mt-3">
                    <summary className="text-[11px] text-slate-500 hover:text-slate-400 cursor-pointer font-mono">
                      View Raw Tool JSON Result
                    </summary>
                    <pre className="mt-2 p-3 rounded bg-slate-900 text-slate-300 font-mono text-[11px] max-h-48 overflow-y-auto">
                      {JSON.stringify(nutritionData, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>

            {/* Tool 2: Activity */}
            <div className="rounded-2xl p-6 bg-slate-900 border border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
                      <Activity className="w-5 h-5" />
                    </span>
                    <h3 className="font-bold text-lg text-white font-mono">g8_get_user_activity_data</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Upstream: Fitness Providers (Pace, Garmin, Strava) &bull; Annotations: readOnlyHint, openWorldHint
                  </p>
                </div>
                <span className="px-2 py-1 rounded bg-slate-800 text-xs font-mono text-sky-400 border border-slate-700">
                  Active Calorie Records
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    user_id
                  </label>
                  <input
                    type="text"
                    value={activityUserId}
                    onChange={(e) => setActivityUserId(e.target.value)}
                    placeholder="e.g. usr_102"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    date_range
                  </label>
                  <input
                    type="text"
                    value={activityRange}
                    onChange={(e) => setActivityRange(e.target.value)}
                    placeholder="e.g. 7d, 30d, 2025-01-01/2025-01-07"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    metric
                  </label>
                  <select
                    value={activityMetric}
                    onChange={(e) => setActivityMetric(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                  >
                    <option value="calories">calories</option>
                    <option value="steps">steps</option>
                    <option value="workouts">workouts</option>
                    <option value="all">all</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleTestActivity}
                disabled={activityLoading}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs flex items-center gap-2 transition disabled:opacity-50"
              >
                <Activity className="w-3.5 h-3.5" />
                {activityLoading ? 'Calling g8_get_user_activity_data...' : 'Invoke Tool'}
              </button>

              {activityData && (
                <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3 border-b border-slate-800 pb-2">
                    <span className="font-semibold text-sky-400">
                      Source: {activityData.source || 'Pace Fitness Provider'}
                    </span>
                    <span>Fetched: {activityData.fetched_at || new Date().toISOString()}</span>
                  </div>

                  {activityData.isError ? (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{activityData.content?.[0]?.text || 'Upstream provider returned status.'}</span>
                    </div>
                  ) : activityData.items && activityData.items.length > 0 ? (
                    <div className="space-y-2">
                      {activityData.items.map((it, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex justify-between items-center">
                          <span className="font-medium text-white">{it.name || it.type || `Session #${i + 1}`}</span>
                          <span className="text-sky-400 font-mono">{it.calories_burned ? `${it.calories_burned} kcal` : it.distance_meters ? `${(it.distance_meters/1000).toFixed(1)} km` : '-'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs italic">
                      Zero items returned from provider or provider disconnected.
                    </div>
                  )}

                  <details className="mt-3">
                    <summary className="text-[11px] text-slate-500 hover:text-slate-400 cursor-pointer font-mono">
                      View Raw Tool JSON Result
                    </summary>
                    <pre className="mt-2 p-3 rounded bg-slate-900 text-slate-300 font-mono text-[11px] max-h-48 overflow-y-auto">
                      {JSON.stringify(activityData, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>

            {/* Tool 3: Research */}
            <div className="rounded-2xl p-6 bg-slate-900 border border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                      <BookOpen className="w-5 h-5" />
                    </span>
                    <h3 className="font-bold text-lg text-white font-mono">g8_fetch_evidence_guidelines</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Upstream: NCBI PubMed & Healthcare Data Hub &bull; Annotations: readOnlyHint, openWorldHint
                  </p>
                </div>
                <span className="px-2 py-1 rounded bg-slate-800 text-xs font-mono text-purple-400 border border-slate-700">
                  Clinical Trial & Guidelines
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    topic (Medical / nutrition topic)
                  </label>
                  <input
                    type="text"
                    value={researchTopic}
                    onChange={(e) => setResearchTopic(e.target.value)}
                    placeholder="e.g. mediterranean diet, intermittent fasting diabetes"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    max_results (1-20)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={researchMaxResults}
                    onChange={(e) => setResearchMaxResults(parseInt(e.target.value, 10) || 5)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <button
                onClick={handleTestResearch}
                disabled={researchLoading}
                className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-semibold text-xs flex items-center gap-2 transition disabled:opacity-50"
              >
                <BookOpen className="w-3.5 h-3.5" />
                {researchLoading ? 'Calling g8_fetch_evidence_guidelines...' : 'Invoke Tool'}
              </button>

              {researchData && (
                <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3 border-b border-slate-800 pb-2">
                    <span className="font-semibold text-purple-400">
                      Source: {researchData.source || 'NCBI PubMed (Healthcare Data Hub)'}
                    </span>
                    <span>Fetched: {researchData.fetched_at || new Date().toISOString()}</span>
                  </div>

                  {researchData.isError ? (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{researchData.content?.[0]?.text || 'Upstream query failed.'}</span>
                    </div>
                  ) : researchData.items && researchData.items.length > 0 ? (
                    <div className="space-y-3">
                      {researchData.items.map((pub, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-white leading-snug">{pub.title}</span>
                            <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 font-mono text-[10px] flex-shrink-0 border border-purple-500/30">
                              PMID: {pub.pmid}
                            </span>
                          </div>
                          <div className="text-slate-400 flex flex-wrap gap-x-3 text-[11px]">
                            <span>Journal: <strong className="text-slate-300">{pub.journal}</strong></span>
                            <span>Date: <strong className="text-slate-300">{pub.pubdate}</strong></span>
                            {pub.doi && (
                              <a
                                href={`https://doi.org/${pub.doi}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-purple-400 hover:underline flex items-center gap-1"
                              >
                                DOI <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                          {pub.authors && pub.authors.length > 0 && (
                            <div className="text-slate-500 text-[11px] truncate">
                              Authors: {pub.authors.slice(0, 4).join(', ')}{pub.authors.length > 4 ? ' et al.' : ''}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs italic">No PubMed records found for this query.</div>
                  )}

                  <details className="mt-3">
                    <summary className="text-[11px] text-slate-500 hover:text-slate-400 cursor-pointer font-mono">
                      View Raw Tool JSON Result
                    </summary>
                    <pre className="mt-2 p-3 rounded bg-slate-900 text-slate-300 font-mono text-[11px] max-h-48 overflow-y-auto">
                      {JSON.stringify(researchData, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: AGENT ARCHITECTURE */}
        {activeTab === 'architecture' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <span>Group 2 Food Advisor Agentic Workflow</span>
              </h2>
              <p className="text-sm text-slate-400">
                Visualizing how autonomous agents (Activity Analysis, Calorie Calculation, Literature Review, Meal Planning, Recommendation Engine) interact with our published MCP tools.
              </p>
            </div>

            {/* Workflow Diagram Card */}
            <div className="rounded-2xl p-6 bg-slate-900 border border-slate-800 overflow-x-auto">
              <div className="min-w-[800px] flex flex-col gap-6">
                {/* Level 1: Input to Agents */}
                <div className="flex items-center justify-between gap-4">
                  <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-sm w-44 text-center shadow-lg">
                    User Inputs
                    <div className="text-[11px] font-normal text-slate-400 mt-1">Profile, rules, goals</div>
                  </div>

                  <div className="flex-1 grid grid-cols-3 gap-4">
                    {/* Activity Agent */}
                    <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
                      <div className="flex items-center justify-between text-xs font-bold text-sky-400 mb-1">
                        <span>Activity Analysis Agent</span>
                        <Activity className="w-4 h-4" />
                      </div>
                      <div className="text-[11px] text-slate-400 mb-2">Extracts workout metrics & burn</div>
                      <div className="p-2 rounded bg-slate-950 border border-sky-500/30 text-[10px] text-sky-300 font-mono">
                        &larr; g8_get_user_activity_data
                      </div>
                    </div>

                    {/* Literature Agent */}
                    <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
                      <div className="flex items-center justify-between text-xs font-bold text-purple-400 mb-1">
                        <span>Literature Review Agent</span>
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div className="text-[11px] text-slate-400 mb-2">Fetches clinical evidence</div>
                      <div className="p-2 rounded bg-slate-950 border border-purple-500/30 text-[10px] text-purple-300 font-mono">
                        &larr; g8_fetch_evidence_guidelines
                      </div>
                    </div>

                    {/* Meal Planning Agent */}
                    <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-400 mb-1">
                        <span>Meal Planning Agent</span>
                        <Apple className="w-4 h-4" />
                      </div>
                      <div className="text-[11px] text-slate-400 mb-2">Sources food macros & items</div>
                      <div className="p-2 rounded bg-slate-950 border border-emerald-500/30 text-[10px] text-emerald-300 font-mono">
                        &larr; g8_search_food_nutrition
                      </div>
                    </div>
                  </div>
                </div>

                {/* Level 2: Calorie Calculation & Intermediates */}
                <div className="flex items-center justify-center gap-6">
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 max-w-md w-full text-center">
                    <div className="text-amber-400 font-bold text-xs flex items-center justify-center gap-2 mb-1">
                      <Flame className="w-4 h-4" />
                      <span>Calorie Calculation Agent</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Combines user biometric profile + active calorie expenditure from fitness MCP to compute Total Daily Energy Expenditure (TDEE).
                    </p>
                  </div>
                </div>

                {/* Level 3: Recommendation Engine */}
                <div className="flex items-center justify-center">
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-sky-950/60 border border-emerald-500/40 max-w-xl w-full text-center shadow-xl">
                    <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm mb-2">
                      <Sparkles className="w-4 h-4" />
                      <span>Recommendation Engine</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Synthesizes calorie targets, evidence-based clinical diet patterns (Mediterranean, DASH), and concrete meal combinations into a personalized nutritional regime.
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Personalized Nutrition Recommendations Generated</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CALCULATOR & SYNTHESIZER */}
        {activeTab === 'calculator' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                <span>Calorie & Macro Synthesizer</span>
              </h2>
              <p className="text-sm text-slate-400">
                Simulate the Calorie Calculation Agent and Meal Planning Agent pipeline using Mifflin-St Jeor and evidence-based macro ratios.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* User Inputs Form */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="font-semibold text-white text-sm">Biometric & Activity Parameters</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      value={weightKg}
                      onChange={(e) => setWeightKg(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Height (cm)</label>
                    <input
                      type="number"
                      value={heightCm}
                      onChange={(e) => setHeightCm(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Age</label>
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Biological Sex</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Activity Multiplier</label>
                  <select
                    value={activityMultiplier}
                    onChange={(e) => setActivityMultiplier(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white"
                  >
                    <option value={1.2}>Sedentary (desk job, 1.2x)</option>
                    <option value={1.375}>Lightly Active (1-3 days/wk, 1.375x)</option>
                    <option value={1.55}>Moderately Active (3-5 days/wk, 1.55x)</option>
                    <option value={1.725}>Very Active (6-7 days/wk, 1.725x)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Nutritional Goal</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['cut', 'maintain', 'bulk'] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => setGoal(g)}
                        className={`py-2 text-xs font-semibold rounded-lg capitalize transition ${
                          goal === g
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {g === 'cut' ? 'Fat Loss' : g === 'bulk' ? 'Muscle Gain' : 'Maintain'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Energy Results */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-white text-sm mb-4">Calculated Energy Target</h3>
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                      <div>
                        <div className="text-xs text-slate-400">Basal Metabolic Rate (BMR)</div>
                        <div className="text-lg font-bold text-white">{bmr} kcal/day</div>
                      </div>
                      <Dna className="w-5 h-5 text-emerald-400" />
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                      <div>
                        <div className="text-xs text-slate-400">Total Daily Energy Expenditure (TDEE)</div>
                        <div className="text-lg font-bold text-sky-400">{tdee} kcal/day</div>
                      </div>
                      <Activity className="w-5 h-5 text-sky-400" />
                    </div>

                    <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex justify-between items-center">
                      <div>
                        <div className="text-xs text-emerald-300 font-semibold">Recommended Daily Intake</div>
                        <div className="text-2xl font-black text-white">{targetCalories} kcal</div>
                      </div>
                      <Flame className="w-6 h-6 text-emerald-400" />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400">
                  Computed via Mifflin-St Jeor formula validated by clinical nutrition consensus.
                </div>
              </div>

              {/* Target Macronutrients */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-white text-sm mb-4">Target Macronutrient Breakdown</h3>
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-slate-300 font-semibold">Protein (2.0 g/kg)</span>
                        <span className="text-xs font-mono text-emerald-400 font-bold">{proteinGrams}g</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {proteinGrams * 4} kcal &bull; Supports muscle protein synthesis and satiety.
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-slate-300 font-semibold">Fats (25% of energy)</span>
                        <span className="text-xs font-mono text-amber-400 font-bold">{fatGrams}g</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {fatGrams * 9} kcal &bull; Essential fatty acids and hormone regulation.
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-slate-300 font-semibold">Carbohydrates (Balance)</span>
                        <span className="text-xs font-mono text-sky-400 font-bold">{carbGrams}g</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {carbGrams * 4} kcal &bull; Muscle glycogen replenishment and dietary fiber.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setActiveTab('tools');
                      setNutritionQuery('chicken breast');
                      handleTestNutrition();
                    }}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition"
                  >
                    <span>Match with Foods via g8_search_food_nutrition</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        Group 8 Food Advisor &bull; MCP Server 2025-11-25 &bull; Model Context Protocol SDK v1.30.1 &bull; Streamable HTTP
      </footer>
    </div>
  );
}
