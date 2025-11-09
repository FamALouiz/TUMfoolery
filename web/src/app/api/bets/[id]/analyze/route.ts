import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    // Get the bet
    const bet = await prisma.bet.findFirst({
      where: { id: params.id },
    });

    if (!bet) {
      return NextResponse.json({ error: "Bet not found" }, { status: 404 });
    }

    if (bet.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Generate AI analysis using Gemini
    const aiSummary = await generateGeminiAnalysis(bet);

    // Update bet with AI summary
    const updatedBet = await prisma.bet.update({
      where: { id: bet.id },
      data: { aiSummary },
    });

    return NextResponse.json({
      success: true,
      summary: updatedBet.aiSummary,
    });
  } catch (error) {
    console.error("Error analyzing bet:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function generateGeminiAnalysis(bet: any): Promise<string> {
  const statusText =
    bet.status === "pending"
      ? "pending"
      : bet.status === "won"
      ? "won"
      : "lost";

  const prompt = `You are a professional sports betting analyst. Analyze the following bet and provide detailed insights:

**Bet Details:**
- Match: ${bet.team1} vs ${bet.team2}
- Market: ${bet.marketDescription}
- Platform: ${bet.platform}
- Predicted Outcome: ${bet.predictedOutcome}
- Odds: ${bet.odds}
- Bet Amount: $${bet.betAmount}
- Status: ${statusText}
${bet.profitLoss ? `- Profit/Loss: $${bet.profitLoss.toFixed(2)}` : ""}
${bet.walletAddress ? `- Wallet: ${bet.walletAddress}` : ""}

**Your Task:**
Provide a comprehensive analysis of this bet with the following structure:

1. **Summary**: Brief overview of the bet outcome
2. **Market Analysis**: Discuss what the odds and market suggest about this match
3. **Key Factors**: ${
    statusText === "pending"
      ? "What factors should be monitored as the match progresses"
      : statusText === "won"
      ? "What factors contributed to the successful prediction"
      : "What factors led to the incorrect prediction"
  }
4. **Insights**: ${
    statusText === "pending"
      ? "Potential scenarios and what to watch for"
      : "Lessons learned and future recommendations"
  }
5. **Risk Assessment**: Evaluate the risk level of this bet based on the odds and market

Keep your response concise, professional, and actionable. Use markdown formatting for better readability.`;

  try {
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
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gemini API error:", errorData);
      // Fallback to a simple summary if Gemini fails
      return generateFallbackAnalysis(bet, statusText);
    }

    const data = await response.json();
    const generatedText =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      generateFallbackAnalysis(bet, statusText);

    return generatedText;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return generateFallbackAnalysis(bet, statusText);
  }
}

function generateFallbackAnalysis(bet: any, statusText: string): string {
  const potentialProfit = (bet.betAmount * bet.odds - bet.betAmount).toFixed(2);

  if (statusText === "pending") {
    return (
      `**Bet Analysis for ${bet.team1} vs ${bet.team2}**\n\n` +
      `Your bet is currently pending. You wagered $${bet.betAmount} on ${bet.predictedOutcome} at odds of ${bet.odds}.\n\n` +
      `**Market Insight:** The ${bet.platform} market suggests this is a competitive matchup. ` +
      `Monitor the match closely as odds may shift based on team performance and market sentiment.\n\n` +
      `**Potential Outcome:** If your prediction is correct, you stand to gain approximately $${potentialProfit}.`
    );
  }

  if (statusText === "won") {
    return (
      `**Victory Analysis for ${bet.team1} vs ${bet.team2}**\n\n` +
      `Congratulations! Your bet on ${
        bet.predictedOutcome
      } was successful. You profited $${bet.profitLoss?.toFixed(2)}.\n\n` +
      `**What Went Right:** Your analysis correctly predicted the outcome. The odds of ${bet.odds} reflected the market's view, ` +
      `and the actual result validated your prediction.\n\n` +
      `**Key Factors:** The winning team likely demonstrated superior performance in critical moments, ` +
      `aligning with your initial assessment when placing the bet on ${bet.platform}.`
    );
  }

  // Lost bet
  return (
    `**Loss Analysis for ${bet.team1} vs ${bet.team2}**\n\n` +
    `Your bet on ${bet.predictedOutcome} did not pan out. You lost $${Math.abs(
      bet.profitLoss || 0
    ).toFixed(2)}.\n\n` +
    `**What Went Wrong:** The match outcome differed from your prediction. This could be due to:\n` +
    `- Unexpected team performance or injuries\n` +
    `- Market odds not fully reflecting the true probability\n` +
    `- External factors affecting the match outcome\n\n` +
    `**Learning Opportunity:** Consider analyzing team statistics more thoroughly and comparing multiple market sources ` +
    `before placing future bets. The ${bet.platform} odds of ${bet.odds} may have suggested higher risk than anticipated.`
  );
}
