import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Project from '@/models/Project';
import User from '@/models/User';
import Notification from '@/models/Notification';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { recordActivity } from '@/lib/activities';

// Accept or reject a join request
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, action } = body;

    if (!userId || !action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'userId and action (accept/reject) are required' },
        { status: 400 }
      );
    }

    const project = await Project.findById(params.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Only owner can accept/reject requests
    if (project.owner.toString() !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the owner can manage join requests' },
        { status: 403 }
      );
    }

    const userIdStr = userId as string;

    // Check if request exists
    if (!project.pendingRequests.some((m: any) => m.toString() === userIdStr)) {
      return NextResponse.json(
        { error: 'No pending request from this user' },
        { status: 400 }
      );
    }

    // Remove from pending requests
    project.pendingRequests = project.pendingRequests.filter(
      (m: any) => m.toString() !== userIdStr
    );

    try {
      if (action === 'accept') {
        // Add to members
        project.members.push(userIdStr as any);
        await project.save();

        // Add project to user's joined projects
        await User.findByIdAndUpdate(userIdStr, {
          $push: { projectsJoined: project._id },
        });

        // Notify the accepted user
        await Notification.create({
          user: userIdStr,
          type: 'request_accepted',
          message: `You were accepted into "${project.name}"`,
          projectId: project._id,
          fromUser: session.user.id,
        });

        // Record team membership in the evidence timeline
        const joinedUser = await User.findById(userIdStr).select('name');
        await recordActivity({
          project: project._id.toString(),
          user: userIdStr,
          activityType: 'member_joined',
          message: `${joinedUser?.name || 'A developer'} joined the project`,
        });

        return NextResponse.json({ success: true, message: 'User added to project' });
      } else {
        await project.save();

        // Notify the rejected user
        await Notification.create({
          user: userIdStr,
          type: 'request_rejected',
          message: `Your request to join "${project.name}" was rejected`,
          projectId: project._id,
          fromUser: session.user.id,
        });

        return NextResponse.json({ success: true, message: 'Join request rejected' });
      }
    } catch (saveError: any) {
      // Handle version conflict - retry once
      if (saveError.name === 'VersionError') {
        const fresh = await Project.findById(params.id);
        if (fresh) {
          fresh.pendingRequests = fresh.pendingRequests.filter((m: any) => m.toString() !== userIdStr);
          if (action === 'accept') {
            fresh.members.push(userIdStr as any);
            await fresh.save();
            await User.findByIdAndUpdate(userIdStr, {
              $push: { projectsJoined: fresh._id },
            });

            await Notification.create({
              user: userIdStr,
              type: 'request_accepted',
              message: `You were accepted into "${fresh.name}"`,
              projectId: fresh._id,
              fromUser: session.user.id,
            });

            return NextResponse.json({ success: true, message: 'User added to project' });
          }
          await fresh.save();

          await Notification.create({
            user: userIdStr,
            type: 'request_rejected',
            message: `Your request to join "${fresh.name}" was rejected`,
            projectId: fresh._id,
            fromUser: session.user.id,
          });

          return NextResponse.json({ success: true, message: 'Join request rejected' });
        }
      }
      throw saveError;
    }
  } catch (error) {
    console.error('Manage request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}