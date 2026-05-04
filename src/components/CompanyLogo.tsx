import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileSpreadsheet, Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  collapsed?: boolean;
}

export function CompanyLogo({ collapsed }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [canUpload, setCanUpload] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const refresh = () => {
    const { data } = supabase.storage.from('branding').getPublicUrl('logo.jpg');
    fetch(data.publicUrl, { method: 'HEAD' }).then(r => {
      if (r.ok) setUrl(`${data.publicUrl}?t=${Date.now()}`);
      else setUrl(null);
    }).catch(() => setUrl(null));
  };

  useEffect(() => {
    refresh();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return setCanUpload(false);
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      setCanUpload(!!data);
    });
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Envie uma imagem (JPG/PNG).', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const { error } = await supabase.storage.from('branding').upload('logo.jpg', file, { upsert: true, contentType: file.type });
    setUploading(false);
    if (error) {
      toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Logo atualizada' });
    refresh();
  };

  return (
    <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
      <button
        type="button"
        onClick={() => canUpload && inputRef.current?.click()}
        disabled={!canUpload || uploading}
        title={canUpload ? 'Clique para enviar a logomarca (JPG)' : 'Logomarca da empresa'}
        className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center overflow-hidden relative group disabled:cursor-default"
      >
        {url ? (
          <img src={url} alt="Logo" className="w-full h-full object-cover" />
        ) : (
          <FileSpreadsheet className="w-4 h-4 text-primary-foreground" />
        )}
        {canUpload && (
          <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            {uploading ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : <Upload className="w-3 h-3 text-white" />}
          </span>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {!collapsed && (
        <div>
          <h2 className="text-sm font-display font-bold">FinanceHub</h2>
          <p className="text-[10px] text-muted-foreground">Gestão Financeira</p>
        </div>
      )}
    </div>
  );
}
