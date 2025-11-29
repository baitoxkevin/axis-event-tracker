'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { FileDropzone } from '@/components/import/file-dropzone';
import { ColumnMapper } from '@/components/import/column-mapper';
import { DiffViewer } from '@/components/import/diff-viewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { parseExcelFile, applyColumnMapping } from '@/lib/excel-parser';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import {
  Upload,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import type { ImportDiff } from '@/types';

type WizardStep = 'upload' | 'mapping' | 'preview' | 'complete';

const STEPS: { key: WizardStep; label: string; description: string }[] = [
  { key: 'upload', label: 'Upload', description: 'Select Excel file' },
  { key: 'mapping', label: 'Map Columns', description: 'Match columns to fields' },
  { key: 'preview', label: 'Review', description: 'Review changes before import' },
  { key: 'complete', label: 'Complete', description: 'Import finished' },
];

export default function ImportPage() {
  const router = useRouter();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);

  // Excel data state
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [excelData, setExcelData] = useState<Record<string, unknown>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({});

  // Import state
  const [diff, setDiff] = useState<ImportDiff | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // tRPC mutations
  const previewMutation = trpc.import.preview.useMutation();
  const applyMutation = trpc.import.executeImport.useMutation({
    onError: (error) => {
      console.error('Execute import mutation error:', error);
    },
  });

  // Step index for progress
  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setIsProcessing(true);

    try {
      const parsed = await parseExcelFile(selectedFile);
      setExcelColumns(parsed.columns);
      setExcelData(parsed.data);

      // Initialize mapping with null values
      const initialMapping: Record<string, string | null> = {};
      parsed.columns.forEach((col) => {
        initialMapping[col] = null;
      });
      setColumnMapping(initialMapping);

      toast.success(`Loaded ${parsed.data.length} rows from "${parsed.sheetName}"`);
    } catch (err) {
      setError(String(err));
      toast.error('Failed to parse Excel file');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Go to next step
  const handleNext = useCallback(async () => {
    if (currentStep === 'upload') {
      if (!file || excelData.length === 0) {
        toast.error('Please select a valid Excel file');
        return;
      }
      setCurrentStep('mapping');
    } else if (currentStep === 'mapping') {
      // Validate required fields are mapped
      const requiredFields = ['email', 'firstName', 'lastName'];
      const mappedFields = Object.values(columnMapping).filter(Boolean);
      const missingRequired = requiredFields.filter((f) => !mappedFields.includes(f));

      if (missingRequired.length > 0) {
        toast.error(`Please map required fields: ${missingRequired.join(', ')}`);
        return;
      }

      // Apply mapping and calculate diff
      setIsProcessing(true);
      setError(null);

      try {
        const mappedData = applyColumnMapping(excelData, columnMapping);

        const result = await previewMutation.mutateAsync({
          data: mappedData,
          columnMapping,
          filename: file!.name,
        });

        setDiff(result.diff as unknown as ImportDiff);
        setSessionId(result.sessionId);
        setCurrentStep('preview');

        toast.success(
          `Found ${result.summary.added} new, ${result.summary.modified} modified, ${result.summary.removed} removed`
        );
      } catch (err) {
        setError(String(err));
        toast.error('Failed to process import');
      } finally {
        setIsProcessing(false);
      }
    }
  }, [currentStep, file, excelData, columnMapping, previewMutation]);

  // Go to previous step
  const handleBack = useCallback(() => {
    if (currentStep === 'mapping') {
      setCurrentStep('upload');
    } else if (currentStep === 'preview') {
      setCurrentStep('mapping');
    }
  }, [currentStep]);

  // Apply import
  const handleApprove = useCallback(
    async (options: { removeDeleted: boolean }) => {
      if (!diff || !sessionId) return;

      setIsProcessing(true);
      setError(null);

      try {
        await applyMutation.mutateAsync({
          sessionId,
          diff: {
            added: diff.added,
            modified: diff.modified,
            removed: diff.removed,
          },
          removeDeleted: options.removeDeleted,
        });

        setCurrentStep('complete');
        toast.success('Import completed successfully!');
      } catch (err) {
        setError(String(err));
        toast.error('Failed to apply import');
      } finally {
        setIsProcessing(false);
      }
    },
    [diff, sessionId, applyMutation]
  );

  // Cancel and go back
  const handleCancel = useCallback(() => {
    router.push('/guests');
  }, [router]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Import Guest Data"
        description="Upload an Excel file to import or update guest information"
      />

      {/* Progress indicator */}
      <div className="mb-8">
        <div className="mb-2 flex justify-between text-sm">
          {STEPS.map((step, index) => (
            <div
              key={step.key}
              className={`flex-1 text-center ${
                index <= currentStepIndex
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                {index < currentStepIndex ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border text-xs">
                    {index + 1}
                  </span>
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </div>
            </div>
          ))}
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Error display */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentStep === 'upload' && <Upload className="h-5 w-5" />}
            {currentStep === 'mapping' && <FileSpreadsheet className="h-5 w-5" />}
            {currentStep === 'preview' && <Check className="h-5 w-5" />}
            {STEPS.find((s) => s.key === currentStep)?.description}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Upload Step */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              <FileDropzone
                onFileSelect={handleFileSelect}
                disabled={isProcessing}
              />

              {file && excelData.length > 0 && (
                <Alert>
                  <FileSpreadsheet className="h-4 w-4" />
                  <AlertTitle>File loaded successfully</AlertTitle>
                  <AlertDescription>
                    Found {excelColumns.length} columns and {excelData.length} rows.
                    Click Next to map columns to guest fields.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Mapping Step */}
          {currentStep === 'mapping' && (
            <ColumnMapper
              excelColumns={excelColumns}
              sampleData={excelData.slice(0, 3)}
              mapping={columnMapping}
              onMappingChange={setColumnMapping}
            />
          )}

          {/* Preview Step */}
          {currentStep === 'preview' && diff && (
            <DiffViewer
              diff={diff}
              onApprove={handleApprove}
              onCancel={handleCancel}
              isApplying={isProcessing}
            />
          )}

          {/* Complete Step */}
          {currentStep === 'complete' && (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Import Complete!</h3>
              <p className="mb-6 text-muted-foreground">
                Guest data has been successfully imported.
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => router.push('/guests')}>
                  View Guests
                </Button>
                <Button onClick={() => router.push('/audit')}>
                  View Audit Log
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation buttons (not shown on preview/complete steps - they have their own) */}
      {(currentStep === 'upload' || currentStep === 'mapping') && (
        <div className="mt-6 flex justify-between">
          <Button
            variant="outline"
            onClick={currentStep === 'upload' ? handleCancel : handleBack}
            disabled={isProcessing}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {currentStep === 'upload' ? 'Cancel' : 'Back'}
          </Button>
          <Button onClick={handleNext} disabled={isProcessing || !file}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
