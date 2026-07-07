import type { NextApiRequest, NextApiResponse } from "next";

import { getSessionFromRequest } from "@/lib/auth/getSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const session = getSessionFromRequest(req);

  if (!session) {
    return res.status(200).json({ success: true, authenticated: false, user: null });
  }

  return res.status(200).json({
    success: true,
    authenticated: true,
    user: {
      username: session.username,
      displayName: session.displayName,
      department: session.department,
      isAdmin: Boolean(session.isAdmin),
    },
  });
}
