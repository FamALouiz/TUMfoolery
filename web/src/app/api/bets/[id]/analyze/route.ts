import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const betId = params.id;

    // Get the bet
    const bet = await prisma.bet.findUnique({
      where: { id: betId },
    });

    if (!bet) {
      return NextResponse.json({ error: "Bet not found" }, { status: 404 });
    }

    if (bet.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Mock AI analysis - in production, this would call Gemini API
    const aiSummary = generateMockAnalysis(bet);

    // Update bet with AI summary
    const updatedBet = await prisma.bet.update({
      where: { id: betId },
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

function generateMockAnalysis(bet: any): string {
  const isPending = bet.status === "pending";
  const isWon = bet.status === "won";

  if (isPending) {
    return (
      `**Bet Analysis for ${bet.team1} vs ${bet.team2}**\n\n` +
      `Your bet is currently pending. You wagered $${bet.betAmount} on ${bet.predictedOutcome} at odds of ${bet.odds}.\n\n` +
      `**Market Insight:** The ${bet.platform} market suggests this is a competitive matchup. ` +
      `Monitor the match closely as odds may shift based on team performance and market sentiment.\n\n` +
      `**Potential Outcome:** If your prediction is correct, you stand to gain approximately $${(
        bet.betAmount * bet.odds -
        bet.betAmount
      ).toFixed(2)}.`
    );
  }

  if (isWon) {
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
