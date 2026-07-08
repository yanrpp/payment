import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { listOpdscanFiles, OpdscanNotFoundError } from "@/lib/opdscan/access";
import { buildOpdscanUncPath } from "@/lib/opdscan/path";
import { getOpdscanUncRoot } from "@/config/opdscan";

type SuccessResponse = {
  success: true;
  uncPath: string;
  relativePath: string;
  subPath: string;
  count: number;
  files: Array<{
    name: string;
    size: number;
    modified: string | null;
    isDirectory: boolean;
  }>;
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

  const uncRoot = getOpdscanUncRoot();
  const previewPath = buildOpdscanUncPath(hnValue, uncRoot);

  if (!previewPath) {
    return res.status(400).json({
      success: false,
      message: "รูปแบบ HN ไม่ถูกต้อง (ใช้เช่น 19999/99)",
    });
  }

  const subPath = typeof req.query.sub === "string" ? req.query.sub.trim() : "";

  try {
    const result = await listOpdscanFiles(hnValue, subPath);

    return res.status(200).json({
      success: true,
      uncPath: result.uncPath,
      relativePath: result.relativePath,
      subPath: result.subPath,
      count: result.files.length,
      files: result.files,
    });
  } catch (error) {
    if (error instanceof OpdscanNotFoundError) {
      return res.status(404).json({ success: false, message: error.message });
    }

    return respondError(res, "ไม่สามารถเปิดโฟลเดอร์สแกน OPD ได้", error);
  }
}
