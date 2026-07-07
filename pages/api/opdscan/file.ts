import type { NextApiRequest, NextApiResponse } from "next";

import { createReadStream } from "node:fs";

import { respondError } from "@/lib/api/respond";
import { guessContentType, resolveOpdscanFilePath } from "@/lib/opdscan/access";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const hnValue = typeof req.query.hn === "string" ? req.query.hn.trim() : "";
  const fileName = typeof req.query.name === "string" ? req.query.name.trim() : "";

  if (!hnValue || !fileName) {
    return res.status(400).json({ success: false, message: "กรุณาระบุ hn และ name" });
  }

  try {
    const { filePath } = await resolveOpdscanFilePath(hnValue, fileName);
    const contentType = guessContentType(fileName);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`);

    const stream = createReadStream(filePath);

    stream.on("error", (error) => {
      if (!res.headersSent) {
        respondError(res, "อ่านไฟล์สแกนไม่สำเร็จ", error);
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  } catch (error) {
    return respondError(res, "เปิดไฟล์สแกนไม่สำเร็จ", error);
  }
}
