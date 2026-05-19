'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  filesApiGet,
  filesApiUpload,
  filesApiDelete,
  type FileEntityType,
  type EntityFile,
} from '../lib/api';
import { useSimulatedProgress } from '../components/import/importDrawerUi';
import { formatDocumentUploadSuccessToast } from '../components/import/documentUploadUi';
import { toast } from 'sonner';

export function useFiles(entityType: FileEntityType, entityId: string | null | undefined) {
  const [files, setFiles] = useState<EntityFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadProgress = useSimulatedProgress(uploading);

  const fetchFiles = useCallback(async () => {
    if (!entityId || !entityType) {
      setFiles([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await filesApiGet(entityType, entityId);
      const list = Array.isArray(res?.data) ? res.data : [];
      setFiles(list);
    } catch (e: any) {
      setError(e?.message || 'Failed to load files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const uploadFile = useCallback(
    async (file: File, fileType: string = 'JD') => {
      if (!entityId || !entityType) return;
      setUploading(true);
      setUploadSuccess(false);
      setError(null);
      uploadProgress.reset();
      try {
        const res = await filesApiUpload(entityType, entityId, file, fileType);
        if (res?.data) {
          setFiles((prev) => [res.data, ...prev]);
        }
        uploadProgress.finish();
        setUploadSuccess(true);
        toast.success(formatDocumentUploadSuccessToast(file.name));
        window.setTimeout(() => setUploadSuccess(false), 2800);
      } catch (e: any) {
        uploadProgress.reset();
        const message = e?.message || 'Upload failed';
        setError(message);
        toast.error(message);
        throw e;
      } finally {
        setUploading(false);
      }
    },
    [entityType, entityId, uploadProgress]
  );

  const deleteFile = useCallback(
    async (fileId: string) => {
      if (!entityId || !entityType) return;
      setError(null);
      try {
        await filesApiDelete(entityType, entityId, fileId);
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      } catch (e: any) {
        setError(e?.message || 'Delete failed');
        throw e;
      }
    },
    [entityType, entityId]
  );

  return {
    files,
    loading,
    uploading,
    uploadSuccess,
    uploadPercent: uploadProgress.percent,
    error,
    refresh: fetchFiles,
    /** @deprecated Use `refresh` instead */
    fetchFiles,
    uploadFile,
    deleteFile,
  };
}
