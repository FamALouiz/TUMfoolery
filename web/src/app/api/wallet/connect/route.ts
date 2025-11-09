import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { walletAddress, walletType } = await req.json();

    if (!walletAddress || !walletType) {
      return NextResponse.json(
        { error: "Wallet address and type are required" },
        { status: 400 }
      );
    }

    // Mock wallet connection - in production, you would verify the wallet signature
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        walletAddress,
        walletType,
      },
    });

    return NextResponse.json({
      success: true,
      wallet: {
        address: updatedUser.walletAddress,
        type: updatedUser.walletType,
      },
    });
  } catch (error) {
    console.error("Error connecting wallet:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Disconnect wallet
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        walletAddress: null,
        walletType: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting wallet:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
