import { NextResponse } from 'next/server';
import { handleUpload } from '@vercel/blob/client';

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json();

  const response = await handleUpload({
    request,
    body,
    token: process.env.BLOB_READ_WRITE_TOKEN,
    onBeforeGenerateToken: async (pathname) => {
      return {
        allowedContentTypes: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'application/zip',
        ],
        maximumSizeInBytes: 50 * 1024 * 1024,
        tokenPayload: pathname,
      };
    },
    onUploadCompleted: async () => {
      return;
    },
  });

  return NextResponse.json(response);
}
