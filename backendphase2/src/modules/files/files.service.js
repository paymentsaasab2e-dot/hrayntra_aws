/**
 * Generic files service – stores and retrieves files for any entity (job, lead, client, etc.).
 * Delegates to entity-specific services so the same API can be used across pages.
 */
import { jobFileService } from '../job/job-file.service.js';
import { leadFileService } from '../lead/lead-file.service.js';
import { clientFileService } from '../client/client-file.service.js';
import { candidateFileService } from '../candidate/candidate-file.service.js';
import { interviewFileService } from '../interview/interview-file.service.js';

const SUPPORTED_ENTITY_TYPES = ['job', 'lead', 'client', 'candidate', 'interview'];

export const filesService = {
  /**
   * Get all files for an entity.
   * @param {string} entityType - 'job' | 'lead' | 'client'
   * @param {string} entityId - ID of the job, lead, or client
   */
  async getByEntity(entityType, entityId) {
    if (!entityType || !entityId) {
      throw new Error('entityType and entityId are required');
    }
    if (!SUPPORTED_ENTITY_TYPES.includes(entityType)) {
      throw new Error(`Unsupported entityType: ${entityType}. Supported: ${SUPPORTED_ENTITY_TYPES.join(', ')}`);
    }
    if (entityType === 'job') {
      return jobFileService.getAll(entityId);
    }
    if (entityType === 'lead') {
      return leadFileService.getAll(entityId);
    }
    if (entityType === 'client') {
      return clientFileService.getAll(entityId);
    }
    if (entityType === 'candidate') {
      return candidateFileService.getAll(entityId);
    }
    if (entityType === 'interview') {
      return interviewFileService.getAll(entityId);
    }
    return [];
  },

  /**
   * Create a file record and associate with an entity.
   * File is already stored on disk by the controller; this only creates the DB record.
   */
  async create(entityType, entityId, fileData, uploadedById) {
    if (!entityType || !entityId) {
      throw new Error('entityType and entityId are required');
    }
    if (!SUPPORTED_ENTITY_TYPES.includes(entityType)) {
      throw new Error(`Unsupported entityType: ${entityType}. Supported: ${SUPPORTED_ENTITY_TYPES.join(', ')}`);
    }
    if (entityType === 'job') {
      return jobFileService.create(entityId, fileData, uploadedById);
    }
    if (entityType === 'lead') {
      return leadFileService.create(entityId, fileData, uploadedById);
    }
    if (entityType === 'client') {
      return clientFileService.create(entityId, fileData, uploadedById);
    }
    if (entityType === 'candidate') {
      return candidateFileService.create(entityId, fileData, uploadedById);
    }
    if (entityType === 'interview') {
      return interviewFileService.create(entityId, fileData, uploadedById);
    }
    throw new Error(`Create not implemented for entityType: ${entityType}`);
  },

  /**
   * Delete a file by ID. Entity type used for future authorization or cleanup.
   */
  async delete(entityType, fileId) {
    if (!fileId) {
      throw new Error('fileId is required');
    }
    if (entityType === 'job') {
      return jobFileService.delete(fileId);
    }
    if (entityType === 'lead') {
      return leadFileService.delete(fileId);
    }
    if (entityType === 'client') {
      return clientFileService.delete(fileId);
    }
    if (entityType === 'candidate') {
      return candidateFileService.delete(fileId);
    }
    if (entityType === 'interview') {
      return interviewFileService.delete(fileId);
    }
    throw new Error(`Delete not implemented for entityType: ${entityType}`);
  },
};
