import { taskService } from './task.service.js';
import { getEntityActivities, ENTITY_TYPES } from '../../services/activityService.js';
import { taskFileService } from './task-file.service.js';
import { sendResponse, sendError } from '../../utils/response.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeAttachmentToken(value) {
  return decodeURIComponent(String(value || ''))
    .replace(/\+/g, ' ')
    .trim()
    .toLowerCase();
}

function matchTaskAttachment(task, decodedFilename) {
  const target = normalizeAttachmentToken(decodedFilename);
  const taskFiles = Array.isArray(task?.files) ? task.files : [];
  const legacyAttachments = Array.isArray(task?.attachments) ? task.attachments : [];

  for (const file of taskFiles) {
    const candidates = [
      file?.fileName,
      file?.fileUrl,
      file?.fileUrl ? path.basename(String(file.fileUrl)) : '',
      file?.fileUrl?.startsWith('http://') || file?.fileUrl?.startsWith('https://')
        ? (() => {
            try {
              return path.basename(new URL(String(file.fileUrl)).pathname);
            } catch {
              return '';
            }
          })()
        : '',
    ].filter(Boolean);

    if (candidates.some((candidate) => {
      const normalized = normalizeAttachmentToken(candidate);
      return (
        normalized === target ||
        normalized.includes(target) ||
        target.includes(normalized)
      );
    })) {
      return file;
    }
  }

  const legacy = legacyAttachments.find((att) => {
    const normalized = normalizeAttachmentToken(typeof att === 'string' ? att : att?.name || att?.url || '');
    return (
      normalized === target ||
      normalized.includes(target) ||
      target.includes(normalized)
    );
  });

  return legacy || null;
}

