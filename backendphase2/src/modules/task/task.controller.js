import { taskService } from './task.service.js';
import { taskFileService } from './task-file.service.js';
import { sendResponse, sendError } from '../../utils/response.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
      const task = await taskService.getById(req.params.id);
      if (!task) {
        return sendError(res, 404, 'Task not found');
      }
      sendResponse(res, 200, 'Task retrieved successfully', task);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const task = await taskService.create({
        ...req.body,
        createdById: req.user.id,
      });
      sendResponse(res, 201, 'Task created successfully', task);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const task = await taskService.update(req.params.id, req.body);
      sendResponse(res, 200, 'Task updated successfully', task);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async delete(req, res) {
    try {
      const result = await taskService.delete(req.params.id);
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
      const task = await taskService.addNote(req.params.id, note);
      sendResponse(res, 200, 'Note added successfully', task);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async getAttachment(req, res) {
    try {
      const { taskId, filename } = req.params;
      const task = await taskService.getById(taskId);
      
      if (!task) {
        return sendError(res, 404, 'Task not found');
      }

      // Decode filename
      const decodedFilename = decodeURIComponent(filename);

      // First, check TaskFile model (new approach)
      const taskFile = task.files?.find(file => 
        file.fileName === decodedFilename || 
        file.fileUrl.includes(decodedFilename) ||
        decodedFilename.includes(file.fileName) ||
        file.fileUrl.endsWith(decodedFilename)
      );

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
      const attachmentExists = task.attachments && task.attachments.some(att => 
        att === decodedFilename || att.includes(decodedFilename) || decodedFilename.includes(att)
      );
      
      if (!attachmentExists) {
        return sendError(res, 404, 'Attachment not found');
      }

      // Find the matching attachment
      const attachment = task.attachments.find(att => 
        att === decodedFilename || att.includes(decodedFilename) || decodedFilename.includes(att)
      );

      // If attachment is a URL, redirect to it
      if (attachment && (attachment.startsWith('http://') || attachment.startsWith('https://'))) {
        return res.redirect(attachment);
      }

      // Check if this is an image request (for preview)
      const isImageRequest = req.headers.accept && req.headers.accept.includes('image/');
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
      const isImageFile = imageExtensions.some(ext => decodedFilename.toLowerCase().endsWith(ext));

      // Try to serve file from local storage
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
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
      const task = await taskService.getById(taskId);
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
      const task = await taskService.getById(taskId);
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
      const task = await taskService.update(req.params.id, { status: 'DONE' });
      sendResponse(res, 200, 'Task marked as completed', task);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
