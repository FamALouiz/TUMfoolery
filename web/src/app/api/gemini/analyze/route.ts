import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketData, userMessage, conversationHistory, enabledSources } =
      body;

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    // Build the system prompt
    const systemPrompt = buildSystemPrompt(marketData, enabledSources);

    // Build conversation context
    const conversationContext = conversationHistory
      .map(
        (msg: any) =>
          `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
      )
      .join("\n\n");

    // Combine everything for the prompt
    const fullPrompt = `${systemPrompt}

Previous Conversation:
${conversationContext}

User's Question: ${userMessage}

Please provide a detailed analysis based on the enabled data sources: ${enabledSources.join(
      ", "
    )}. Include specific insights from each source and cite them in your response.`;

    // Call Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: fullPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gemini API error:", errorData);
      return NextResponse.json(
        { error: "Failed to get response from Gemini" },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("Gemini API response data:", data);
    const generatedText =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response generated";

    // Extract sources from the response (simple heuristic)
    const sources = extractSources(generatedText, enabledSources);

    return NextResponse.json({
      content: generatedText,
      sources: sources,
    });
  } catch (error) {
    console.error("Error in Gemini API route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function buildSystemPrompt(marketData: any, enabledSources: string[]) {
  const {
    team1,
    team2,
    marketDescription,
    tumfooleryProb,
    kalshiProb,
    manifoldProb,
  } = marketData;

  return `You are an expert sports betting analyst AI assistant for TUMfoolery, a premier sports analytics platform. Your role is to help users make informed betting decisions by analyzing market data from multiple sources.

CURRENT MARKET CONTEXT:
- Match: ${team1} vs ${team2}
- Market: ${marketDescription}
- TUMfoolery Prediction: ${(tumfooleryProb * 100).toFixed(1)}%
${
  kalshiProb !== undefined
    ? `- Kalshi Market Price: ${(kalshiProb * 100).toFixed(1)}%`
    : ""
}
${
  manifoldProb !== undefined
    ? `- Manifold Market Price: ${(manifoldProb * 100).toFixed(1)}%`
    : ""
}

ENABLED DATA SOURCES:
${enabledSources.join(", ")}

YOUR RESPONSIBILITIES:
1. Analyze the betting market from multiple angles using the enabled data sources
2. Identify discrepancies between different prediction sources and explain why they might exist
3. Provide sentiment analysis from social media (X/Twitter, Instagram, Reddit)
4. Summarize recent news and team updates
5. Consider historical performance and head-to-head statistics
6. Evaluate injury reports and team form
7. Assess weather conditions and venue factors when relevant
8. Determine if the market presents a genuine arbitrage opportunity or value bet
9. Give a clear recommendation: whether this is a worthwhile bet and why

ANALYSIS FRAMEWORK:
- **Sentiment Analysis**: Scrape and analyze social media sentiment from enabled sources
- **News Analysis**: Review recent news articles and press releases
- **Historical Data**: Compare historical matchups and performance trends
- **Market Efficiency**: Assess whether price discrepancies indicate market inefficiency or legitimate information asymmetry
- **Risk Assessment**: Evaluate the risk/reward profile of the bet
- **Confidence Level**: Provide your confidence level in the recommendation (Low/Medium/High)

OUTPUT FORMAT:
- Start with a brief executive summary (2-3 sentences)
- Break down your analysis by data source
- Highlight key insights with bullet points
- End with a clear recommendation
- Always cite which sources you're pulling information from
- Use specific numbers and percentages when available

TONE & STYLE:
- Professional but accessible
- Data-driven and objective
- Transparent about uncertainty
- Highlight both supporting and contradicting evidence
- Avoid absolute guarantees about outcomes

Remember: Users are relying on your analysis to make real betting decisions. Be thorough, honest, and transparent about the limitations of available data.`;
}

function extractSources(text: string, enabledSources: string[]): string[] {
  const sources: string[] = [];
  const lowerText = text.toLowerCase();

  // Map of source keywords to source names
  const sourceKeywords: { [key: string]: string[] } = {
    Twitter: ["twitter", "tweet", "x.com", "social media sentiment"],
    Instagram: ["instagram", "ig", "insta"],
    Reddit: ["reddit", "subreddit", "r/"],
    News: ["news", "article", "press release", "report"],
    "Historical Data": [
      "historical",
      "history",
      "past matches",
      "head-to-head",
      "h2h",
    ],
    Weather: ["weather", "conditions", "temperature", "rain", "wind"],
    "Team News": ["injury", "lineup", "squad", "team news", "roster"],
    Statistics: ["stats", "statistics", "metrics", "analytics"],
  };

  enabledSources.forEach((source) => {
    const keywords = sourceKeywords[source] || [source.toLowerCase()];
    const found = keywords.some((keyword) => lowerText.includes(keyword));
    if (found && !sources.includes(source)) {
      sources.push(source);
    }
  });

  // Always include at least one source
  if (sources.length === 0 && enabledSources.length > 0) {
    sources.push(enabledSources[0]);
  }

  return sources;
}
