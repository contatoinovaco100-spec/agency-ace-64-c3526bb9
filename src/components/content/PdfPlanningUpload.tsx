import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { parsePlanningPdf, type PlanningItem } from '@/lib/pdfPlanningParser';

interface PdfPlanningUploadProps {
  onParsed: (items: PlanningItem[], rawText: string) => void;
}

export function PdfPlanningUpload({ onParsed }: PdfPlanningUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Por favor, selecione um arquivo PDF.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('O arquivo é muito grande. Máximo 10MB.');
      return;
    }

    setError(null);
    setFileName(file.name);
    setIsProcessing(true);

    try {
      const items = await parsePlanningPdf(file);
      if (items.length === 0) {
        setError('Nenhum conteúdo foi extraído do PDF. Verifique o formato do arquivo.');
        setIsProcessing(false);
        return;
      }

      toast.success(`${items.length} itens extraídos do PDF com sucesso!`);
      onParsed(items, '');
    } catch (err: any) {
      console.error('PDF parse error:', err);
      setError(`Erro ao processar o PDF: ${err.message || 'Tente novamente'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [onParsed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = '';
  }, [handleFile]);

  const reset = () => {
    setFileName(null);
    setError(null);
    setIsProcessing(false);
  };

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleInputChange}
        className="hidden"
      />

      <AnimatePresence mode="wait">
        {fileName && !error ? (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="border border-primary/30 bg-primary/5 rounded-2xl p-8 text-center"
          >
            {isProcessing ? (
              <div className="space-y-4">
                <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
                <div>
                  <p className="text-white font-semibold">Processando PDF...</p>
                  <p className="text-zinc-400 text-sm mt-1">{fileName}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <FileText className="w-12 h-12 text-primary mx-auto" />
                <div>
                  <p className="text-white font-semibold">{fileName}</p>
                  <p className="text-green-400 text-sm mt-1">PDF processado com sucesso!</p>
                </div>
                <Button variant="outline" size="sm" onClick={reset} className="border-white/10">
                  <X className="w-4 h-4 mr-2" />
                  Upload outro PDF
                </Button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
              transition-all duration-200
              ${isDragging
                ? 'border-primary bg-primary/10 scale-[1.02]'
                : 'border-white/10 hover:border-primary/40 hover:bg-primary/5'
              }
              ${error ? 'border-red-500/50 bg-red-500/5' : ''}
            `}
          >
            <div className="space-y-4">
              {error ? (
                <>
                  <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
                  <div>
                    <p className="text-red-400 font-semibold">{error}</p>
                    <p className="text-zinc-500 text-sm mt-2">Clique ou arraste um PDF para tentar novamente</p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className={`w-12 h-12 mx-auto transition-colors ${isDragging ? 'text-primary' : 'text-zinc-500'}`} />
                  <div>
                    <p className="text-white font-semibold">
                      {isDragging ? 'Solte o PDF aqui' : 'Arraste o planejamento em PDF'}
                    </p>
                    <p className="text-zinc-500 text-sm mt-1">
                      ou clique para selecionar • Máximo 10MB
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="border-primary/50 text-primary hover:bg-primary/10">
                    <FileText className="w-4 h-4 mr-2" />
                    Selecionar PDF
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
