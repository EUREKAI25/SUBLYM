// SUBLYM Backend - Legal Document Routes (Public)

import { Hono } from 'hono';
import * as fs from 'fs/promises';
import * as path from 'path';
import { prisma } from '../db';
import { NotFoundError } from '../middleware/error-handler';

const app = new Hono();

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';

// ============================================
// GET /legal/:type - Document metadata
// ============================================

app.get('/:type', async (c) => {
  const type = c.req.param('type');

  const document = await prisma.legalDocument.findFirst({
    where: { type, isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!document) {
    throw new NotFoundError('Legal document');
  }

  return c.json({
    type: document.type,
    version: document.version,
    filename: document.filename,
    createdAt: document.createdAt,
    downloadUrl: `/api/v1/legal/${type}/download`,
  });
});

// ============================================
// GET /legal/:type/download - Download PDF
// ============================================

app.get('/:type/download', async (c) => {
  const type = c.req.param('type');

  const document = await prisma.legalDocument.findFirst({
    where: { type, isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!document) {
    throw new NotFoundError('Legal document');
  }

  const filePath = path.join(STORAGE_PATH, document.filepath);

  try {
    const fileBuffer = await fs.readFile(filePath);
    c.header('Content-Type', document.mimeType || 'application/pdf');
    c.header('Content-Disposition', `inline; filename="${document.filename}"`);
    return c.body(fileBuffer);
  } catch {
    throw new NotFoundError('Legal document file');
  }
});

export { app as legalRoutes };
