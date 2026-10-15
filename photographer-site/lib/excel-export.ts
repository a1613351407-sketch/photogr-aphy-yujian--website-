import { STYLES, type Answers } from '@/lib/options';

export type WorkbookSurvey = {
  id: string;
  name: string;
  contact: string;
  created_at: string;
  status: string;
  payload: Answers;
  photos: { id: string; name: string }[];
};

export type WorkbookExportResult = {
  records: number;
  images: number;
  failedImages: number;
};

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function styleSummary(survey: WorkbookSurvey) {
  return [
    ...STYLES.filter((style) => survey.payload.styles.includes(style.id)).map(
      (style) => style.name,
    ),
    ...(survey.payload.customStyle ? [survey.payload.customStyle] : []),
    ...(survey.payload.undecided ? ['一起商量'] : []),
  ].join('、');
}

function downloadWorkbook(buffer: ArrayBuffer, filename: string) {
  const url = URL.createObjectURL(new Blob([buffer], { type: XLSX_MIME }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
}

async function imageSize(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function webpToPng(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法处理 WebP 图片。');
    context.drawImage(bitmap, 0, 0, width, height);
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error('WebP 图片转换失败。')),
        'image/png',
      );
    });
    return { blob: png, width, height };
  } finally {
    bitmap.close();
  }
}

async function fetchWorkbookImage(surveyId: string, photoId: string) {
  const response = await fetch(`/api/studio/photos/${surveyId}/${photoId}`);
  if (!response.ok) throw new Error('参考照片读取失败。');
  const source = await response.blob();
  if (source.type === 'image/webp') {
    const converted = await webpToPng(source);
    return {
      base64: `data:image/png;base64,${arrayBufferToBase64(await converted.blob.arrayBuffer())}`,
      extension: 'png' as const,
      width: converted.width,
      height: converted.height,
    };
  }

  const extension =
    source.type === 'image/png' ? ('png' as const) : ('jpeg' as const);
  const size = await imageSize(source);
  return {
    base64: `data:${source.type || 'image/jpeg'};base64,${arrayBufferToBase64(await source.arrayBuffer())}`,
    extension,
    width: size.width,
    height: size.height,
  };
}

