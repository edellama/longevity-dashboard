import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const UNIFIED_DATA_PATH = path.join(process.cwd(), "data", "unified", "health_data.json");

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  model: "openai" | "claude";
}

/**
 * Load unified health data for AI context
 */
async function loadHealthData(): Promise<string> {
  try {
    const data = await fs.readFile(UNIFIED_DATA_PATH, "utf-8");
    const parsed = JSON.parse(data);

    // Create a summarized context (to avoid token limits)
    const summary = parsed.summary || {};
    const correlations = parsed.correlations || {};
    const recentDays = (parsed.dailyData || []).slice(-30); // Last 30 days
    const biomarkers = parsed.biomarkers || [];

    return JSON.stringify({
      summary,
      correlations,
      recentDailyData: recentDays,
      biomarkerResults: biomarkers.slice(-50), // Last 50 biomarker results
      generatedAt: parsed.generatedAt,
    }, null, 2);
  } catch (error) {
    console.error("Error loading health data:", error);
    return "No health data available yet. Run 'npm run consolidate-data' to generate it.";
  }
}

/**
 * Build system prompt with health data context
 */
function buildSystemPrompt(healthData: string): string {
  return `You are a personal health and longevity AI assistant. You have access to the user's comprehensive health data from multiple sources including:

- **Garmin**: Daily steps, sleep duration/quality, resting heart rate, stress levels, body battery, exercise activities, weight, body composition
- **Whoop**: Recovery scores, HRV (heart rate variability), strain, sleep performance
- **Lingo CGM**: Continuous glucose monitoring data (blood sugar levels throughout the day)
- **Biomarkers**: Lab test results (blood work, metabolic panels, etc.)

Your role is to:
1. Answer questions about the user's health data and trends
2. Identify correlations and patterns (e.g., how exercise affects sleep, how sleep affects glucose)
3. Provide actionable insights for improving health and longevity
4. Explain what the data means in simple terms
5. Suggest areas for improvement based on the data

Important guidelines:
- Always cite specific data points when making claims
- Be honest about limitations (correlation vs causation, insufficient data, etc.)
- Provide actionable recommendations when appropriate
- Use a friendly, supportive tone
- If asked about medical conditions, remind the user to consult a healthcare professional

Here is the user's current health data:

\`\`\`json
${healthData}
\`\`\`

The data includes:
- Summary statistics (averages, ranges, data coverage)
- Calculated correlations between variables
- Recent daily data (last 30 days)
- Recent biomarker/lab results

Analyze this data to provide personalized insights.`;
}

/**
 * Call OpenAI API
 */
async function callOpenAI(messages: ChatMessage[], systemPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "No response generated";
}

/**
 * Call Anthropic Claude API
 */
async function callClaude(messages: ChatMessage[], systemPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  // Convert messages format for Claude
  const claudeMessages = messages.map(m => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: claudeMessages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${error}`);
  }

  const data = await response.json();
  return data.content[0]?.text || "No response generated";
}

/**
 * POST /api/chat
 * Chat with AI about health data
 */
export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { messages, model } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided" },
        { status: 400 }
      );
    }

    // Load health data for context
    const healthData = await loadHealthData();
    const systemPrompt = buildSystemPrompt(healthData);

    // Call the selected AI model
    let response: string;
    if (model === "claude") {
      response = await callClaude(messages, systemPrompt);
    } else {
      response = await callOpenAI(messages, systemPrompt);
    }

    return NextResponse.json({
      message: response,
      model: model || "openai",
    });
  } catch (error) {
    console.error("Chat API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat
 * Health check and info
 */
export async function GET() {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasClaude = !!process.env.ANTHROPIC_API_KEY;

  return NextResponse.json({
    status: "ok",
    availableModels: {
      openai: hasOpenAI,
      claude: hasClaude,
    },
    usage: "POST messages to chat about your health data",
  });
}
