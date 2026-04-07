import { jobService } from './job.service.js';
import { jobNoteService } from './job-note.service.js';
import { jobFileService } from './job-file.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const jobController = {
  async getPublicFeed(req, res) {
    try {
      const result = await jobService.getPublicFeed(req);
      sendResponse(res, 200, 'Public jobs feed retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getAll(req, res) {
    try {
      const result = await jobService.getAll(req);
      sendResponse(res, 200, 'Jobs retrieved successfully', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getById(req, res) {
    try {
      const job = await jobService.getById(req.params.id);
      if (!job) {
        return sendError(res, 404, 'Job not found');
      }
      sendResponse(res, 200, 'Job retrieved successfully', job);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const job = await jobService.create(req.body, req.user?.id);
      sendResponse(res, 201, 'Job created successfully', job);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async update(req, res) {
    try {
      const job = await jobService.update(req.params.id, {
        ...req.body,
        performedById: req.user?.id,
      });
      sendResponse(res, 200, 'Job updated successfully', job);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async delete(req, res) {
    try {
      const result = await jobService.delete(req.params.id, req.user?.id);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async getMetrics(req, res) {
    try {
      const metrics = await jobService.getMetrics(req);
      sendResponse(res, 200, 'Job metrics retrieved successfully', metrics);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  // Notes endpoints
  async getNotes(req, res) {
    try {
      const notes = await jobNoteService.getAll(req.params.jobId);
      sendResponse(res, 200, 'Notes retrieved successfully', notes);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async createNote(req, res) {
    try {
      const note = await jobNoteService.create(
        req.params.jobId,
        req.body,
        req.user.id
      );
      sendResponse(res, 201, 'Note created successfully', note);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async updateNote(req, res) {
    try {
      const note = await jobNoteService.update(req.params.noteId, req.body);
      sendResponse(res, 200, 'Note updated successfully', note);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async deleteNote(req, res) {
    try {
      const result = await jobNoteService.delete(req.params.noteId);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  // Files endpoints
  async getFiles(req, res) {
    try {
      const files = await jobFileService.getAll(req.params.jobId);
      sendResponse(res, 200, 'Files retrieved successfully', files);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async createFile(req, res) {
    try {
      if (!req.file) {
        return sendError(res, 400, 'No file uploaded');
      }

      // Get file info from multer
      const fileUrl = `/uploads/jobs/${req.params.jobId}/${req.file.filename}`;
      const fileType = req.body.fileType || 'JD'; // Default to JD (Job Description)
      
      const fileData = {
        fileName: req.file.originalname,
        fileUrl: fileUrl,
        fileType: fileType,
      };

      const file = await jobFileService.create(
        req.params.jobId,
        fileData,
        req.user.id
      );
      sendResponse(res, 201, 'File uploaded successfully', file);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },

  async deleteFile(req, res) {
    try {
      const result = await jobFileService.delete(req.params.fileId);
      sendResponse(res, 200, result.message);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
