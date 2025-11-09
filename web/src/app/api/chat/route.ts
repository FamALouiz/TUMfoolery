import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Fetch chat history for a specific market
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const marketKey = searchParams.get("marketKey");

    if (!marketKey) {
      return NextResponse.json(
        { error: "marketKey is required" },
        { status: 400 }
      );
    }

    const chatHistory = await prisma.chatHistory.findUnique({
      where: {
        userId_marketKey: {
          userId: session.user.id,
          marketKey,
        },
      },
      include: {
        messages: {
          orderBy: {
            timestamp: "asc",
          },
        },
      },
    });

    return NextResponse.json({ chatHistory });
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Save or update chat history
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      marketKey,
      team1,
      team2,
      marketDescription,
      messages,
      enabledSources,
    } = await req.json();

    if (!marketKey || !team1 || !team2 || !marketDescription) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Upsert chat history
    const chatHistory = await prisma.chatHistory.upsert({
      where: {
        userId_marketKey: {
          userId: session.user.id,
          marketKey,
        },
      },
      update: {
        team1,
        team2,
        marketDescription,
        enabledSources: enabledSources || [],
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        marketKey,
        team1,
        team2,
        marketDescription,
        enabledSources: enabledSources || [],
      },
    });

    // Delete existing messages and create new ones
    if (messages && messages.length > 0) {
      await prisma.chatMessage.deleteMany({
        where: { chatHistoryId: chatHistory.id },
      });

      await prisma.chatMessage.createMany({
        data: messages.map((msg: any) => ({
          chatHistoryId: chatHistory.id,
          role: msg.role,
          content: msg.content,
          sources: msg.sources || [],
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        })),
      });
    }

    return NextResponse.json({ success: true, chatHistoryId: chatHistory.id });
  } catch (error) {
    console.error("Error saving chat history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete chat history for a specific market
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const marketKey = searchParams.get("marketKey");

    if (!marketKey) {
      return NextResponse.json(
        { error: "marketKey is required" },
        { status: 400 }
      );
    }

    await prisma.chatHistory.deleteMany({
      where: {
        userId: session.user.id,
        marketKey,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting chat history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