function fitImage(width: number, height: number) {
  const maxWidth = 104;
  const maxHeight = 58;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function fitLargeImage(width: number, height: number) {
  const maxWidth = 720;
  const maxHeight = 520;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function exportSurveysWorkbook(
  surveys: WorkbookSurvey[],
  filename: string,
): Promise<WorkbookExportResult> {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = ExcelJSModule.default ?? ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '玉鉴 PHOTO STUDIO';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet('拍摄沟通单', {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const photoSheet = workbook.addWorksheet('参考照片', {
    views: [{ showGridLines: false }],
  });
  photoSheet.columns = Array.from({ length: 12 }, () => ({ width: 12 }));
  let nextPhotoRow = 1;

  sheet.columns = [
    { header: '编号', key: 'reference', width: 14 },
    { header: '提交时间', key: 'createdAt', width: 21 },
    { header: '客户称呼', key: 'name', width: 16 },
    { header: '联系方式', key: 'contact', width: 22 },
    { header: '状态', key: 'status', width: 11 },
    { header: '风格意向', key: 'styles', width: 24 },
    { header: '拍摄用途', key: 'purpose', width: 18 },
    { header: '场景偏好', key: 'location', width: 18 },
    { header: '修图偏好', key: 'retouch', width: 25 },
    { header: '妆造准备', key: 'makeup', width: 18 },
    { header: '期望日期', key: 'date', width: 14 },
    { header: '预算', key: 'budget', width: 16 },
    { header: '补充想法', key: 'notes', width: 30 },
    { header: '参考说明', key: 'referenceNotes', width: 30 },
    ...Array.from({ length: 6 }, (_, index) => ({
      header: `参考照片 ${index + 1}`,
      key: `photo${index + 1}`,
      width: 18,
    })),
  ];

  const header = sheet.getRow(1);
  header.height = 30;
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF354F43' },
  };
  header.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.autoFilter = { from: 'A1', to: 'T1' };

  let imageCount = 0;
  let failedImages = 0;

  for (const [surveyIndex, survey] of surveys.entries()) {
    const answers = survey.payload;
    const row = sheet.addRow({
      reference: 'YJ-' + survey.id.slice(0, 8).toUpperCase(),
      createdAt: new Date(survey.created_at).toLocaleString('zh-CN'),
      name: survey.name,
      contact: survey.contact,
      status: survey.status === 'contacted' ? '已联系' : '待沟通',
      styles: styleSummary(survey) || '未填写',
      purpose: answers.purpose || '未填写',
      location: answers.location || '未填写',
      retouch: answers.retouch || '未填写',
      makeup: answers.makeup || '未填写',
      date: answers.date || '待沟通',
      budget: answers.budget || '待沟通',
      notes: answers.notes || '未填写',
      referenceNotes: answers.referenceNotes || '未填写',
    });
    row.height = survey.photos.length > 0 ? 86 : 42;
    row.alignment = { vertical: 'middle', wrapText: true };
    if (surveyIndex % 2 === 1) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF4F7F5' },
      };
    }
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFDCE2DE' } },
        right: { style: 'thin', color: { argb: 'FFE8ECE9' } },
      };
    });

    if (survey.photos.length === 0) {
      row.getCell(15).value = '未上传';
      continue;
    }

    for (const [photoIndex, photo] of survey.photos.slice(0, 6).entries()) {
      const photoCell = row.getCell(15 + photoIndex);
      photoCell.value = photo.name;
      photoCell.font = { color: { argb: 'FF738178' }, size: 8 };
      photoCell.alignment = { vertical: 'bottom', horizontal: 'center' };
      try {
        const image = await fetchWorkbookImage(survey.id, photo.id);
        const imageId = workbook.addImage({
          base64: image.base64,
          extension: image.extension,
        });
        const fitted = fitImage(image.width, image.height);
        const large = fitLargeImage(image.width, image.height);
        const photoAnchor = `A${nextPhotoRow}`;
        const mainAnchor = photoCell.address;

        photoSheet.mergeCells(`A${nextPhotoRow}:J${nextPhotoRow}`);
        const photoTitle = photoSheet.getCell(photoAnchor);
        photoTitle.value = `${survey.name} · ${photo.name}`;
        photoTitle.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' },
          size: 12,
        };
        photoTitle.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF354F43' },
        };
        photoTitle.alignment = { vertical: 'middle' };
        photoSheet.getRow(nextPhotoRow).height = 28;

        const backCell = photoSheet.getCell(`A${nextPhotoRow + 1}`);
        backCell.value = {
          text: '返回拍摄沟通单',
          hyperlink: `拍摄沟通单!${mainAnchor}`,
          tooltip: '返回这张照片所在的客户记录',
        };
        backCell.font = {
          color: { argb: 'FF496B57' },
          underline: true,
          size: 10,
        };

        const largeImageTopRow = nextPhotoRow + 1;
        photoSheet.addImage(imageId, {
          tl: { col: 0, row: largeImageTopRow },
          ext: large,
          editAs: 'oneCell',
        });
        const imageRows = Math.ceil(large.height / 20) + 3;
        for (
          let reservedRow = nextPhotoRow + 2;
          reservedRow < nextPhotoRow + imageRows;
          reservedRow += 1
        ) {
          photoSheet.getRow(reservedRow).height = 15;
        }

        const photoLink = `参考照片!${photoAnchor}`;
        photoCell.value = {
          text: `查看大图 →\n${photo.name}`,
          hyperlink: photoLink,
          tooltip: '点击查看大图',
        };
        photoCell.font = {
          color: { argb: 'FF496B57' },
          underline: true,
          size: 8,
        };
        sheet.addImage(imageId, {
          tl: { col: 14 + photoIndex + 0.1, row: row.number - 1 + 0.05 },
          ext: fitted,
          editAs: 'oneCell',
          hyperlinks: {
            hyperlink: `#'参考照片'!${photoAnchor}`,
            tooltip: '点击查看大图',
          },
        });
        nextPhotoRow += imageRows + 2;
        imageCount += 1;
      } catch {
        photoCell.value = `图片读取失败\n${photo.name}`;
        photoCell.font = { color: { argb: 'FFA94031' }, size: 9 };
        failedImages += 1;
      }
    }
  }

  if (imageCount === 0) workbook.removeWorksheet(photoSheet.id);

  const buffer = await workbook.xlsx.writeBuffer();
  downloadWorkbook(buffer as ArrayBuffer, filename);
  return { records: surveys.length, images: imageCount, failedImages };
}