export const taskController = {
  async getAll(req, res) {
    try {
      const result = await taskService.getAll(req);
      sendResponse(res, 200, 'Tasks retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getById(req, res) {
    try {
      const task = await taskService.getById(req.params.id, req);
      if (!task) {
        return sendError(res, 404, 'Task not found');
      }
      sendResponse(res, 200, 'Task retrieved successfully', task);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getActivities(req, res) {
    try {
      const task = await taskService.getById(req.params.id, req);
      if (!task) {
        return sendError(res, 404, 'Task not found');
      }
      const activities = await getEntityActivities({
        entityType: ENTITY_TYPES.TASK,
        entityId: req.params.id,
      });
      sendResponse(res, 200, 'Task activities retrieved successfully', activities);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getAssignableMembers(req, res) {
    try {
      const members = await taskService.getAssignableMembers(req);
      sendResponse(res, 200, 'Assignable members retrieved successfully', members);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const task = await taskService.create(
        {
          ...req.body,
          createdById: req.user.id,
        },
        req,
      );
      sendResponse(res, 201, 'Task created successfully', task);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const task = await taskService.update(req.params.id, req.body, req);
      sendResponse(res, 200, 'Task updated successfully', task);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async delete(req, res) {
    try {
      const result = await taskService.delete(req.params.id, req);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async addNote(req, res) {
    try {
      const { note } = req.body;
      if (!note) {
        return sendError(res, 400, 'Note is required');
      }
      const task = await taskService.addNote(req.params.id, note, req.user?.id);
      sendResponse(res, 200, 'Note added successfully', task);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getAttachment(req, res) {
    try {
      const { taskId, filename } = req.params;
      const task = await taskService.getById(taskId, req);
      
      if (!task) {
        return sendError(res, 404, 'Task not found');
      }

      // Decode filename
      const decodedFilename = decodeURIComponent(filename);

      // First, check TaskFile model (new approach)
      const taskFile = matchTaskAttachment(task, decodedFilename);

      if (taskFile) {
        // If file URL is external, redirect
        if (taskFile.fileUrl.startsWith('http://') || taskFile.fileUrl.startsWith('https://')) {
          return res.redirect(taskFile.fileUrl);
        }
        
        // Serve local file
        const filePath = path.join(__dirname, '..', '..', '..', taskFile.fileUrl);
        
        if (fs.existsSync(filePath)) {
          const ext = path.extname(decodedFilename).toLowerCase();
          const contentTypeMap = {
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
            '.png': 'image/png', '.gif': 'image/gif',
            '.webp': 'image/webp', '.svg': 'image/svg+xml',
            '.bmp': 'image/bmp', '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.txt': 'text/plain', '.csv': 'text/csv',
          };
          const contentType = contentTypeMap[ext] || 'application/octet-stream';
          res.setHeader('Content-Type', contentType);
          
          const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
          const isImageFile = imageExtensions.includes(ext);
          if (isImageFile) {
            res.setHeader('Content-Disposition', `inline; filename="${taskFile.fileName}"`);
          } else {
            res.setHeader('Content-Disposition', `attachment; filename="${taskFile.fileName}"`);
          }
          
          const fileStream = fs.createReadStream(filePath);
          fileStream.pipe(res);
          return;
        }
      }

      // Fallback: Check legacy attachments array (for backward compatibility)
      const attachmentExists = !!matchTaskAttachment(task, decodedFilename);
      
      if (!attachmentExists) {
        return sendError(res, 404, 'Attachment not found');
      }

      // Find the matching attachment
      const attachment = task.attachments.find(att => {
        const normalized = normalizeAttachmentToken(typeof att === 'string' ? att : att?.name || att?.url || '');
        const target = normalizeAttachmentToken(decodedFilename);
        return normalized === target || normalized.includes(target) || target.includes(normalized);
      });

      // If attachment is a URL, redirect to it
      if (attachment && (attachment.startsWith('http://') || attachment.startsWith('https://'))) {
        return res.redirect(attachment);
      }

      // Check if this is an image request (for preview)
      const isImageRequest = req.headers.accept && req.headers.accept.includes('image/');
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
      const isImageFile = imageExtensions.some(ext => decodedFilename.toLowerCase().endsWith(ext));

      // Try to serve file from local storage
      const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads', 'tasks', taskId);
      const filePath = path.join(uploadsDir, decodedFilename);

      // Check if file exists locally
      if (fs.existsSync(filePath)) {
        // Determine content type based on file extension
        const ext = path.extname(decodedFilename).toLowerCase();
        const contentTypeMap = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          '.bmp': 'image/bmp',
          '.pdf': 'application/pdf',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.txt': 'text/plain',
          '.csv': 'text/csv',
        };
        const contentType = contentTypeMap[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        
        // For images, allow inline display; for others, force download
        if (isImageFile) {
          res.setHeader('Content-Disposition', `inline; filename="${decodedFilename}"`);
        } else {
          res.setHeader('Content-Disposition', `attachment; filename="${decodedFilename}"`);
        }
        
        // Stream the file
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
        return;
      }

      // File doesn't exist locally - if it's a URL, we already handled it above
      // Otherwise, return error or JSON with attachment info
      if (isImageRequest || isImageFile) {
        // Try to determine content type
        let contentType = 'application/octet-stream';
        if (decodedFilename.toLowerCase().endsWith('.jpg') || decodedFilename.toLowerCase().endsWith('.jpeg')) {
          contentType = 'image/jpeg';
        } else if (decodedFilename.toLowerCase().endsWith('.png')) {
          contentType = 'image/png';
        } else if (decodedFilename.toLowerCase().endsWith('.gif')) {
          contentType = 'image/gif';
        } else if (decodedFilename.toLowerCase().endsWith('.webp')) {
          contentType = 'image/webp';
        } else if (decodedFilename.toLowerCase().endsWith('.svg')) {
          contentType = 'image/svg+xml';
        }

        // Return JSON response indicating file not found locally
        res.setHeader('Content-Type', 'application/json');
        return sendResponse(res, 404, 'Attachment file not found on server', {
          filename: decodedFilename,
          taskId,
          attachment,
          contentType,
          isImage: true,
          message: 'File not found in local storage. If this is a URL-based attachment, it should have been redirected.',
        });
      }

      // For non-image files, return download info
      res.setHeader('Content-Type', 'application/json');
      return sendResponse(res, 404, 'Attachment file not found on server', {
        filename: decodedFilename,
        taskId,
        attachment,
        message: 'File not found in local storage',
      });
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getAttachmentPreview(req, res) {
    try {
      const { taskId, filename } = req.params;
      console.log('[task.getAttachmentPreview] start', { taskId, filename });
      const task = await taskService.getById(taskId, req);

      if (!task) {
        return sendError(res, 404, 'Task not found');
      }

      const decodedFilename = decodeURIComponent(filename);
      const ext = path.extname(decodedFilename).toLowerCase();
      const taskFile = matchTaskAttachment(task, decodedFilename);

      console.log('[task.getAttachmentPreview] matched file', taskFile ? {
        fileName: taskFile.fileName,
        fileUrl: taskFile.fileUrl,
      } : null);

      if (!taskFile) {
        return sendError(res, 404, 'Attachment not found');
      }

      let filePath = null;
      if (taskFile.fileUrl.startsWith('http://') || taskFile.fileUrl.startsWith('https://')) {
        const parsed = new URL(taskFile.fileUrl);
        if (parsed.pathname.startsWith('/uploads/')) {
          filePath = path.join(__dirname, '..', '..', '..', parsed.pathname);
      }
      } else {
        filePath = path.join(__dirname, '..', '..', '..', taskFile.fileUrl);
      }

      console.log('[task.getAttachmentPreview] resolved path', filePath);

      if (!filePath || !fs.existsSync(filePath)) {
        console.log('[task.getAttachmentPreview] file missing on disk', { filePath });
        return sendError(res, 404, 'Attachment file not found on server');
      }

      if (ext === '.pdf') {
        console.log('[task.getAttachmentPreview] pdf preview direct stream');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${decodedFilename}"`);
        return fs.createReadStream(filePath).pipe(res);
      }

      const safeTitle = decodedFilename.replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[ch]));
      let previewBody = '<p class="empty">No preview data could be extracted from this document.</p>';

      try {
        if (ext === '.docx' || ext === '.doc') {
          const mammothModule = await import('mammoth');
          const mammoth = mammothModule.default || mammothModule;
          const result = await mammoth.extractRawText({ path: filePath });
          const text = (result?.value || '').trim();
          const lines = text ? text.split(/\n+/).map(line => line.trim()).filter(Boolean) : [];
          console.log('[task.getAttachmentPreview] doc preview lines', lines.length);
          previewBody = lines.length
            ? lines.map(line => `<p class="line">${line.replace(/[&<>"']/g, (ch) => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
              }[ch]))}</p>`).join('')
            : '<p class="empty">No text could be extracted from this document.</p>';
        } else if (ext === '.xlsx' || ext === '.xls') {
          const buffer = fs.readFileSync(filePath);
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false, raw: false }) : [];
          const previewRows = Array.isArray(rows) ? rows.slice(0, 80) : [];
          console.log('[task.getAttachmentPreview] spreadsheet preview', {
            sheetName,
            rowCount: previewRows.length,
          });
          previewBody = previewRows.length
            ? `<div class="sheet-wrap"><table><tbody>${previewRows.map((row) => {
                const cells = Array.isArray(row) ? row : [row];
                return `<tr>${cells.map((cell) => `<td>${String(cell ?? '').replace(/[&<>"']/g, (ch) => ({
                  '&': '&amp;',
                  '<': '&lt;',
                  '>': '&gt;',
                  '"': '&quot;',
                  "'": '&#39;',
                }[ch]))}</td>`).join('')}</tr>`;
              }).join('')}</tbody></table></div>`
            : '<p class="empty">No rows could be extracted from this spreadsheet.</p>';
        } else {
          console.log('[task.getAttachmentPreview] unsupported preview extension', { ext });
          previewBody = '<p class="empty">Preview unavailable for this file type.</p>';
        }
      } catch (previewError) {
        console.error('[task.getAttachmentPreview] preview generation failed', previewError);
        previewBody = `<p class="empty">Preview generation failed: ${String(previewError?.message || previewError)}</p>`;
      }

      const previewHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; }
      .page { max-width: 920px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); overflow: hidden; }
      .header { padding: 18px 22px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
      .header h1 { margin: 0; font-size: 16px; line-height: 1.4; word-break: break-word; }
      .content { padding: 24px 22px; }
      .line { margin: 0 0 12px; white-space: pre-wrap; line-height: 1.7; font-size: 14px; }
      .empty { color: #64748b; font-size: 14px; }
      .sheet-wrap { max-height: 70vh; overflow: auto; border: 1px solid #e2e8f0; border-radius: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      td { border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top; }
      tr:first-child td { background: #f8fafc; font-weight: 700; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header"><h1>${safeTitle}</h1></div>
      <div class="content">${previewBody}</div>
    </div>
  </body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="${decodedFilename}"`);
      return res.send(previewHtml);
    } catch (error) {
      console.error('[task.getAttachmentPreview] fatal error', error);
      sendError(res, 500, error.message, error);
    }
  },

  async getFiles(req, res) {
    try {
      const files = await taskFileService.getAll(req.params.taskId);
      sendResponse(res, 200, 'Files retrieved successfully', files);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async uploadFile(req, res) {
    try {
      const { taskId } = req.params;
      
      if (!req.file) {
        return sendError(res, 400, 'No file uploaded');
      }

      // Verify task exists
      const task = await taskService.getById(taskId, req);
      if (!task) {
        // Delete uploaded file if task doesn't exist
        const filePath = req.file.path;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        return sendError(res, 404, 'Task not found');
      }

      // Create file record in database
      const fileUrl = `/uploads/tasks/${taskId}/${req.file.filename}`;
      const file = await taskFileService.create(
        taskId,
        {
          fileName: req.file.originalname,
          fileUrl: fileUrl,
          fileSize: req.file.size,
        },
        req.user.id
      );

      sendResponse(res, 201, 'File uploaded successfully', file);
    } catch (error) {
      // Delete uploaded file on error
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      sendError(res, 500, error.message, error);
    }
  },

  async uploadMultipleFiles(req, res) {
    try {
      const { taskId } = req.params;
      
      if (!req.files || req.files.length === 0) {
        return sendError(res, 400, 'No files uploaded');
      }

      // Verify task exists
      const task = await taskService.getById(taskId, req);
      if (!task) {
        // Delete uploaded files if task doesn't exist
        req.files.forEach(file => {
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
        return sendError(res, 404, 'Task not found');
      }

      // Create file records in database
      const filesData = req.files.map(file => ({
        fileName: file.originalname,
        fileUrl: `/uploads/tasks/${taskId}/${file.filename}`,
        fileSize: file.size,
      }));

      await taskFileService.createMultiple(taskId, filesData, req.user.id);

      // Fetch all created files
      const files = await taskFileService.getAll(taskId);
      sendResponse(res, 201, 'Files uploaded successfully', files);
    } catch (error) {
      // Delete uploaded files on error
      if (req.files) {
        req.files.forEach(file => {
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      sendError(res, 500, error.message, error);
    }
  },

  async deleteFile(req, res) {
    try {
      const result = await taskFileService.delete(req.params.fileId);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getStats(req, res) {
    try {
      // Optional: filter by current user's tasks
      const userId = req.query.userId || req.user?.id || null;
      const stats = await taskService.getStats(userId);
      sendResponse(res, 200, 'Task statistics retrieved successfully', stats);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async markCompleted(req, res) {
    try {
      const result = await taskService.markCompleted(req.params.id, req);
      const message = result.submittedForApproval
        ? 'Task submitted for approval'
        : 'Task marked as completed';
      sendResponse(res, 200, message, result);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async approveCompletion(req, res) {
    try {
      const task = await taskService.approveCompletion(req.params.id, req);
      sendResponse(res, 200, 'Task completion approved', task);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async rejectCompletion(req, res) {
    try {
      const { note } = req.body || {};
      const task = await taskService.rejectCompletion(req.params.id, req, { note });
      sendResponse(res, 200, 'Task completion rejected', task);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
