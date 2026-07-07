import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { checkOpdscanLabUpdatedToday } from "@/lib/opdscan/access";

type SuccessResponse = {
  success: true;
  hasTodayLabFiles: boolean;
  labFolderName: string | null;
  todayFileCount: number;
};

type ErrorResponse = {
  success: false;
  message: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const hnValue = typeof req.query.hn === "string" ? req.query.hn.trim() : "";

  if (!hnValue) {
    return res.status(400).json({ success: false, message: "กรุณาระบุ HN" });
  }

  try {
    const result = await checkOpdscanLabUpdatedToday(hnValue);

    return res.status(200).json({
      success: true,
      hasTodayLabFiles: result.hasTodayLabFiles,
      labFolderName: result.labFolderName,
      todayFileCount: result.todayFileCount,
    });
  } catch (error) {
    return respondError(res, "ตรวจสอบไฟล์ lab วันนี้ไม่สำเร็จ", error);
  }
}
