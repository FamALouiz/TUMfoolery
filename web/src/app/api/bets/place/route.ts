import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      team1,
      team2,
      marketDescription,
      platform,
      betAmount,
      odds,
      predictedOutcome,
    } = await req.json();

    // Validate required fields
    if (
      !team1 ||
      !team2 ||
      !marketDescription ||
      !platform ||
      !betAmount ||
      !odds ||
      !predictedOutcome
    ) {
      return NextResponse.json(
        { error: "All bet fields are required" },
        { status: 400 }
      );
    }

    // Get user's wallet
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { walletAddress: true },
    });

    if (!user?.walletAddress) {
      return NextResponse.json(
        { error: "Please connect a wallet first" },
        { status: 400 }
      );
    }

    // Mock API call to marketplace (Kalshi or Manifold)
    // In production, this would make actual API calls to place the bet
    console.log(`[MOCK] Placing bet on ${platform}:`, {
      team1,
      team2,
      marketDescription,
      betAmount,
      odds,
      predictedOutcome,
    });

    // Create bet record
    const bet = await prisma.bet.create({
      data: {
        userId: session.user.id,
        team1,
        team2,
        marketDescription,
        platform,
        betAmount,
        odds,
        predictedOutcome,
        walletAddress: user.walletAddress,
        status: "pending",
      },
    });

    return NextResponse.json({
      success: true,
      bet: {
        id: bet.id,
        team1: bet.team1,
        team2: bet.team2,
        marketDescription: bet.marketDescription,
        platform: bet.platform,
        betAmount: bet.betAmount,
        odds: bet.odds,
        predictedOutcome: bet.predictedOutcome,
        status: bet.status,
        createdAt: bet.createdAt,
      },
    });
  } catch (error) {
    console.error("Error placing bet:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
