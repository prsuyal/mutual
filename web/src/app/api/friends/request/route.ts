import { auth } from "@/lib/auth"
import { PrismaClient } from "@prisma/client"
import { headers } from "next/headers"

const prisma = new PrismaClient()

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { receiverHandle } = await req.json()

    const receiver = await prisma.user.findUnique({
      where: { handle: receiverHandle },
    })

    if (!receiver) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    if (receiver.id === session.user.id) {
      return Response.json({ error: 'Cannot send friend request to yourself' }, { status: 400 })
    }

    // Check if already friends
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: session.user.id, friendId: receiver.id },
          { userId: receiver.id, friendId: session.user.id },
        ],
      },
    })

    if (existingFriendship) {
      return Response.json({ error: 'Already friends' }, { status: 400 })
    }

    // Check if request already exists
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: session.user.id, receiverId: receiver.id },
          { senderId: receiver.id, receiverId: session.user.id },
        ],
      },
    })

    if (existingRequest) {
      return Response.json({ error: 'Friend request already exists' }, { status: 400 })
    }

    const friendRequest = await prisma.friendRequest.create({
      data: {
        senderId: session.user.id,
        receiverId: receiver.id,
      },
      include: {
        receiver: {
          select: { id: true, handle: true, name: true, image: true },
        },
      },
    })

    return Response.json({ success: true, friendRequest })
  } catch (error) {
    console.error('Send friend request error:', error)
    return Response.json({ error: 'Failed to send friend request' }, { status: 500 })
  }
}