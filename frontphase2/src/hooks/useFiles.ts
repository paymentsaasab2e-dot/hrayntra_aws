'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { startAsyncLoad } from '../lib/asyncLoadGuard';

function normalizeEntityFile(raw: unknown, fallback?: Partial<EntityFile>): EntityFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id || fallback?.id || '').trim();
  const fileName = String(row.fileName || fallback?.fileName || '').trim();
  if (!id && !fileName) return null;
  const uploadDate =
    String(row.uploadDate || row.createdAt || fallback?.uploadDate || '').trim() ||
    new Date().toISOString();
  return {
    id: id || `pending-${Date.now()}`,
    fileName: fileName || 'Uploaded file',
    fileType: String(row.fileType || fallback?.fileType || 'Other').trim() || 'Other',
    fileUrl: (row.fileUrl as string | null | undefined) ?? fallback?.fileUrl ?? null,
    uploadDate,
    uploadedBy: (row.uploadedBy as EntityFile['uploadedBy']) || fallback?.uploadedBy,
  };
}

export function useFiles(entityType: FileEntityType, entityId: string | null | undefined) {
  const [files, setFiles] = useState<EntityFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadProgress = useSimulatedProgress(uploading);
  const filesRef = useRef(files);
  filesRef.current = files;

  const fetchFiles = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!entityId || !entityType) {
        setFiles([]);
        setLoading(false);
        return;
      }
      const silent = Boolean(options?.silent) && filesRef.current.length > 0;
      const load = silent ? null : startAsyncLoad(setLoading);
      setError(null);
      try {
        const res = await filesApiGet(entityType, entityId);
        if (load && !load.isActive()) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        setFiles(list.map((row) => normalizeEntityFile(row)).filter(Boolean) as EntityFile[]);
      } catch (e: any) {
        if (load && !load.isActive()) return;
        setError(e?.message || 'Failed to load files');
        if (!silent) setFiles([]);
      } finally {
        load?.finish();
      }
    },
    [entityType, entityId]
  );

  useEffect(() => {
    if (!entityId || !entityType) {
      setFiles([]);
      setLoading(false);
      return;
    }
    const load = startAsyncLoad(setLoading);
    setError(null);
    void filesApiGet(entityType, entityId)
      .then((res) => {
        if (!load.isActive()) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        setFiles(list.map((row) => normalizeEntityFile(row)).filter(Boolean) as EntityFile[]);
      })
      .catch((e: any) => {
        if (!load.isActive()) return;
        setError(e?.message || 'Failed to load files');
        setFiles([]);
      })
      .finally(() => {
        load.finish();
      });
    return () => {
      load.abort();
    };
  }, [entityType, entityId]);

  const uploadFile = useCallback(
    async (file: File, fileType: string = 'JD') => {
      if (!entityId || !entityType) return;
      setUploading(true);
      setUploadSuccess(false);
      setError(null);
      uploadProgress.reset();

      const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const pendingRow: EntityFile = {
        id: pendingId,
        fileName: file.name,
        fileType,
        fileUrl: null,
        uploadDate: new Date().toISOString(),
      };
      // Show the row immediately so the Files tab does not wait on S3 + DB round-trip.
      setFiles((prev) => [pendingRow, ...prev.filter((f) => f.id !== pendingId)]);

      try {
        const res = await filesApiUpload(entityType, entityId, file, fileType);
        const created =
          normalizeEntityFile(res?.data, {
            fileName: file.name,
            fileType,
            uploadDate: new Date().toISOString(),
          }) ||
          normalizeEntityFile(
            res && typeof res === 'object' && 'id' in (res as object) ? res : null,
            { fileName: file.name, fileType }
          );

        if (created) {
          setFiles((prev) => [created, ...prev.filter((f) => f.id !== pendingId && f.id !== created.id)]);
        } else {
          // Fallback: soft refresh without blanking the list.
          await fetchFiles({ silent: true });
          setFiles((prev) => prev.filter((f) => f.id !== pendingId));
        }

        // Background sync — keep current list visible (no loading spinner flash).
        void fetchFiles({ silent: true });

        uploadProgress.finish();
        setUploadSuccess(true);
        toast.success(formatDocumentUploadSuccessToast(file.name));
        window.setTimeout(() => setUploadSuccess(false), 2800);
      } catch (e: any) {
        setFiles((prev) => prev.filter((f) => f.id !== pendingId));
        uploadProgress.reset();
        const message = e?.message || 'Upload failed';
        setError(message);
        toast.error(message);
        throw e;
      } finally {
        setUploading(false);
      }
    },
    [entityType, entityId, uploadProgress, fetchFiles]
  );

  const deleteFile = useCallback(
    async (fileId: string) => {
      if (!entityId || !entityType) return;
      setError(null);
      const previous = filesRef.current;
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      try {
        await filesApiDelete(entityType, entityId, fileId);
      } catch (e: any) {
        setFiles(previous);
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
