import { HOSPITAL_LOGO, HOSPITAL_NAME_TH } from "@/config/branding";

export type PatientDrugRepeatPrintRow = {
  DRUG_NAME: string | null;
  DRUG_USAGE: string | null;
  PRSCDTEXT_MEDUSAGE: string | null;
  MEDLBLHLP_NAME: string | null;
  MEDLBLHLP2_NAME: string | null;
  TPUCODE: string | null;
};

export type PatientDrugRepeatPrintPayload = {
  hn: string;
  patientName: string | null;
  pttypeName: string | null;
  drugAllergy?: string | null;
  prscDateIso: string;
  prescriptionNo: string | null;
  doctorName: string | null;
  clinicName: string | null;
  items: PatientDrugRepeatPrintRow[];
  logoUrl?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appendLabelHelpText(
  base: string,
  row: Pick<PatientDrugRepeatPrintRow, "MEDLBLHLP_NAME" | "MEDLBLHLP2_NAME">
): string {
  let text = base;

  for (const part of [row.MEDLBLHLP_NAME, row.MEDLBLHLP2_NAME]) {
    const help = part?.trim();

    if (!help || text.includes(help)) continue;
    text = text ? `${text} ${help}` : help;
  }

  return text;
}

export function formatDrugRepeatUsageText(row: PatientDrugRepeatPrintRow): string {
  const fromPrscdtext = row.PRSCDTEXT_MEDUSAGE?.trim();

  if (fromPrscdtext) return appendLabelHelpText(fromPrscdtext, row);

  return row.DRUG_USAGE?.trim() || "";
}

export function formatDrugRepeatListLine(
  index: number,
  row: PatientDrugRepeatPrintRow
): string {
  const name = row.DRUG_NAME?.trim() || "—";
  const usage = formatDrugRepeatUsageText(row);

  return usage ? `${index}. # ${name} [${usage}]` : `${index}. # ${name}`;
}

export function formatPrescriptionNo(
  prscno: string | number | null | undefined,
  prscDateIso: string
): string {
  if (prscno == null || String(prscno).trim() === "") return "—";

  const year = Number(prscDateIso.slice(0, 4));

  if (!Number.isFinite(year)) return String(prscno);

  const suffix = String(year + 543).slice(-2);

  return `${prscno}/${suffix}`;
}

export function isoToThaiSlashDate(iso: string): string {
  const [yearStr, monthStr, dayStr] = iso.split("-");
  const year = Number(yearStr);

  if (!year || !monthStr || !dayStr) return "";

  return `${dayStr}/${monthStr}/${year + 543}`;
}

function resolveDrugRepeatDensity(itemCount: number, preview = false): string {
  if (preview) {
    if (itemCount > 20) return "density-compact";
    if (itemCount > 14) return "density-snug";

    return "density-comfortable";
  }

  if (itemCount > 14) return "density-dense";
  if (itemCount > 10) return "density-compact";
  if (itemCount > 7) return "density-snug";

  return "density-comfortable";
}

export type BuildPatientDrugRepeatHtmlOptions = {
  autoPrint?: boolean;
  preview?: boolean;
};

export function buildPatientDrugRepeatPrintHtml(
  payload: PatientDrugRepeatPrintPayload,
  options?: BuildPatientDrugRepeatHtmlOptions
): string {
  const autoPrint = options?.autoPrint ?? false;
  const preview = options?.preview ?? false;
  const today = isoToThaiSlashDate(new Date().toISOString().slice(0, 10));
  const visitDate = isoToThaiSlashDate(payload.prscDateIso);
  const logoSrc = payload.logoUrl ?? HOSPITAL_LOGO;
  const allergy = payload.drugAllergy?.trim() || "NDA(NO DRUG ALLERGY)";
  const densityClass = resolveDrugRepeatDensity(payload.items.length, preview);

  const rowsHtml = payload.items
    .map((row, index) => {
      const listLine = formatDrugRepeatListLine(index + 1, row);
      const tpu = row.TPUCODE?.trim() || "";

      return `<tr>
        <td class="drug-col">${escapeHtml(listLine)}</td>
        <td class="tpu-col">${escapeHtml(tpu)}</td>
        <td class="qty-col">&nbsp;</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>ใบรายการยาเดิมของผู้ป่วย</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Sarabun", "TH Sarabun New", Tahoma, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #0f172a;
      margin: 0;
      padding: 0;
      background: #fff;
      -webkit-font-smoothing: antialiased;
    }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      display: flex;
      flex-direction: column;
      padding: 10mm 12mm 11mm;
    }
    ${
      preview
        ? `
    html, body.preview-doc {
      width: 100%;
      overflow-x: hidden;
    }
    body.preview-doc {
      min-height: 100%;
      margin: 0;
      padding: 0;
      background: #fff;
      font-size: 16px;
      line-height: 1.55;
    }
    body.preview-doc .sheet {
      width: 210mm;
      max-width: 100%;
      min-height: 0;
      margin: 0 auto;
      padding: 12mm 14mm 13mm;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      box-shadow: 0 8px 30px rgba(15, 23, 42, 0.1);
    }
    body.preview-doc .meta {
      white-space: normal;
      font-size: 13px;
    }
    body.preview-doc .title {
      font-size: 22px;
    }
    body.preview-doc .title-sub {
      font-size: 16px;
    }
    body.preview-doc .patient {
      font-size: 15px;
      padding: 9px 12px;
    }
    body.preview-doc table {
      font-size: 15px;
    }
    body.preview-doc th {
      font-size: 13px;
      padding: 7px 9px;
    }
    body.preview-doc th,
    body.preview-doc td {
      padding: 7px 9px;
      line-height: 1.5;
    }
    body.preview-doc .qty-col {
      min-height: 28px;
    }
    body.preview-doc .footer {
      font-size: 13px;
    }
    body.preview-doc .note {
      font-size: 12px;
      line-height: 1.45;
    }
    @media print {
      body.preview-doc {
        padding: 0;
        background: #fff;
      }
      .sheet {
        width: auto;
        min-height: auto;
        margin: 0;
        border: none;
        border-radius: 0;
        box-shadow: none;
      }
    }`
        : ""
    }
    .header {
      display: grid;
      grid-template-columns: 64px 1fr auto;
      gap: 10px;
      align-items: start;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 2px solid #0f172a;
      flex-shrink: 0;
    }
    .logo {
      width: 58px;
      height: 58px;
      object-fit: contain;
    }
    .title {
      text-align: center;
      font-size: 18px;
      font-weight: 700;
      line-height: 1.35;
      letter-spacing: 0.01em;
    }
    .title-sub {
      display: block;
      margin-top: 1px;
      font-size: 14px;
      font-weight: 600;
      color: #334155;
    }
    .meta {
      text-align: right;
      font-size: 12px;
      line-height: 1.5;
      white-space: nowrap;
      color: #334155;
    }
    .meta strong {
      color: #0f172a;
      font-weight: 600;
    }
    .patient {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 20px;
      font-size: 13px;
      margin: 0 0 8px;
      padding: 7px 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      flex-shrink: 0;
    }
  ${
    preview
      ? `@media print {
    .patient {
      background: transparent;
      border-color: #000;
      border-radius: 0;
    }
  }`
      : ""
  }
    .patient div { line-height: 1.45; }
    .patient strong {
      display: inline-block;
      min-width: 6rem;
      color: #475569;
      font-weight: 600;
    }
    .table-wrap {
      flex: 1 1 auto;
      min-height: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid ${preview ? "#94a3b8" : "#000"};
      padding: 5px 7px;
      vertical-align: top;
      line-height: 1.45;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }
  ${
    preview
      ? `@media print {
    th, td { border-color: #000; }
  }`
      : ""
  }
    th {
      text-align: center;
      font-weight: 700;
      background: #f1f5f9;
      font-size: 12px;
      letter-spacing: 0.02em;
    }
  ${
    preview
      ? `@media print {
    th { background: #f8f8f8; }
  }`
      : ""
  }
    .drug-col { width: 70%; }
    .tpu-col { width: 15%; text-align: center; }
    .qty-col { width: 15%; min-height: 22px; }
    tbody tr:nth-child(even) td {
      background: ${preview ? "#fafbfc" : "transparent"};
    }
  ${
    preview
      ? `@media print {
    tbody tr:nth-child(even) td { background: transparent; }
  }`
      : ""
  }
    .footer {
      margin-top: auto;
      padding-top: 8px;
      border-top: 1px solid ${preview ? "#cbd5e1" : "#000"};
      font-size: 12px;
      line-height: 1.5;
      flex-shrink: 0;
    }
  ${
    preview
      ? `@media print {
    .footer { border-top-color: #000; }
  }`
      : ""
  }
    .note {
      margin-top: 6px;
      padding: 6px 8px;
      font-size: 11px;
      line-height: 1.45;
      color: #475569;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 3px;
    }
  ${
    preview
      ? `@media print {
    .note {
      background: transparent;
      border-color: #000;
      border-radius: 0;
      color: #000;
    }
  }`
      : ""
  }
    .density-snug .header { gap: 8px; margin-bottom: 6px; padding-bottom: 6px; }
    .density-snug .logo { width: 50px; height: 50px; }
    .density-snug .title { font-size: 16px; }
    .density-snug .title-sub { font-size: 13px; }
    .density-snug .meta { font-size: 11px; }
    .density-snug .patient { font-size: 12px; padding: 5px 8px; margin-bottom: 6px; }
    .density-snug table { font-size: 12px; }
    .density-snug th { font-size: 11px; }
    .density-snug th, .density-snug td { padding: 4px 6px; line-height: 1.35; }
    .density-snug .qty-col { min-height: 18px; }
    .density-snug .footer { font-size: 11px; padding-top: 6px; }
    .density-snug .note { font-size: 10px; padding: 5px 6px; margin-top: 4px; }
    .density-compact .header { grid-template-columns: 44px 1fr auto; gap: 6px; margin-bottom: 4px; padding-bottom: 4px; }
    .density-compact .logo { width: 40px; height: 40px; }
    .density-compact .title { font-size: 15px; line-height: 1.25; }
    .density-compact .title-sub { font-size: 12px; }
    .density-compact .meta { font-size: 10px; line-height: 1.35; }
    .density-compact .patient { font-size: 11px; gap: 2px 14px; padding: 4px 7px; margin-bottom: 4px; }
    .density-compact .patient strong { min-width: 5rem; }
    .density-compact table { font-size: 11px; }
    .density-compact th { font-size: 10px; }
    .density-compact th, .density-compact td { padding: 3px 5px; line-height: 1.3; }
    .density-compact .qty-col { min-height: 16px; }
    .density-compact .footer { font-size: 10px; padding-top: 4px; }
    .density-compact .note { font-size: 9px; padding: 4px 5px; margin-top: 3px; line-height: 1.35; }
    .density-dense .sheet { padding: 8mm 10mm 9mm; }
    .density-dense .header { grid-template-columns: 36px 1fr auto; gap: 5px; margin-bottom: 3px; padding-bottom: 3px; border-bottom-width: 1px; }
    .density-dense .logo { width: 32px; height: 32px; }
    .density-dense .title { font-size: 13px; line-height: 1.2; }
    .density-dense .title-sub { font-size: 11px; }
    .density-dense .meta { font-size: 9px; line-height: 1.3; }
    .density-dense .patient { font-size: 10px; gap: 1px 10px; padding: 3px 6px; margin-bottom: 3px; }
    .density-dense .patient strong { min-width: 4.5rem; }
    .density-dense table { font-size: 10px; }
    .density-dense th { font-size: 9px; }
    .density-dense th, .density-dense td { padding: 2px 4px; line-height: 1.25; }
    .density-dense .qty-col { min-height: 14px; }
    .density-dense .footer { font-size: 9px; padding-top: 3px; }
    .density-dense .note { font-size: 8px; padding: 3px 4px; margin-top: 2px; line-height: 1.3; }
    .density-comfortable .title { font-size: 19px; }
    .density-comfortable table { font-size: 14px; }
    .density-comfortable th, .density-comfortable td { padding: 6px 8px; line-height: 1.5; }
    .density-comfortable .qty-col { min-height: 26px; }
    @media print {
      .sheet {
        width: auto;
        min-height: auto;
        padding: 0;
        display: block;
      }
      .table-wrap {
        flex: none;
      }
    }
  </style>
</head>
<body${preview ? ' class="preview-doc"' : ""}>
  <div class="sheet ${densityClass}">
  <div class="header">
    <img class="logo" src="${escapeHtml(logoSrc)}" alt="" />
    <div class="title">
      ใบรายการยาเดิมของผู้ป่วย
      <span class="title-sub">${escapeHtml(HOSPITAL_NAME_TH)}</span>
    </div>
    <div class="meta">
      <div>หน้าที่ <strong>1/1</strong></div>
      <div>วันที่ : <strong>${escapeHtml(today)}</strong></div>
      <div>เลขที่ใบสั่งยา : <strong>${escapeHtml(payload.prescriptionNo ?? "—")}</strong></div>
      <div>วันที่รับบริการ : <strong>${escapeHtml(visitDate)}</strong></div>
    </div>
  </div>
  <div class="patient">
    <div><strong>HN</strong> : ${escapeHtml(payload.hn)}</div>
    <div><strong>ชื่อผู้ป่วย</strong> : ${escapeHtml(payload.patientName ?? "—")}</div>
    <div><strong>สิทธิการรักษา</strong> : ${escapeHtml(payload.pttypeName ?? "—")}</div>
    <div><strong>แพ้ยา</strong> : ${escapeHtml(allergy)}</div>
  </div>
  <div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>รายการยา</th>
        <th>TPU</th>
        <th>จำนวน</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  </div>
  <div class="footer">
    <div><strong>แพทย์ผู้สั่งยา</strong> : ${escapeHtml(payload.doctorName ?? "—")}</div>
    <div><strong>หน่วยงาน</strong> : ${escapeHtml(payload.clinicName ?? "—")}</div>
    <div class="note">
      หมายเหตุ : ให้ผู้ป่วยนับยาคงเหลือเขียนลงในช่องจำนวน และนำใบนี้ให้แพทย์ดูเมื่อมาพบแพทย์ตามนัดครั้งต่อไป
    </div>
  </div>
  </div>
  ${
    autoPrint
      ? `<script>
    window.addEventListener("load", function () {
      window.focus();
      window.print();
    });
  </script>`
      : ""
  }
</body>
</html>`;
}

export function openPatientDrugRepeatPrint(payload: PatientDrugRepeatPrintPayload): void {
  const html = buildPatientDrugRepeatPrintHtml(payload, { autoPrint: true });
  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!printWindow) {
    window.alert("ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาต popup");

    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
